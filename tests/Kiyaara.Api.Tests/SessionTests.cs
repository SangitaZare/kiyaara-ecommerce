using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Kiyaara.Api.Controllers;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Kiyaara.Api.Tests;

// A password change or reset must log out every other device (TokenVersion), while the
// device that changed the password gets a fresh login and stays in.
public sealed class SessionTests : IDisposable
{
    private const string OldPassword = "OldPass123";

    private readonly TestDatabase _data = new();
    private readonly PasswordHasher<Customer> _hasher = new();
    private readonly TokenService _tokens = new(new JwtSettings { Key = new string('k', 48) });
    private readonly AuthController _controller;

    public SessionTests()
    {
        var priya = _data.Db.Customers.Find(TestDatabase.Priya)!;
        priya.PasswordHash = _hasher.HashPassword(priya, OldPassword);
        _data.Db.SaveChanges();

        _controller = new AuthController(_data.Db, _tokens, _hasher, new NoEmail(),
            new ConfigurationBuilder().Build(), NullLogger<AuthController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = PriyaFromToken(_tokens.Create(priya).Token) } }
        };
    }

    public void Dispose() => _data.Dispose();

    // The claims the API would read from this token
    private static ClaimsPrincipal PriyaFromToken(string token) =>
        new(new ClaimsIdentity(new JsonWebTokenHandler().ReadJsonWebToken(token).Claims, "Bearer"));

    private Task<bool> StillWorks(ClaimsPrincipal user) => SessionCheck.IsCurrentAsync(_data.Db, user);

    [Fact]
    public async Task A_new_login_works()
    {
        Assert.True(await StillWorks(_controller.User));
    }

    [Fact]
    public async Task Changing_the_password_ends_other_logins_and_keeps_this_one()
    {
        var otherDevice = _controller.User;

        var result = await _controller.ChangePassword(new ChangePasswordRequest { CurrentPassword = OldPassword, NewPassword = "NewPass456" });

        var fresh = Assert.IsType<AuthResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);
        _data.Db.ChangeTracker.Clear();
        Assert.False(await StillWorks(otherDevice));
        Assert.True(await StillWorks(PriyaFromToken(fresh.Token)));
    }

    [Fact]
    public async Task A_wrong_current_password_changes_nothing()
    {
        var before = _controller.User;

        var result = await _controller.ChangePassword(new ChangePasswordRequest { CurrentPassword = "Wrong999", NewPassword = "NewPass456" });

        Assert.IsType<ObjectResult>(result.Result);          // ValidationProblem
        _data.Db.ChangeTracker.Clear();
        Assert.True(await StillWorks(before));
    }

    [Fact]
    public async Task Resetting_the_password_ends_every_login()
    {
        var loggedIn = _controller.User;
        const string code = "A1B2C3";
        var priya = _data.Db.Customers.Find(TestDatabase.Priya)!;
        priya.ResetTokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        priya.ResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(30);
        await _data.Db.SaveChangesAsync();

        var result = await _controller.ResetPassword(new ResetPasswordRequest { Email = priya.Email, Token = code, NewPassword = "NewPass456" });

        Assert.IsType<NoContentResult>(result);
        _data.Db.ChangeTracker.Clear();
        Assert.False(await StillWorks(loggedIn));
    }

    [Fact]
    public async Task Tokens_made_before_versions_existed_count_as_version_0()
    {
        var oldToken = new ClaimsPrincipal(new ClaimsIdentity([new Claim(CustomerClaims.Id, TestDatabase.Priya.ToString())], "Bearer"));

        Assert.True(await StillWorks(oldToken));

        _data.Db.Customers.Find(TestDatabase.Priya)!.TokenVersion = 1;
        await _data.Db.SaveChangesAsync();
        Assert.False(await StillWorks(oldToken));
    }

    [Fact]
    public async Task A_deleted_account_or_a_broken_version_is_refused()
    {
        var gone = new ClaimsPrincipal(new ClaimsIdentity([new Claim(CustomerClaims.Id, "999")], "Bearer"));
        var broken = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(CustomerClaims.Id, TestDatabase.Priya.ToString()), new Claim(CustomerClaims.Version, "abc")], "Bearer"));

        Assert.False(await StillWorks(gone));
        Assert.False(await StillWorks(broken));
    }

    private sealed class NoEmail : IEmailService
    {
        public Task SendAsync(string to, string subject, string body) => Task.CompletedTask;
    }
}
