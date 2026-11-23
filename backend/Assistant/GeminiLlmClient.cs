using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Kiyaara.Api.Assistant;

public class GeminiLlmClient(HttpClient http, IConfiguration config, ILogger<GeminiLlmClient> logger) : ILlmClient
{
    private static readonly TimeSpan AttemptTimeout = TimeSpan.FromSeconds(25);   // per model, before trying the next
    private static readonly TimeSpan StreamIdleTimeout = TimeSpan.FromSeconds(30); // silence allowed mid-answer

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    // ---------------- The whole answer at once ----------------

    public async Task<LlmResponse> GenerateAsync(LlmRequest request, CancellationToken ct = default)
    {
        using var response = await SendWithFallbackAsync(request, stream: false, ct);
        var json = await response.Content.ReadAsStringAsync(ct);

        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            throw new LlmException("The model returned no answer. It may have blocked the request.");

        var text = new StringBuilder();
        var calls = new List<LlmToolCall>();
        foreach (var chunk in ReadParts(doc.RootElement))
        {
            if (chunk.Text is not null) text.Append(chunk.Text);
            if (chunk.ToolCall is not null) calls.Add(chunk.ToolCall);
        }

        return new LlmResponse(text.Length > 0 ? text.ToString() : null, calls);
    }

    // ---------------- The answer piece by piece ----------------

    // Gemini's streaming mode sends Server-Sent Events: "data: {json}" lines, one small answer each.
    // Backup models are only tried before the first piece arrives; after that the answer can't switch.
    public async IAsyncEnumerable<LlmStreamChunk> StreamAsync(LlmRequest request,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var response = await SendWithFallbackAsync(request, stream: true, ct);
        await using var body = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(body, Encoding.UTF8);
        using var idle = CancellationTokenSource.CreateLinkedTokenSource(ct);

        var anything = false;
        var data = new StringBuilder();

        while (true)
        {
            var line = await ReadLineAsync(reader, idle, ct);

            // A blank line (or the end) finishes one event
            if (string.IsNullOrEmpty(line))
            {
                if (data.Length > 0)
                {
                    foreach (var chunk in ReadEvent(data.ToString()))
                    {
                        anything = true;
                        yield return chunk;
                    }
                    data.Clear();
                }
                if (line is null) break;
                continue;
            }

            if (line.StartsWith("data:", StringComparison.Ordinal))
                data.Append(line.AsSpan(5).TrimStart());
        }

        if (!anything)
            throw new LlmException("The model returned no answer. It may have blocked the request.");
    }

    private static IEnumerable<LlmStreamChunk> ReadEvent(string json)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(json);
        }
        catch (JsonException)
        {
            throw new LlmException("Gemini sent a piece of the answer that could not be read.");
        }

        using var _ = doc;
        var root = doc.RootElement;

        if (root.TryGetProperty("error", out var error))
            throw new LlmException($"Gemini stopped mid-answer. {error.GetProperty("message").GetString()}");

        // ToList: the chunks must be read before the document is disposed
        return ReadParts(root).ToList();
    }

    // Reads one line, waiting at most StreamIdleTimeout. Network problems become LlmException.
    private static async Task<string?> ReadLineAsync(StreamReader reader, CancellationTokenSource idle, CancellationToken ct)
    {
        idle.CancelAfter(StreamIdleTimeout);
        try
        {
            return await reader.ReadLineAsync(idle.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new LlmException("Gemini stopped answering part way through. Try again in a moment.");
        }
        catch (Exception ex) when (ex is IOException or HttpRequestException)
        {
            throw new LlmException($"The connection to Gemini broke: {ex.Message}");
        }
    }

    // ---------------- Shared ----------------

    // Sends the request to the main model, then the backups when one is busy (503), out of quota (429)
    // or silent for AttemptTimeout. Returns the first successful response; the caller disposes it.
    private async Task<HttpResponseMessage> SendWithFallbackAsync(LlmRequest request, bool stream, CancellationToken ct)
    {
        var apiKey = config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Gemini:ApiKey is missing. Set it with dotnet user-secrets.");

        var models = new[] { config["Gemini:Model"] ?? "gemini-3.6-flash" }
            .Concat(config.GetSection("Gemini:FallbackModels").Get<string[]>() ?? [])
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct()
            .ToList();

        var payload = JsonSerializer.Serialize(BuildBody(request), JsonOptions);
        var method = stream ? "streamGenerateContent?alt=sse" : "generateContent";

        for (var i = 0; i < models.Count; i++)
        {
            var lastModel = i == models.Count - 1;

            var httpRequest = new HttpRequestMessage(HttpMethod.Post, $"models/{models[i]}:{method}")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json")
            };
            httpRequest.Headers.Add("x-goog-api-key", apiKey);

            // Each model gets a limited time to start answering: a busy model sometimes hangs instead of 503
            using var attempt = CancellationTokenSource.CreateLinkedTokenSource(ct);
            attempt.CancelAfter(AttemptTimeout);

            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, attempt.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                httpRequest.Dispose();
                if (lastModel) throw new LlmException("Gemini took too long to answer. Try again in a moment.");
                logger.LogWarning("Gemini model {Model} did not answer in {Seconds}s; trying {Next}",
                    models[i], AttemptTimeout.TotalSeconds, models[i + 1]);
                continue;
            }
            catch (HttpRequestException ex)
            {
                httpRequest.Dispose();
                throw new LlmException($"Could not reach Gemini: {ex.Message}");
            }

            if (response.IsSuccessStatusCode) return response;

            var status = response.StatusCode;
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            response.Dispose();

            // 503 = "high demand" on that model; 429 = that model's quota is used up (free tier counts
            // per model). Either way the next model usually still has room.
            var tryNext = status is HttpStatusCode.ServiceUnavailable or HttpStatusCode.TooManyRequests;
            if (!tryNext || lastModel)
                throw new LlmException(DescribeError(status, errorBody));

            logger.LogWarning("Gemini model {Model} answered {Status}; trying {Next}", models[i], (int)status, models[i + 1]);
        }

        throw new LlmException("No Gemini model is configured.");   // only when the model list is empty
    }

    private static object BuildBody(LlmRequest request) => new
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

    // The text and tool calls in one Gemini answer (or one streamed piece of it)
    private static IEnumerable<LlmStreamChunk> ReadParts(JsonElement root)
    {
        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0) yield break;
        if (!candidates[0].TryGetProperty("content", out var content) ||
            !content.TryGetProperty("parts", out var parts)) yield break;

        foreach (var part in parts.EnumerateArray())
        {
            if (part.TryGetProperty("text", out var textPart) && textPart.ValueKind == JsonValueKind.String
                && textPart.GetString() is { Length: > 0 } text)
                yield return new LlmStreamChunk(Text: text);

            if (part.TryGetProperty("functionCall", out var call))
            {
                var args = call.TryGetProperty("args", out var a)
                    ? a.Clone()
                    : JsonSerializer.Deserialize<JsonElement>("{}");
                var signature = part.TryGetProperty("thoughtSignature", out var sig) && sig.ValueKind == JsonValueKind.String
                    ? sig.GetString()
                    : null;
                yield return new LlmStreamChunk(ToolCall: new LlmToolCall(call.GetProperty("name").GetString()!, args, signature));
            }
        }
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
