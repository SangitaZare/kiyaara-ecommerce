using System.Net;
using System.Text;
using System.Text.Json;
using Kiyaara.Api.Assistant;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kiyaara.Api.Tests;

// The Gemini client against a fake HTTP connection: model fallback, errors and the request format.
public class GeminiLlmClientTests
{
    private readonly FakeGemini _gemini = new();

    private GeminiLlmClient Client(params string[] fallbacks)
    {
        var settings = new Dictionary<string, string?>
        {
            ["Gemini:ApiKey"] = "test-key",
            ["Gemini:Model"] = "main-model"
        };
        for (var i = 0; i < fallbacks.Length; i++) settings[$"Gemini:FallbackModels:{i}"] = fallbacks[i];

        var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var http = new HttpClient(_gemini) { BaseAddress = new Uri("https://gemini.test/v1beta/") };
        return new GeminiLlmClient(http, config, NullLogger<GeminiLlmClient>.Instance);
    }

    private static LlmRequest Hello() => new("You are a test.", [new LlmMessage { Role = "user", Text = "Hi" }]);

    private const string TextAnswer = """{ "candidates": [ { "content": { "parts": [ { "text": "Hello!" } ] } } ] }""";

    [Fact]
    public async Task Returns_the_text_answer_and_sends_the_api_key_header()
    {
        _gemini.Answer(HttpStatusCode.OK, TextAnswer);

        var response = await Client().GenerateAsync(Hello());

        Assert.Equal("Hello!", response.Text);
        Assert.Empty(response.ToolCalls);
        Assert.Equal("test-key", _gemini.ApiKeys.Single());
        Assert.Equal("main-model", _gemini.Models.Single());
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.TooManyRequests)]
    public async Task Tries_the_next_model_when_one_is_busy_or_out_of_quota(HttpStatusCode busy)
    {
        _gemini.Answer(busy, """{ "error": { "message": "busy" } }""");
        _gemini.Answer(HttpStatusCode.OK, TextAnswer);

        var response = await Client("backup-model").GenerateAsync(Hello());

        Assert.Equal("Hello!", response.Text);
        Assert.Equal(["main-model", "backup-model"], _gemini.Models);
    }

    [Fact]
    public async Task Does_not_try_other_models_for_a_bad_request()
    {
        _gemini.Answer(HttpStatusCode.BadRequest, """{ "error": { "message": "Invalid argument." } }""");

        var error = await Assert.ThrowsAsync<LlmException>(() => Client("backup-model").GenerateAsync(Hello()));

        Assert.Equal("Gemini returned 400. Invalid argument.", error.Message);
        Assert.Single(_gemini.Models);
    }

    [Fact]
    public async Task Reports_the_last_error_when_every_model_is_busy()
    {
        _gemini.Answer(HttpStatusCode.ServiceUnavailable, "{}");
        _gemini.Answer(HttpStatusCode.TooManyRequests, """{ "error": { "message": "Quota exceeded." } }""");

        var error = await Assert.ThrowsAsync<LlmException>(() => Client("backup-model").GenerateAsync(Hello()));

        Assert.StartsWith("Gemini rate limit reached.", error.Message);
        Assert.Equal(2, _gemini.Models.Count);
    }

    [Fact]
    public async Task Reads_tool_calls_with_their_thought_signature()
    {
        _gemini.Answer(HttpStatusCode.OK, """
            { "candidates": [ { "content": { "parts": [
                { "functionCall": { "name": "search_products", "args": { "q": "saree" } }, "thoughtSignature": "sig-123" }
            ] } } ] }
            """);

        var response = await Client().GenerateAsync(Hello());

        var call = Assert.Single(response.ToolCalls);
        Assert.Equal("search_products", call.Name);
        Assert.Equal("saree", call.Args.GetProperty("q").GetString());
        Assert.Equal("sig-123", call.Signature);
    }

    [Fact]
    public async Task Sends_signatures_back_and_groups_tool_results_in_one_turn()
    {
        _gemini.Answer(HttpStatusCode.OK, TextAnswer);
        var args = JsonDocument.Parse("{}").RootElement.Clone();
        var request = new LlmRequest("You are a test.",
        [
            new LlmMessage { Role = "user", Text = "Orders and sarees?" },
            new LlmMessage
            {
                Role = "assistant",
                ToolCalls = [new LlmToolCall("list_my_orders", args, "sig-a"), new LlmToolCall("search_products", args)]
            },
            new LlmMessage { Role = "tool", ToolName = "list_my_orders", ToolResultJson = """{ "count": 1 }""" },
            new LlmMessage { Role = "tool", ToolName = "search_products", ToolResultJson = """{ "total": 2 }""" }
        ]);

        await Client().GenerateAsync(request);

        var contents = _gemini.Bodies.Single().GetProperty("contents").EnumerateArray().ToList();
        Assert.Equal(3, contents.Count);                                   // user, model, one turn of results

        var modelParts = contents[1].GetProperty("parts").EnumerateArray().ToList();
        Assert.Equal("sig-a", modelParts[0].GetProperty("thoughtSignature").GetString());
        Assert.False(modelParts[1].TryGetProperty("thoughtSignature", out _));   // none given, none sent

        var results = contents[2].GetProperty("parts").EnumerateArray()
            .Select(p => p.GetProperty("functionResponse").GetProperty("name").GetString());
        Assert.Equal(["list_my_orders", "search_products"], results);
    }

    [Fact]
    public async Task Leaves_out_parameters_for_a_tool_that_takes_none()
    {
        _gemini.Answer(HttpStatusCode.OK, TextAnswer);

        await Client().GenerateAsync(Hello() with { Tools = AssistantTools.Definitions });

        var declarations = _gemini.Bodies.Single().GetProperty("tools")[0].GetProperty("functionDeclarations")
            .EnumerateArray().ToDictionary(d => d.GetProperty("name").GetString()!);
        Assert.False(declarations["list_my_orders"].TryGetProperty("parameters", out _));
        Assert.True(declarations["search_products"].GetProperty("parameters").GetProperty("properties")
            .TryGetProperty("maxPrice", out _));                          // names kept as written, not re-cased
    }

    [Fact]
    public async Task Explains_a_blocked_answer()
    {
        _gemini.Answer(HttpStatusCode.OK, """{ "candidates": [] }""");

        var error = await Assert.ThrowsAsync<LlmException>(() => Client().GenerateAsync(Hello()));

        Assert.Contains("no answer", error.Message);
    }

    private sealed class FakeGemini : HttpMessageHandler
    {
        private readonly Queue<(HttpStatusCode Status, string Body)> _answers = new();
        public List<string> Models { get; } = [];
        public List<string> ApiKeys { get; } = [];
        public List<JsonElement> Bodies { get; } = [];

        public void Answer(HttpStatusCode status, string body) => _answers.Enqueue((status, body));

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            // ".../models/main-model:generateContent" -> "main-model"
            Models.Add(request.RequestUri!.Segments[^1].Split(':')[0]);
            ApiKeys.Add(request.Headers.GetValues("x-goog-api-key").Single());
            Bodies.Add(JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct)).RootElement.Clone());

            var (status, body) = _answers.Dequeue();
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
