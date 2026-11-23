using System.Text.Json;
using System.Text.RegularExpressions;
using Kiyaara.Api.Data;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Assistant;

// What the chat window needs to draw one product card under a reply
public record ProductCard(int Id, string Name, string Brand, string ImageUrl,
    decimal Price, decimal Mrp, double Rating, bool InStock);

// The tools the model may call to look things up instead of guessing.
// Definitions tell the model what exists; ExecuteAsync runs one call and returns JSON for the model.
// Order tools only ever see the logged-in customer's own orders: the customer id comes from the
// token (passed in by the controller), never from the model's arguments.
public partial class AssistantTools(KiyaaraDbContext db, ProductSearchService search)
{
    public const string SearchProducts = "search_products";
    public const string GetProduct = "get_product";
    public const string ListMyOrders = "list_my_orders";
    public const string GetMyOrder = "get_my_order";

    private const int MaxSearchResults = 8;     // enough to recommend from, small enough to keep prompts cheap
    private const int MaxOrders = 10;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static readonly List<LlmToolDefinition> Definitions =
    [
        new(SearchProducts,
            "Search the Kiyaara catalogue. Use it whenever the customer asks about products, prices, sizes, " +
            "colours or availability. Every filter is optional; combine them. Prices are in Indian rupees.",
            Schema(new()
            {
                ["q"] = Str("Keywords that must all appear in the name, brand, category or description, e.g. \"cotton kurta\"."),
                ["category"] = Str("Category or part of one, e.g. \"Kurta Sets\", \"Sarees\", \"Shirts\", \"Dresses\"."),
                ["gender"] = Enum("Who the product is for.", "Women", "Men", "Kids"),
                ["colour"] = Str("A colour to look for, e.g. \"blue\"."),
                ["size"] = Str("A size the product must come in, e.g. \"M\" or \"XL\"."),
                ["minPrice"] = Num("Lowest selling price in rupees."),
                ["maxPrice"] = Num("Highest selling price in rupees."),
                ["inStock"] = Bool("true to hide sold-out products."),
                ["sort"] = Enum("Result order. Default is newest.", "newest", "price_asc", "price_desc", "rating")
            })),

        new(GetProduct,
            "Get full details of one product by its id (from search_products): description, every size, stock, rating.",
            Schema(new() { ["id"] = Int("The product id.") }, "id")),

        new(ListMyOrders,
            "List the logged-in customer's own orders, newest first, with status and totals. " +
            "Use it when they ask about their orders, deliveries or purchases."),

        new(GetMyOrder,
            "Get one of the logged-in customer's own orders: items, status history, expected delivery, totals.",
            Schema(new() { ["orderNumber"] = Str("The order number, e.g. \"KY-1004\" or just \"1004\".") }, "orderNumber"))
    ];

    // Runs one tool call. Problems (bad arguments, not found) come back as { "error": ... } so the model
    // can tell the customer or try again; they are not exceptions.
    public async Task<string> ExecuteAsync(LlmToolCall call, int customerId, CancellationToken ct = default)
    {
        object result = call.Name switch
        {
            SearchProducts => await SearchProductsAsync(call.Args, ct),
            GetProduct => await GetProductAsync(call.Args, ct),
            ListMyOrders => await ListMyOrdersAsync(customerId, ct),
            GetMyOrder => await GetMyOrderAsync(call.Args, customerId, ct),
            _ => Error($"Unknown tool \"{call.Name}\".")
        };
        return JsonSerializer.Serialize(result, JsonOptions);
    }

    // ---------------- Tools ----------------

    private async Task<object> SearchProductsAsync(JsonElement args, CancellationToken ct)
    {
        var query = new ProductSearchQuery
        {
            Q = GetString(args, "q"),
            Category = GetString(args, "category"),
            Gender = GetString(args, "gender"),
            Colour = GetString(args, "colour"),
            Size = GetString(args, "size"),
            MinPrice = GetDecimal(args, "minPrice"),
            MaxPrice = GetDecimal(args, "maxPrice"),
            InStock = GetBool(args, "inStock") ?? false,
            Sort = GetString(args, "sort"),
            PageSize = MaxSearchResults
        };

        if (query.MinPrice > query.MaxPrice)
            return Error("minPrice can't be higher than maxPrice.");

        var found = await search.SearchAsync(query, ct);
        return new
        {
            total = found.Total,
            shown = found.Items.Count,
            products = found.Items.Select(p => new
            {
                p.Id,
                p.Name,
                p.Brand,
                p.Category,
                p.Gender,
                p.Price,
                p.Mrp,
                inStock = p.Stock > 0,
                p.Sizes,
                p.Rating,
                url = ProductUrl(p.Id)
            })
        };
    }

    private async Task<object> GetProductAsync(JsonElement args, CancellationToken ct)
    {
        if (GetInt(args, "id") is not int id)
            return Error("Give the product id as a number.");

        var p = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (p is null) return Error($"No product has id {id}.");

        return new
        {
            p.Id,
            p.Name,
            p.Brand,
            p.Category,
            p.Gender,
            p.Description,
            p.Price,
            p.Mrp,
            p.Stock,
            p.Sizes,
            p.Rating,
            p.RatingCount,
            url = ProductUrl(p.Id)
        };
    }

    private async Task<object> ListMyOrdersAsync(int customerId, CancellationToken ct)
    {
        if (customerId == 0) return Error("The customer is not logged in.");

        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.PlacedAt)
            .Take(MaxOrders)
            .ToListAsync(ct);

        return new
        {
            count = orders.Count,
            orders = orders.Select(o => new
            {
                o.OrderNumber,
                o.PlacedAt,
                status = o.Status.ToString(),
                o.ExpectedDelivery,
                o.ItemCount,
                o.Total,
                items = o.Items.Select(i => i.Name)
            })
        };
    }

    private async Task<object> GetMyOrderAsync(JsonElement args, int customerId, CancellationToken ct)
    {
        if (customerId == 0) return Error("The customer is not logged in.");

        var raw = GetString(args, "orderNumber")?.Trim().ToUpperInvariant().Replace("KY-", "").Replace("KY", "");
        if (!int.TryParse(raw, out var id))
            return Error("Give the order number like KY-1004.");

        var o = await db.Orders.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);

        // Someone else's order looks exactly like a missing one, the same rule as OrdersController
        if (o is null || o.CustomerId != customerId)
            return Error($"No order KY-{id} was found on this account.");

        return new
        {
            o.OrderNumber,
            o.PlacedAt,
            status = o.Status.ToString(),
            history = o.History.Select(h => new { status = h.Status.ToString(), h.At }),
            o.ExpectedDelivery,
            canCancel = OrderRules.NextSteps(o.Status).Contains(OrderStatus.Cancelled),
            items = o.Items.Select(i => new { i.ProductId, i.Name, i.Brand, i.Size, i.Quantity, i.Price }),
            o.PaymentMethod,
            o.Subtotal,
            o.DeliveryFee,
            o.Total,
            deliverTo = $"{o.Address.City}, {o.Address.State} {o.Address.Pincode}",   // no name, phone or street
            url = $"/order/{o.Id}"
        };
    }

    // ---------------- Product cards for the chat window ----------------

    // The products a reply links to ("/product/7"), in the order they appear, read fresh from the
    // database: the card's price and stock never come from the model's text.
    public async Task<List<ProductCard>> CardsForReplyAsync(string reply, CancellationToken ct = default)
    {
        var ids = ProductLink().Matches(reply)
            .Select(m => int.Parse(m.Groups[1].Value))
            .Distinct()
            .Take(MaxCards)
            .ToList();
        if (ids.Count == 0) return [];

        var found = await db.Products.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductCard(p.Id, p.Name, p.Brand, p.ImageUrl, p.Price, p.Mrp, p.Rating, p.Stock > 0))
            .ToListAsync(ct);

        // Keep the reply's order; ids that no longer exist are simply left out
        return ids.Select(id => found.FirstOrDefault(c => c.Id == id)).OfType<ProductCard>().ToList();
    }

    private const int MaxCards = 6;

    // "(/product/7)" as written in a Markdown link
    [GeneratedRegex(@"\(/product/(\d{1,9})\)")]
    private static partial Regex ProductLink();

    // ---------------- Helpers ----------------

    private static string ProductUrl(int id) => $"/product/{id}";
    private static object Error(string message) => new { error = message };

    // The model sometimes sends numbers as strings ("1500"), so both forms are accepted.
    private static string? GetString(JsonElement args, string name) =>
        args.ValueKind == JsonValueKind.Object && args.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? (string.IsNullOrWhiteSpace(v.GetString()) ? null : v.GetString())
            : null;

    private static decimal? GetDecimal(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), out d)) return d;
        return null;
    }

    private static int? GetInt(JsonElement args, string name) =>
        GetDecimal(args, name) is decimal d && d == Math.Floor(d) && d is >= int.MinValue and <= int.MaxValue
            ? (int)d
            : null;

    private static bool? GetBool(JsonElement args, string name)
    {
        if (args.ValueKind != JsonValueKind.Object || !args.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(v.GetString(), out var b) => b,
            _ => null
        };
    }

    // JSON Schema builders. Dictionaries keep property names exactly as written ("minPrice").
    private static object Schema(Dictionary<string, object> properties, params string[] required) =>
        required.Length > 0
            ? new { type = "object", properties, required }
            : new { type = "object", properties };

    private static object Str(string description) => new { type = "string", description };
    private static object Num(string description) => new { type = "number", description };
    private static object Int(string description) => new { type = "integer", description };
    private static object Bool(string description) => new { type = "boolean", description };
    private static object Enum(string description, params string[] values) =>
        new { type = "string", description, @enum = values };
}
