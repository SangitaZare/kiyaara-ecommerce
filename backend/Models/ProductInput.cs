using System.ComponentModel.DataAnnotations;

namespace Kiyaara.Api.Models;

// What the admin product form may set when it creates or edits a product (POST and PUT /api/products).
// Only these fields: the id, rating, rating count and created date belong to the shop, never to the form,
// so a request can't fake a 5-star rating or a "new in" date by adding them to the JSON.
// Field names and messages match Product, so the form shows the same validation errors.
public class ProductInput : IValidatableObject
{
    [Required(ErrorMessage = "Name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2 to 100 characters.")]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(60)]
    public string Brand { get; set; } = "Kiyaara Studio";

    [Required]
    public string Category { get; set; } = "General";

    [Required]
    public string Gender { get; set; } = "Women";

    [StringLength(1000)]
    public string Description { get; set; } = string.Empty;

    public string ImageUrl { get; set; } = string.Empty;

    [Range(1.0, 1000000.0, ErrorMessage = "Price must be between 1 and 10,00,000.")]
    public decimal Price { get; set; }

    [Range(0.0, 1000000.0)]
    public decimal Mrp { get; set; }                       // 0 = same as Price (no discount)

    [Range(0, 10000, ErrorMessage = "Stock must be between 0 and 10,000.")]
    public int Stock { get; set; }

    public List<string> Sizes { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Mrp > 0 && Price > Mrp)
            yield return new ValidationResult("Price can't be higher than MRP.", new[] { nameof(Price) });
    }

    // Copies the form's fields onto a product. Everything else on the product stays as it was.
    public void ApplyTo(Product product)
    {
        product.Name = Name;
        product.Brand = Brand;
        product.Category = Category;
        product.Gender = Gender;
        product.Description = Description;
        product.ImageUrl = ImageUrl;                       // a new upload's address arrives here
        product.Price = Price;
        product.Mrp = Mrp == 0 ? Price : Mrp;              // no MRP given = no discount
        product.Stock = Stock;
        product.Sizes = Sizes;
    }
}
