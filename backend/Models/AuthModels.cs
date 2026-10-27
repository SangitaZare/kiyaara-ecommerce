using System.ComponentModel.DataAnnotations;

namespace Day17MiddlewareCors.Models;

// ---------- What the Angular pages send ----------

public class RegisterRequest
{
    [Required(ErrorMessage = "Enter your full name.")]
    [StringLength(80, MinimumLength = 2, ErrorMessage = "Name must be 2 to 80 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter your email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    [StringLength(254)]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a mobile number.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit mobile number.")]
    public string Mobile { get; set; } = string.Empty;

    // At least 8 characters, with at least one letter and one number
    [Required(ErrorMessage = "Enter a password.")]
    [RegularExpression(@"^(?=.*[A-Za-z])(?=.*\d).{8,100}$",
        ErrorMessage = "Use at least 8 characters, with a letter and a number.")]
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required(ErrorMessage = "Enter your email address.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter your password.")]
    public string Password { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    [Required(ErrorMessage = "Enter your email address.")]
    [EmailAddress(ErrorMessage = "Enter a valid email address.")]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    [Required]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a new password.")]
    [RegularExpression(@"^(?=.*[A-Za-z])(?=.*\d).{8,100}$",
        ErrorMessage = "Use at least 8 characters, with a letter and a number.")]
    public string NewPassword { get; set; } = string.Empty;
}
public class UpdateProfileRequest
{
    [Required(ErrorMessage = "Enter your full name.")]
    [StringLength(80, MinimumLength = 2, ErrorMessage = "Name must be 2 to 80 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a mobile number.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit mobile number.")]
    public string Mobile { get; set; } = string.Empty;
}

public class ChangePasswordRequest
{
    [Required(ErrorMessage = "Enter your current password.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a new password.")]
    [RegularExpression(@"^(?=.*[A-Za-z])(?=.*\d).{8,100}$",
        ErrorMessage = "Use at least 8 characters, with a letter and a number.")]
    public string NewPassword { get; set; } = string.Empty;
}

// ---------- What the API sends back ----------

// The safe part of an account: no password hash, no reset code. Role is NEW in 4C.
public record CustomerProfile(int Id, string FullName, string Email, string Mobile, string Role);

// After register or login: the token Angular sends with every request, and who it belongs to
public record AuthResponse(string Token, DateTime ExpiresAt, CustomerProfile Customer);
