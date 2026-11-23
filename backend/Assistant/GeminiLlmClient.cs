using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Kiyaara.Api.Assistant;

public class GeminiLlmClient(HttpClient http, IConfiguration config, ILogger<GeminiLlmClient> logger) : ILlmClient
{
    private static readonly TimeSpan AttemptTimeout = TimeSpan.FromSeconds(25);   // per model, before trying the next

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
        // The main model first, then the backups, tried in order when one is overloaded
        var models = new[] { config["Gemini:Model"] ?? "gemini-3.6-flash" }
            .Concat(config.GetSection("Gemini:FallbackModels").Get<string[]>() ?? [])
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct()
            .ToList();

        var body = new
        {
            systemInstruction = new { parts = new[] { new { text = request.SystemPrompt } } },
            contents = ToGeminiContents(request.Messages),
            tools = request.Tools is { Count: > 0 }
                ? new[] { new { functionDeclarations = request.Tools
                    .Select(tool => new { name = tool.Name, description = tool.Description, parameters = tool.Parameters })
                    .ToList() } }
                : null,
            generationConfig = new { temperature = 0.2, thinkingConfig = new { thinkingLevel = "low" } }
        };

        var payload = JsonSerializer.Serialize(body, JsonOptions);
        string json = "";

        for (var i = 0; i < models.Count; i++)
        {
            var lastModel = i == models.Count - 1;

            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"models/{models[i]}:generateContent")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Add("x-goog-api-key", apiKey);

            // Each model gets a limited time: a busy model sometimes hangs instead of answering 503
            using var attempt = CancellationTokenSource.CreateLinkedTokenSource(ct);
            attempt.CancelAfter(AttemptTimeout);

            HttpStatusCode status;
            try
            {
                using var response = await http.SendAsync(httpRequest, attempt.Token);
                json = await response.Content.ReadAsStringAsync(attempt.Token);
                status = response.StatusCode;
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                if (lastModel) throw new LlmException("Gemini took too long to answer. Try again in a moment.");
                logger.LogWarning("Gemini model {Model} did not answer in {Seconds}s; trying {Next}",
                    models[i], AttemptTimeout.TotalSeconds, models[i + 1]);
                continue;
            }
            catch (HttpRequestException ex)
            {
                throw new LlmException($"Could not reach Gemini: {ex.Message}");
            }

            if ((int)status is >= 200 and < 300) break;

            // 503 = "high demand" on that model; 429 = that model's quota is used up (free tier counts
            // per model). Either way the next model usually still has room.
            var tryNext = status is HttpStatusCode.ServiceUnavailable or HttpStatusCode.TooManyRequests;
            if (!tryNext || lastModel)
                throw new LlmException(DescribeError(status, json));

            logger.LogWarning("Gemini model {Model} answered {Status}; trying {Next}", models[i], (int)status, models[i + 1]);
        }

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
                    var signature = part.TryGetProperty("thoughtSignature", out var sig) && sig.ValueKind == JsonValueKind.String
                        ? sig.GetString()
                        : null;
                    calls.Add(new LlmToolCall(call.GetProperty("name").GetString()!, args, signature));
                }
            }
        }

        return new LlmResponse(text.Length > 0 ? text.ToString() : null, calls);
    }

    // Our neutral messages turn into Gemini's format here, and only here.
    private static List<object> ToGeminiContents(List<LlmMessage> messages)
    {
        var contents = new List<object>();
        for (var i = 0; i < messages.Count; i++)
        {
            var m = messages[i];

            if (m.Role == "assistant")
            {
                var parts = new List<object>();
                if (!string.IsNullOrEmpty(m.Text)) parts.Add(new { text = m.Text });
                if (m.ToolCalls is not null)
                    foreach (var call in m.ToolCalls)
                        parts.Add(new
                        {
                            functionCall = new { name = call.Name, args = call.Args },
                            thoughtSignature = call.Signature        // left out when null
                        });
                contents.Add(new { role = "model", parts });
            }
            else if (m.Role == "tool")
            {
                // Answers to several calls from one turn go back together, in one content
                var parts = new List<object>();
                for (; i < messages.Count && messages[i].Role == "tool"; i++)
                {
                    var result = JsonSerializer.Deserialize<JsonElement>(messages[i].ToolResultJson ?? "{}");
                    parts.Add(new { functionResponse = new { name = messages[i].ToolName, response = new { result } } });
                }
                i--;                                                  // the for loop moves past the last one
                contents.Add(new { role = "user", parts });
            }
            else
            {
                contents.Add(new { role = "user", parts = new[] { new { text = m.Text } } });
            }
        }
        return contents;
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