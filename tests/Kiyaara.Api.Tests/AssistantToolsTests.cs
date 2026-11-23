using System.Text.Json;
using Kiyaara.Api.Assistant;
using Kiyaara.Api.Services;

namespace Kiyaara.Api.Tests;

public class AssistantToolsTests : IDisposable
{
    private readonly TestDatabase _data = new();
    private readonly AssistantTools _tools;

    public AssistantToolsTests() =>
        _tools = new AssistantTools(_data.Db, new ProductSearchService(_data.Db));

    public void Dispose() => _data.Dispose();

    private async Task<JsonElement> Run(string tool, string argsJson = "{}", int customerId = TestDatabase.Priya)
    {
        var call = new LlmToolCall(tool, JsonDocument.Parse(argsJson).RootElement.Clone());
        var json = await _tools.ExecuteAsync(call, customerId);
        return JsonDocument.Parse(json).RootElement.Clone();
    }

    private static string? Error(JsonElement result) =>
        result.TryGetProperty("error", out var e) ? e.GetString() : null;

    // ---------------- Orders: a customer only ever sees their own ----------------

    [Fact]
    public async Task GetMyOrder_returns_the_customers_own_order()
    {
        var result = await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "KY-1003" }""");

        Assert.Null(Error(result));
        Assert.Equal("KY-1003", result.GetProperty("orderNumber").GetString());
        Assert.Equal("Packed", result.GetProperty("status").GetString());
        Assert.True(result.GetProperty("canCancel").GetBoolean());
    }

    [Fact]
    public async Task GetMyOrder_hides_another_customers_order_as_not_found()
    {
        var result = await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "KY-1001" }""");   // Arjun's

        Assert.Equal("No order KY-1001 was found on this account.", Error(result));
        Assert.False(result.TryGetProperty("items", out _));
    }

    [Fact]
    public async Task GetMyOrder_answers_the_same_for_someone_elses_order_and_a_missing_one()
    {
        var someoneElses = Error(await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "1001" }"""));
        var missing = Error(await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "1999" }"""));

        // Only the number differs, so nobody can tell which order numbers exist
        Assert.Equal(someoneElses!.Replace("1001", "N"), missing!.Replace("1999", "N"));
    }

    [Theory]
    [InlineData("KY-1003")]
    [InlineData("ky-1003")]
    [InlineData("1003")]
    [InlineData("KY1003")]
    public async Task GetMyOrder_accepts_the_order_number_in_several_forms(string orderNumber)
    {
        var result = await Run(AssistantTools.GetMyOrder, JsonSerializer.Serialize(new { orderNumber }));

        Assert.Equal("KY-1003", result.GetProperty("orderNumber").GetString());
    }

    [Fact]
    public async Task GetMyOrder_sends_no_name_phone_or_street_to_the_model()
    {
        var json = (await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "KY-1003" }""")).GetRawText();

        Assert.DoesNotContain("Priya", json);
        Assert.DoesNotContain("9876543210", json);
        Assert.DoesNotContain("Rose Villa", json);
        Assert.DoesNotContain("MG Road", json);
        Assert.Contains("Kochi, Kerala 682001", json);
    }

    [Fact]
    public async Task ListMyOrders_returns_only_the_customers_orders_newest_first()
    {
        var result = await Run(AssistantTools.ListMyOrders);

        var numbers = result.GetProperty("orders").EnumerateArray()
            .Select(o => o.GetProperty("orderNumber").GetString())
            .ToList();
        Assert.Equal(["KY-1003", "KY-1002"], numbers);
    }

    [Fact]
    public async Task Order_tools_refuse_when_nobody_is_logged_in()
    {
        Assert.NotNull(Error(await Run(AssistantTools.ListMyOrders, customerId: 0)));
        Assert.NotNull(Error(await Run(AssistantTools.GetMyOrder, """{ "orderNumber": "KY-1003" }""", customerId: 0)));
    }

    [Fact]
    public async Task The_model_cannot_pick_whose_orders_to_read()
    {
        // A customerId in the arguments is ignored: the id always comes from the login
        var result = await Run(AssistantTools.ListMyOrders, """{ "customerId": 2 }""");

        var numbers = result.GetProperty("orders").EnumerateArray().Select(o => o.GetProperty("orderNumber").GetString());
        Assert.DoesNotContain("KY-1001", numbers);
    }

    // ---------------- Products ----------------

    [Fact]
    public async Task SearchProducts_combines_filters()
    {
        var result = await Run(AssistantTools.SearchProducts,
            """{ "gender": "Women", "maxPrice": 2000, "size": "m", "inStock": true }""");

        var products = result.GetProperty("products").EnumerateArray().ToList();
        var only = Assert.Single(products);
        Assert.Equal(1, only.GetProperty("id").GetInt32());
        Assert.Equal("/product/1", only.GetProperty("url").GetString());
    }

    [Fact]
    public async Task SearchProducts_inStock_hides_sold_out_items()
    {
        var all = await Run(AssistantTools.SearchProducts, """{ "category": "Shirts" }""");
        var inStock = await Run(AssistantTools.SearchProducts, """{ "category": "Shirts", "inStock": true }""");

        Assert.Equal(1, all.GetProperty("total").GetInt32());
        Assert.Equal(0, inStock.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task SearchProducts_accepts_numbers_and_booleans_sent_as_text()
    {
        var result = await Run(AssistantTools.SearchProducts, """{ "maxPrice": "1000", "inStock": "true" }""");

        var ids = result.GetProperty("products").EnumerateArray().Select(p => p.GetProperty("id").GetInt32());
        Assert.Equal([4], ids);
    }

    [Fact]
    public async Task SearchProducts_rejects_a_min_price_above_the_max_price()
    {
        var result = await Run(AssistantTools.SearchProducts, """{ "minPrice": 3000, "maxPrice": 1000 }""");

        Assert.Equal("minPrice can't be higher than maxPrice.", Error(result));
    }

    [Fact]
    public async Task GetProduct_returns_details_or_a_clear_error()
    {
        var found = await Run(AssistantTools.GetProduct, """{ "id": 2 }""");
        var missing = await Run(AssistantTools.GetProduct, """{ "id": 999 }""");
        var bad = await Run(AssistantTools.GetProduct, """{ "id": "two" }""");

        Assert.Equal("Banarasi Silk Blend Saree", found.GetProperty("name").GetString());
        Assert.Equal("No product has id 999.", Error(missing));
        Assert.Equal("Give the product id as a number.", Error(bad));
    }

    [Fact]
    public async Task Unknown_tools_answer_with_an_error_instead_of_crashing()
    {
        var result = await Run("delete_everything");

        Assert.Equal("Unknown tool \"delete_everything\".", Error(result));
    }

    // ---------------- Product cards ----------------

    [Fact]
    public async Task Cards_follow_the_products_linked_in_the_reply_in_order()
    {
        var cards = await _tools.CardsForReplyAsync(
            "Try the [Saree](/product/2), the [Kurta Set](/product/1) or the [Saree](/product/2) again.");

        Assert.Equal([2, 1], cards.Select(c => c.Id));
        Assert.Equal("Banarasi Silk Blend Saree", cards[0].Name);
    }

    [Fact]
    public async Task Cards_use_database_prices_not_the_replys_text()
    {
        var card = Assert.Single(await _tools.CardsForReplyAsync("[A bargain at ₹10](/product/1)"));

        Assert.Equal(1499m, card.Price);
        Assert.Equal(2999m, card.Mrp);
        Assert.True(card.InStock);
    }

    [Fact]
    public async Task Cards_mark_sold_out_products_and_skip_missing_ones()
    {
        var cards = await _tools.CardsForReplyAsync("[Shirt](/product/3) and [Gone](/product/999)");

        var shirt = Assert.Single(cards);
        Assert.False(shirt.InStock);
    }

    [Fact]
    public async Task Cards_ignore_order_links_and_text_without_links()
    {
        Assert.Empty(await _tools.CardsForReplyAsync("Your order [KY-1003](/order/1003) is packed. Product 2 is nice."));
    }

    [Fact]
    public async Task Cards_stop_at_the_first_six_products()
    {
        // Six more products, so ten exist
        _data.Db.Products.AddRange(Enumerable.Range(5, 6).Select(id => new Models.Product
        {
            Id = id, Name = $"Extra {id}", Brand = "Test Brand", Category = "Tops", Gender = "Women", Price = 499, Mrp = 999, Stock = 3
        }));
        await _data.Db.SaveChangesAsync();

        var reply = string.Join(", ", Enumerable.Range(1, 10).Select(i => $"[P{i}](/product/{i})"));
        var cards = await _tools.CardsForReplyAsync(reply);

        Assert.Equal([1, 2, 3, 4, 5, 6], cards.Select(c => c.Id));
    }

    [Fact]
    public void Every_definition_has_a_name_the_tools_can_run()
    {
        var names = AssistantTools.Definitions.Select(d => d.Name).ToList();

        Assert.Equal(
            [AssistantTools.SearchProducts, AssistantTools.GetProduct, AssistantTools.ListMyOrders, AssistantTools.GetMyOrder],
            names);
    }
}
