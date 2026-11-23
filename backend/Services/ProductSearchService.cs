using Kiyaara.Api.Data;
using Kiyaara.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Services;

// One product search, shared by the shop (ProductsController) and the AI assistant's tools,
// so both always give the same answer for the same filters.
public class ProductSearchService(KiyaaraDbContext db)
{
    public async Task<ProductSearchResult> SearchAsync(ProductSearchQuery search, CancellationToken ct = default)
    {
        var page = Math.Max(search.Page, 1);
        var pageSize = Math.Clamp(search.PageSize, 1, 50);

        IQueryable<Product> query = db.Products.AsNoTracking();

        // Free text: every word must appear in the name, brand, category or description
        var words = (search.Q ?? "")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(6);
        foreach (var word in words)
        {
            var w = word;
            query = query.Where(p => p.Name.Contains(w) || p.Brand.Contains(w)
                                  || p.Category.Contains(w) || p.Description.Contains(w));
        }

        if (!string.IsNullOrWhiteSpace(search.Category))
        {
            var category = search.Category.Trim();
            query = query.Where(p => p.Category.Contains(category));
        }

        if (!string.IsNullOrWhiteSpace(search.Gender))
        {
            var gender = search.Gender.Trim();
            query = query.Where(p => p.Gender == gender);
        }

        if (!string.IsNullOrWhiteSpace(search.Colour))
        {
            var colour = search.Colour.Trim();
            query = query.Where(p => p.Name.Contains(colour) || p.Description.Contains(colour));
        }

        if (!string.IsNullOrWhiteSpace(search.Size))
        {
            var size = search.Size.Trim().ToUpperInvariant();
            query = query.Where(p => p.Sizes.Contains(size));
        }

        if (search.MinPrice is decimal min) query = query.Where(p => p.Price >= min);
        if (search.MaxPrice is decimal max) query = query.Where(p => p.Price <= max);
        if (search.InStock) query = query.Where(p => p.Stock > 0);

        query = search.Sort?.ToLowerInvariant() switch
        {
            "price_asc" => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price_desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "rating" => query.OrderByDescending(p => p.Rating).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
        };

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new ProductSearchResult(items, total, page, pageSize);
    }
}
