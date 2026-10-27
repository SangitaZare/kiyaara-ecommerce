namespace Day17MiddlewareCors.Models;

// What a shopper (or the AI agent) can ask for. Every field is optional.
public class ProductSearchQuery
{
    public string? Q { get; set; }            // free text keywords: "kurta cotton"
    public string? Category { get; set; }     // "Kurta Sets" or just "kurta"
    public string? Gender { get; set; }       // Women, Men or Kids
    public string? Colour { get; set; }       // looked for in name and description for now
    public string? Size { get; set; }         // S, M, L, XL...
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool InStock { get; set; }         // true = hide sold-out products
    public string? Sort { get; set; }         // newest (default), price_asc, price_desc, rating
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
}

public record ProductSearchResult(List<Product> Items, int Total, int Page, int PageSize);