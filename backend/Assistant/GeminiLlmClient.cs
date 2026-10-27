using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Day17MiddlewareCors.Assistant;

public class GeminiLlmClient(HttpClient http, IConfiguration config) : ILlmClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<LlmResponse> GenerateAsync(LlmRequest request, CancellationToken ct = default)
    {
        var apiKey = config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini:ApiKey is missing. Set it with dotnet user-secrets.");
        var model = config["Gemini:Model"] ?? "gemini-2.5-flash";

        var body = new
        {
            systemInstruction = new { parts = new[] { new { text = request.SystemPrompt } } },
            contents = request.Messages.Select(ToGeminiContent).ToList(),
            tools = request.Tools is { Count: > 0 }
                ? new[] { new { functionDeclarations = request.Tools
                    .Select(tool => new { name = tool.Name, description = tool.Description, parameters = tool.Parameters })
                    .ToList() } }
                : null,
            generationConfig = new { temperature = 0.2, thinkingConfig = new { thinkingLevel = "low" } }
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"models/{model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json")
        };
        httpRequest.Headers.Add("x-goog-api-key", apiKey);
        using var response = await SendAsync(httpRequest, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new LlmException(DescribeError(response.StatusCode, json));

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            throw new LlmException("The model returned no answer. It may have blocked the request.");

        var text = new StringBuilder();
        var calls = new List<LlmToolCall>();

        if (candidates[0].TryGetProperty("content", out var content) &&
            content.TryGetProperty("parts", out var parts))
        {
            foreach (var part in parts.EnumerateArray())
            {
                if (part.TryGetProperty("text", out var textPart) && textPart.ValueKind == JsonValueKind.String)
                    text.Append(textPart.GetString());

                if (part.TryGetProperty("functionCall", out var call))
                {
                    var args = call.TryGetProperty("args", out var a)
                        ? a.Clone()
                        : JsonSerializer.Deserialize<JsonElement>("{}");
                    calls.Add(new LlmToolCall(call.GetProperty("name").GetString()!, args));
                }
            }
        }

        return new LlmResponse(text.Length > 0 ? text.ToString() : null, calls);
    }

    // Our neutral message turns into Gemini's format here, and only here.
    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try
        {
            return await http.SendAsync(request, ct);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new LlmException("Gemini took too long to answer. Try again in a moment.");
        }
        catch (HttpRequestException ex)
        {
            throw new LlmException($"Could not reach Gemini: {ex.Message}");
        }
    }
    private static object ToGeminiContent(LlmMessage m)
    {
        if (m.Role == "assistant")
        {
            var parts = new List<object>();
            if (!string.IsNullOrEmpty(m.Text)) parts.Add(new { text = m.Text });
            if (m.ToolCalls is not null)
                foreach (var call in m.ToolCalls)
                    parts.Add(new { functionCall = new { name = call.Name, args = call.Args } });
            return new { role = "model", parts };
        }

        if (m.Role == "tool")
        {
            var result = JsonSerializer.Deserialize<JsonElement>(m.ToolResultJson ?? "{}");
            return new
            {
                role = "user",
                parts = new[] { new { functionResponse = new { name = m.ToolName, response = new { result } } } }
            };
        }

        return new { role = "user", parts = new[] { new { text = m.Text } } };
    }

    private static string DescribeError(HttpStatusCode status, string body)
    {
        string? detail = null;
        try
        {
            using var d = JsonDocument.Parse(body);
            detail = d.RootElement.GetProperty("error").GetProperty("message").GetString();
        }
        catch { /* body wasn't the usual error shape */ }

        var prefix = status == HttpStatusCode.TooManyRequests
            ? "Gemini rate limit reached. Wait a minute and try again."
            : $"Gemini returned {(int)status}.";
        return detail is null ? prefix : $"{prefix} {detail}";
    }
}