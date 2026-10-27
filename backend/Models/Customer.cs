namespace Day17MiddlewareCors.Models;

// The two kinds of account. Used in [Authorize(Roles = UserRoles.Admin)] and in the token.
public static class UserRoles
{
    public const string Customer = "Customer";
    public const string Admin = "Admin";
}

// An account: a shopper or a member of staff. Saved in the Customers table; never sent to the browser as it is.
public class Customer
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;          // saved in lower case, unique
    public string Mobile { get; set; } = string.Empty;         // 10 digits, used to fill the checkout form
    public string PasswordHash { get; set; } = string.Empty;   // scrambled password, never the real one
    public string Role { get; set; } = UserRoles.Customer;     // NEW (4C): "Customer" or "Admin"
    public DateTime CreatedAt { get; set; }

    // Forgot password: a scrambled copy of the reset code and when it stops working
    public string? ResetTokenHash { get; set; }
    public DateTime? ResetTokenExpiresAt { get; set; }
}
