using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Kiyaara.Api.Controllers;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Kiyaara.Api.Tests;

public sealed class ProductsControllerTests : IDisposable
{
    private readonly TestDatabase _data = new();
    private readonly ProductsController _controller;

    public ProductsControllerTests() =>
        // Photo storage isn't used by create or edit
        _controller = new ProductsController(_data.Db, photos: null!, new ProductSearchService(_data.Db));

    public void Dispose() => _data.Dispose();

    // The JSON the way ASP.NET Core reads a request body: unknown fields like "rating" are skipped
    private static ProductInput FromJson(string json) =>
        JsonSerializer.Deserialize<ProductInput>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    [Fact]
    public async Task Create_ignores_rating_id_and_date_sent_in_the_request()
    {
        var input = FromJson("""
            { "name": "Silk Dupatta", "brand": "Kesar Lane", "category": "Dupattas", "gender": "Women",
              "price": 899, "mrp": 0, "stock": 12, "sizes": [],
              "id": 1, "rating": 5, "ratingCount": 99999, "createdAt": "2030-01-01T00:00:00Z" }
            """);
        var before = DateTime.UtcNow;

        var result = await _controller.Create(input);

        var product = Assert.IsType<Product>(Assert.IsType<CreatedAtActionResult>(result.Result).Value);
        Assert.NotEqual(1, product.Id);                      // a new row, not product 1 overwritten
        Assert.Equal(0, product.Rating);
        Assert.Equal(0, product.RatingCount);
        Assert.InRange(product.CreatedAt, before, DateTime.UtcNow);
        Assert.Equal(899m, product.Mrp);                     // no MRP given = no discount
        Assert.Equal("Block Print Cotton Kurta Set", (await _data.Db.Products.FindAsync(1))!.Name);
    }

    [Fact]
    public async Task Update_changes_the_form_fields_and_keeps_rating_and_date()
    {
        var original = await _data.Db.Products.FindAsync(2);
        var (rating, count, created) = (original!.Rating, original.RatingCount, original.CreatedAt);
        _data.Db.ChangeTracker.Clear();

        var input = FromJson("""
            { "name": "Banarasi Silk Saree", "brand": "Kesar Lane", "category": "Sarees", "gender": "Women",
              "price": 2999, "mrp": 6599, "stock": 4, "sizes": [], "rating": 1, "createdAt": "2000-01-01T00:00:00Z" }
            """);

        Assert.IsType<NoContentResult>(await _controller.Update(2, input));

        _data.Db.ChangeTracker.Clear();
        var saved = (await _data.Db.Products.FindAsync(2))!;
        Assert.Equal("Banarasi Silk Saree", saved.Name);
        Assert.Equal(2999m, saved.Price);
        Assert.Equal(4, saved.Stock);
        Assert.Equal(rating, saved.Rating);
        Assert.Equal(count, saved.RatingCount);
        Assert.Equal(created, saved.CreatedAt, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public async Task Update_of_a_missing_product_is_not_found() =>
        Assert.IsType<NotFoundResult>(await _controller.Update(999, FromJson("""{ "name": "X1", "price": 10 }""")));

    [Fact]
    public void Input_keeps_the_price_and_MRP_rule()
    {
        var input = FromJson("""{ "name": "Kurta", "price": 1500, "mrp": 999, "stock": 1 }""");

        var errors = new List<ValidationResult>();
        var valid = Validator.TryValidateObject(input, new ValidationContext(input), errors, validateAllProperties: true);

        Assert.False(valid);
        var error = Assert.Single(errors);
        Assert.Equal("Price can't be higher than MRP.", error.ErrorMessage);
        Assert.Equal(["Price"], error.MemberNames);
    }
}

public class StoreControllerTests
{
    [Fact]
    public void Delivery_returns_the_rule_checkout_charges()
    {
        var info = new StoreController().Delivery();

        Assert.Equal(DeliveryRules.FreeFrom, info.FreeFrom);
        Assert.Equal(DeliveryRules.Fee, info.Fee);
    }
}
