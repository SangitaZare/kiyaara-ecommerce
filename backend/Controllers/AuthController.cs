using System.Security.Cryptography;
using System.Text;
using Day17MiddlewareCors.Data;
using Day17MiddlewareCors.Models;
using Day17MiddlewareCors.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Day17MiddlewareCors.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    KiyaaraDbContext db,
    TokenService tokens,
    IPasswordHasher<Customer> hasher,
    IEmailService emails,
    IConfiguration configuration,
    ILogger<AuthController> logger) : ControllerBase
{
    private const int ResetLinkMinutes = 30;

    // POST api/auth/register
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var email = Normalize(request.Email);

        if (await db.Customers.AnyAsync(c => c.Email == email))
            return EmailTaken();

        var customer = new Customer
        {
            FullName = request.FullName.Trim(),
            Email = email,
            Mobile = request.Mobile,
            Role = UserRoles.Customer,            // NEW (4C): sign-up always makes a shopper, never an admin
            CreatedAt = DateTime.UtcNow
        };
        customer.PasswordHash = hasher.HashPassword(customer, request.Password);   // never save the real password

        db.Customers.Add(customer);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Two sign-ups with the same email at the same moment: the unique index stops the second
            return EmailTaken();
        }

        return Ok(tokens.Create(customer));       // signed in straight away
    }

    // POST api/auth/login
    [EnableRateLimiting("auth")]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var email = Normalize(request.Email);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == email);

        // Same answer for "no such email" and "wrong password", so nobody can test which emails exist
        if (customer is null) return Unauthorized();

        var result = hasher.VerifyHashedPassword(customer, customer.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed) return Unauthorized();

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            // The password is right but was scrambled the old way: save it the new, stronger way
            customer.PasswordHash = hasher.HashPassword(customer, request.Password);
            await db.SaveChangesAsync();
        }

        return Ok(tokens.Create(customer));
    }

    // GET api/auth/me   (needs a token: "Authorization: Bearer <token>")
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<CustomerProfile>> Me()
    {
        var id = User.CustomerId();
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id);
        return customer is null ? Unauthorized() : Ok(TokenService.Profile(customer));
    }
    // PUT api/auth/me   (the logged-in customer edits their name and mobile)
    [Authorize]
    [HttpPut("me")]
    public async Task<ActionResult<CustomerProfile>> UpdateMe(UpdateProfileRequest request)
    {
        var id = User.CustomerId();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return Unauthorized();

        customer.FullName = request.FullName.Trim();
        customer.Mobile = request.Mobile;
        await db.SaveChangesAsync();

        return Ok(TokenService.Profile(customer));
    }

    // POST api/auth/change-password   (needs the current password)
    [EnableRateLimiting("auth")]
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var id = User.CustomerId();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id);
        if (customer is null) return Unauthorized();

        var result = hasher.VerifyHashedPassword(customer, customer.PasswordHash, request.CurrentPassword);
        if (result == PasswordVerificationResult.Failed)
        {
            // 400, not 401: a 401 would make Angular log the person out
            ModelState.AddModelError(nameof(request.CurrentPassword), "Your current password is not correct.");
            return ValidationProblem(ModelState);
        }

        customer.PasswordHash = hasher.HashPassword(customer, request.NewPassword);
        customer.ResetTokenHash = null;              // an old reset link stops working too
        customer.ResetTokenExpiresAt = null;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // POST api/auth/forgot-password
    [EnableRateLimiting("forgot")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = Normalize(request.Email);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == email);

        if (customer is not null)
        {
            // A random code for the link. Only a scrambled copy is saved, like a password.
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));    // 64 letters and digits
            customer.ResetTokenHash = HashToken(token);
            customer.ResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(ResetLinkMinutes);
            await db.SaveChangesAsync();

            var site = configuration["ClientUrl"] ?? "http://localhost:4200";
            var link = $"{site}/reset-password?email={Uri.EscapeDataString(email)}&token={token}";
            var firstName = customer.FullName.Split(' ')[0];

            try
            {
                await emails.SendAsync(customer.Email, "Reset your Kiyaara password",
                    $"Hi {firstName},\n\n" +
                    $"Open this link within {ResetLinkMinutes} minutes to choose a new password:\n{link}\n\n" +
                    "If you didn't ask for this, you can ignore this email. Your password stays the same.");
            }
            catch (Exception ex)
            {
                // A failed email must not change the answer, or it would show which emails have accounts
                logger.LogError(ex, "Could not send the reset email");
            }
        }

        // The same reply whether or not the email has an account
        return Ok(new { message = "If an account exists for this email, we've sent a reset link." });
    }

    // POST api/auth/reset-password
    [EnableRateLimiting("auth")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var email = Normalize(request.Email);
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Email == email);

        var linkWorks = customer is not null
            && customer.ResetTokenHash is not null
            && customer.ResetTokenExpiresAt > DateTime.UtcNow
            && CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(customer.ResetTokenHash),
                   Encoding.UTF8.GetBytes(HashToken(request.Token)));

        if (!linkWorks)
        {
            ModelState.AddModelError(nameof(request.Token), "This reset link is wrong or has expired. Ask for a new one.");
            return ValidationProblem(ModelState);
        }

        customer!.PasswordHash = hasher.HashPassword(customer, request.NewPassword);
        customer.ResetTokenHash = null;              // a link works only once
        customer.ResetTokenExpiresAt = null;
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ---------- Helpers ----------

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim().ToUpperInvariant())));

    private ActionResult EmailTaken()
    {
        ModelState.AddModelError("Email", "An account with this email already exists. Log in instead.");
        return ValidationProblem(ModelState);
    }
}