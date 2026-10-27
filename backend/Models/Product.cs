using System.ComponentModel.DataAnnotations;

namespace Day17MiddlewareCors.Models;

public class Product : IValidatableObject
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(60)]
    public string Brand { get; set; } = "Kiyaara Studio";

    [Required]
    public string Category { get; set; } = "General";     // Kurta Sets, Sarees, Shirts...

    [Required]
    public string Gender { get; set; } = "Women";         // Women, Men or Kids

    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    [Range(1.0, 1000000.0, ErrorMessage = "Price must be between 1 and 10,00,000.")]
    public decimal Price { get; set; }                     // selling price

    [Range(0.0, 1000000.0)]
    public decimal Mrp { get; set; }                       // price before discount (0 = same as Price)

    [Range(0, 10000, ErrorMessage = "Stock must be between 0 and 10,000.")]
    public int Stock { get; set; }

    public List<string> Sizes { get; set; } = new();

    [Range(0.0, 5.0)]
    public double Rating { get; set; }

    public int RatingCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // A rule that needs two fields at once
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Mrp > 0 && Price > Mrp)
            yield return new ValidationResult("Price can't be higher than MRP.", new[] { nameof(Price) });
    }
}