using System.Security.Claims;
using System.Text.Json;
using Kiyaara.Api.Assistant;
using Kiyaara.Api.Controllers;
using Kiyaara.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using static Kiyaara.Api.Controllers.AssistantController;

namespace Kiyaara.Api.Tests;

// The chat loop, with a scripted model instead of Gemini: no network, no quota.
public class AssistantControllerTests : IDisposable
{
    private readonly TestDatabase _data = new();
    private readonly FakeLlm _llm = new();
    private readonly AssistantController _controller;

    public AssistantControllerTests()
    {
        var tools = new AssistantTools(_data.Db, new ProductSearchService(_data.Db));
        _controller = new AssistantController(_llm, tools, NullLogger<AssistantController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(CustomerClaims.Id, TestDatabase.Priya.ToString())], "Test"))
                }
            }
        };
    }

    public void Dispose() => _data.Dispose();

    private static ChatRequest Ask(params (string Role, string Text)[] messages) => new()
    {
        Messages = messages.Select(m => new ChatMessage { Role = m.Role, Text = m.Text }).ToList()
    };

    private static string ReplyOf(ActionResult<ChatResponse> result) =>
        Assert.IsType<ChatResponse>(Assert.IsType<OkObjectResult>(result.Result).Value).Reply;

    [Fact]
    public async Task Runs_the_tool_the_model_asks_for_and_returns_its_answer()
    {
        _llm.Script(
            Calls(("get_my_order", """{ "orderNumber": "KY-1003" }""")),
            Text("Your order KY-1003 is packed."));

        var result = await _controller.Chat(Ask(("user", "Where is my order?")), default);

        Assert.Equal("Your order KY-1003 is packed.", ReplyOf(result));

        // The second request carried the tool's answer back to the model
        var second = _llm.Requests[1];
        var toolTurn = second.Messages.Single(m => m.Role == "tool");
        Assert.Equal("get_my_order", toolTurn.ToolName);
        Assert.Contains("\"status\":\"Packed\"", toolTurn.ToolResultJson);
    }

    [Fact]
    public async Task Tool_results_use_the_logged_in_customer_not_the_model()
    {
        _llm.Script(
            Calls(("get_my_order", """{ "orderNumber": "KY-1001" }""")),   // Arjun's order
            Text("I couldn't find that order."));

        await _controller.Chat(Ask(("user", "Show me KY-1001")), default);

        var toolTurn = _llm.Requests[1].Messages.Single(m => m.Role == "tool");
        Assert.Contains("No order KY-1001 was found", toolTurn.ToolResultJson);
    }

    [Fact]
    public async Task Sends_the_conversation_history_and_the_tools()
    {
        _llm.Script(Text("It costs ₹3,299."));

        await _controller.Chat(Ask(
            ("user", "Any sarees?"),
            ("assistant", "Yes, the Banarasi saree."),
            ("user", "How much is it?")), default);

        var request = Assert.Single(_llm.Requests);
        Assert.Equal(["user", "assistant", "user"], request.Messages.Select(m => m.Role));
        Assert.Equal(AssistantTools.Definitions.Count, request.Tools!.Count);
    }

    [Fact]
    public async Task Rejects_a_conversation_that_does_not_end_with_the_user()
    {
        var result = await _controller.Chat(Ask(("user", "Hi"), ("assistant", "Hello!")), default);

        Assert.IsType<ObjectResult>(result.Result);          // ValidationProblem
        Assert.Empty(_llm.Requests);
    }

    [Fact]
    public async Task Stops_offering_tools_after_five_rounds_so_the_model_must_answer()
    {
        // A model that keeps asking for tools whenever it is allowed to
        _llm.Script(Enumerable.Repeat(Calls(("list_my_orders", "{}")), 5)
            .Append(Text("Here is what I found.")).ToArray());

        var result = await _controller.Chat(Ask(("user", "Orders?")), default);

        Assert.Equal("Here is what I found.", ReplyOf(result));
        Assert.Equal(6, _llm.Requests.Count);
        Assert.Null(_llm.Requests[^1].Tools);
    }

    [Fact]
    public async Task Hides_provider_errors_from_the_browser()
    {
        _llm.FailWith("Gemini returned 429. Quota exceeded, see billing at https://example.test");

        var result = await _controller.Chat(Ask(("user", "Hi")), default);

        var error = Assert.IsType<ObjectResult>(result.Result);
        Assert.Equal(StatusCodes.Status502BadGateway, error.StatusCode);
        var body = JsonSerializer.Serialize(error.Value);
        Assert.DoesNotContain("billing", body);
        Assert.DoesNotContain("429", body);
    }

    [Fact]
    public async Task Answers_politely_when_the_model_returns_no_text()
    {
        _llm.Script(new LlmResponse(null, []));

        var reply = ReplyOf(await _controller.Chat(Ask(("user", "Hi")), default));

        Assert.StartsWith("Sorry", reply);
    }

    [Fact]
    public async Task Keeps_only_the_last_twenty_messages_starting_with_the_user()
    {
        _llm.Script(Text("ok"));
        var messages = Enumerable.Range(0, 25)
            .Select(i => (i % 2 == 0 ? "user" : "assistant", $"message {i}"))
            .ToArray();                                       // 25 messages, ending with the user

        await _controller.Chat(Ask(messages), default);

        var sent = _llm.Requests[0].Messages;
        Assert.True(sent.Count <= 20);
        Assert.Equal("user", sent[0].Role);
        Assert.Equal("message 24", sent[^1].Text);
    }

    // ---------------- Helpers ----------------

    private static LlmResponse Text(string text) => new(text, []);

    private static LlmResponse Calls(params (string Name, string Args)[] calls) =>
        new(null, calls.Select(c => new LlmToolCall(c.Name, JsonDocument.Parse(c.Args).RootElement.Clone())).ToList());

    private sealed class FakeLlm : ILlmClient
    {
        private readonly Queue<LlmResponse> _answers = new();
        private string? _failure;
        public List<LlmRequest> Requests { get; } = [];

        public void Script(params LlmResponse[] answers)
        {
            foreach (var answer in answers) _answers.Enqueue(answer);
        }

        public void FailWith(string message) => _failure = message;

        public Task<LlmResponse> GenerateAsync(LlmRequest request, CancellationToken ct = default)
        {
            // Copy the messages: the controller keeps adding to the same list
            Requests.Add(request with { Messages = request.Messages.ToList() });
            if (_failure is not null) throw new LlmException(_failure);
            return Task.FromResult(_answers.Dequeue());
        }
    }
}
