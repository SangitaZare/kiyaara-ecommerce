using System.Security.Claims;
using System.Text;
using Day17MiddlewareCors.Models;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Day17MiddlewareCors.Services;

// The "Jwt" block in appsettings.json
public class JwtSettings
{
    public string Issuer { get; set; } = "Kiyaara";
    public string Audience { get; set; } = "KiyaaraShop";
    public string Key { get; set; } = string.Empty;     // secret: at least 32 characters
    public int Days { get; set; } = 7;                  // how long a shopper's login lasts
    public int AdminHours { get; set; } = 8;            // NEW (4C): how long an admin's sign-in lasts

    public SymmetricSecurityKey SigningKey() => new(Encoding.UTF8.GetBytes(Key));
}

// The names of the facts (claims) written inside every token
public static class CustomerClaims
{
    public const string Id = "sub";
    public const string Email = "email";
    public const string Name = "name";
    public const string Role = "role";                   // NEW (4C): "Customer" or "Admin"

    // The logged-in customer's id, read from the token. 0 means "no customer".
    public static int CustomerId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirst(Id)?.Value, out var id) ? id : 0;
}

// Makes the signed token a customer gets after register or login
public class TokenService(JwtSettings settings)
{
    public AuthResponse Create(Customer customer)
    {
        // NEW (4C): staff sign-ins end sooner, which is safer for an account that can change the shop
        var expiresAt = customer.Role == UserRoles.Admin
            ? DateTime.UtcNow.AddHours(settings.AdminHours)
            : DateTime.UtcNow.AddDays(settings.Days);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(CustomerClaims.Id, customer.Id.ToString()),
                new Claim(CustomerClaims.Email, customer.Email),
                new Claim(CustomerClaims.Name, customer.FullName),
                new Claim(CustomerClaims.Role, customer.Role)
            }),
            // The signature: the API can later prove it made this token and nobody changed it
            SigningCredentials = new SigningCredentials(settings.SigningKey(), SecurityAlgorithms.HmacSha256)
        };

        var token = new JsonWebTokenHandler().CreateToken(descriptor);
        return new AuthResponse(token, expiresAt, Profile(customer));
    }

    public static CustomerProfile Profile(Customer customer) =>
        new(customer.Id, customer.FullName, customer.Email, customer.Mobile, customer.Role);
}
