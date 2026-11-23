using System.Security.Claims;
using Kiyaara.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Services;

// Decides whether a correctly signed login token is still allowed. A token stops working when:
//   - its account no longer exists, or
//   - the account's password changed after the token was made (TokenVersion went up).
// Runs on every request that carries a token (Program.cs, JwtBearer OnTokenValidated).
public static class SessionCheck
{
    public static async Task<bool> IsCurrentAsync(KiyaaraDbContext db, ClaimsPrincipal user, CancellationToken ct = default)
    {
        var id = user.CustomerId();
        if (id == 0) return false;

        // Tokens made before versions existed have no "ver": they count as version 0
        var claim = user.FindFirst(CustomerClaims.Version)?.Value;
        var version = claim is null ? 0 : int.TryParse(claim, out var v) ? v : -1;

        var current = await db.Customers.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => (int?)c.TokenVersion)
            .FirstOrDefaultAsync(ct);

        return current == version;
    }
}
