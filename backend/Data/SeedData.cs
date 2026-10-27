using Day17MiddlewareCors.Models;

namespace Day17MiddlewareCors.Data;

// Starter catalogue, kept in memory. A database replaces this in Phase 4.
public static class SeedData
{
    // Real product photos live in the Angular app: public/images/products/<file>.webp
    // The browser loads them from http://localhost:4200/images/products/<file>.webp
    private static string Photo(string file) => $"/images/products/{file}.webp";

    public static List<Product> Products()
    {
        var now = DateTime.UtcNow;

        return new List<Product>
        {
            new() { Id = 1, Brand = "Neel Loom", Name = "Block Print Cotton Kurta Set", Gender = "Women", Category = "Kurta Sets",
                Description = "Hand block printed cotton kurta with matching palazzo and a soft mulmul dupatta.",
                Price = 1499, Mrp = 2999, Stock = 25, Sizes = new() { "S", "M", "L", "XL" },
                Rating = 4.4, RatingCount = 1280, CreatedAt = now.AddDays(-1), ImageUrl = Photo("kurta-set") },

            new() { Id = 2, Brand = "Kesar Lane", Name = "Banarasi Silk Blend Saree", Gender = "Women", Category = "Sarees",
                Description = "Silk blend saree with zari woven border and an unstitched blouse piece.",
                Price = 3299, Mrp = 6599, Stock = 8, Sizes = new() { "Free Size" },
                Rating = 4.6, RatingCount = 842, CreatedAt = now.AddDays(-2), ImageUrl = Photo("saree") },

            new() { Id = 3, Brand = "Tamarind Street", Name = "Floral Tiered Midi Dress", Gender = "Women", Category = "Dresses",
                Description = "Lightweight viscose midi dress with a tiered skirt and adjustable tie straps.",
                Price = 1199, Mrp = 1999, Stock = 3, Sizes = new() { "XS", "S", "M", "L" },
                Rating = 4.1, RatingCount = 356, CreatedAt = now.AddDays(-3), ImageUrl = Photo("midi-dress") },

            new() { Id = 4, Brand = "Kiyaara Studio", Name = "Ribbed Square-Neck Top", Gender = "Women", Category = "Tops",
                Description = "Stretchy ribbed cotton top with a square neckline. Pairs with jeans or skirts.",
                Price = 599, Mrp = 999, Stock = 40, Sizes = new() { "XS", "S", "M", "L", "XL" },
                Rating = 4.2, RatingCount = 2104, CreatedAt = now.AddDays(-4), ImageUrl = Photo("ribbed-top") },

            new() { Id = 5, Brand = "Tamarind Street", Name = "High-Rise Wide-Leg Jeans", Gender = "Women", Category = "Jeans",
                Description = "Comfort stretch denim with a high rise and relaxed wide legs.",
                Price = 1399, Mrp = 2499, Stock = 18, Sizes = new() { "26", "28", "30", "32", "34" },
                Rating = 4.3, RatingCount = 967, CreatedAt = now.AddDays(-6), ImageUrl = Photo("wide-leg-jeans") },

            new() { Id = 6, Brand = "Saanjh", Name = "Linen Blend Casual Shirt", Gender = "Men", Category = "Shirts",
                Description = "Breathable linen blend shirt with a spread collar, made for hot days.",
                Price = 1099, Mrp = 1999, Stock = 30, Sizes = new() { "S", "M", "L", "XL", "XXL" },
                Rating = 4.5, RatingCount = 1543, CreatedAt = now.AddDays(-2), ImageUrl = Photo("linen-shirt") },

            new() { Id = 7, Brand = "Neel Loom", Name = "Chikankari Cotton Kurta", Gender = "Men", Category = "Kurtas",
                Description = "Straight cotton kurta with hand chikankari embroidery on the yoke.",
                Price = 1299, Mrp = 2599, Stock = 12, Sizes = new() { "S", "M", "L", "XL" },
                Rating = 4.4, RatingCount = 611, CreatedAt = now.AddDays(-5), ImageUrl = Photo("chikankari-kurta") },

            new() { Id = 8, Brand = "Tamarind Street", Name = "Oversized Graphic T-Shirt", Gender = "Men", Category = "T-Shirts",
                Description = "Heavyweight cotton tee with a dropped shoulder and a printed back graphic.",
                Price = 499, Mrp = 999, Stock = 60, Sizes = new() { "S", "M", "L", "XL" },
                Rating = 4.0, RatingCount = 3320, CreatedAt = now.AddDays(-7), ImageUrl = Photo("graphic-tee") },

            new() { Id = 9, Brand = "Saanjh", Name = "Slim Fit Stretch Chinos", Gender = "Men", Category = "Trousers",
                Description = "Cotton stretch chinos with a slim fit and a clean flat front.",
                Price = 1199, Mrp = 2199, Stock = 0, Sizes = new() { "30", "32", "34", "36" },
                Rating = 4.2, RatingCount = 734, CreatedAt = now.AddDays(-9), ImageUrl = Photo("chinos") },

            new() { Id = 10, Brand = "Mitti Kids", Name = "Cotton Frock with Bow", Gender = "Kids", Category = "Kidswear",
                Description = "Soft cotton frock with a back bow and a cotton lining, gentle on young skin.",
                Price = 699, Mrp = 1199, Stock = 15, Sizes = new() { "2-3Y", "4-5Y", "6-7Y" },
                Rating = 4.6, RatingCount = 288, CreatedAt = now.AddDays(-3), ImageUrl = Photo("frock") },

            new() { Id = 11, Brand = "Mitti Craft", Name = "Oxidised Jhumka Earrings", Gender = "Women", Category = "Jewellery",
                Description = "Lightweight oxidised silver-tone jhumkas with tiny ghungroo drops.",
                Price = 349, Mrp = 799, Stock = 50, Sizes = new() { "Free Size" },
                Rating = 4.5, RatingCount = 5120, CreatedAt = now.AddDays(-8), ImageUrl = Photo("jhumkas") },

            new() { Id = 12, Brand = "Kesar Lane", Name = "Quilted Sling Bag", Gender = "Women", Category = "Bags",
                Description = "Quilted faux-leather sling bag with a chain strap and two inner pockets.",
                Price = 899, Mrp = 1799, Stock = 22, Sizes = new() { "Free Size" },
                Rating = 4.3, RatingCount = 902, CreatedAt = now.AddDays(-10), ImageUrl = Photo("sling-bag") }
        };
    }
}
