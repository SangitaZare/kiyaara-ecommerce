using System.Text.Json;

namespace Kiyaara.Api.Assistant;

// The one door to any model. Gemini today, Claude or another provider later.
public interface ILlmClient
{
    // The whole answer at once
    Task<LlmResponse> GenerateAsync(LlmRequest request, CancellationToken ct = default);

    // The answer piece by piece as the model writes it: text in small parts, tool calls whole.
    // Problems before or during the answer come out as LlmException.
    IAsyncEnumerable<LlmStreamChunk> StreamAsync(LlmRequest request, CancellationToken ct = default);
}

// One piece of a streamed answer: either some new text or one complete tool call
public record LlmStreamChunk(string? Text = null, LlmToolCall? ToolCall = null);

public record LlmToolDefinition(string Name, string Description, object? Parameters = null);   // null = takes no input
// Signature: an opaque token some providers attach to a call (Gemini's "thoughtSignature").
// It must be sent back unchanged with the call in the next request, or the provider refuses it.
public record LlmToolCall(string Name, JsonElement Args, string? Signature = null);
public record LlmRequest(string SystemPrompt, List<LlmMessage> Messages, List<LlmToolDefinition>? Tools = null);
public record LlmResponse(string? Text, List<LlmToolCall> ToolCalls);

public class LlmMessage
{
    public required string Role { get; init; }            // "user", "assistant" or "tool"
    public string? Text { get; init; }
    public List<LlmToolCall>? ToolCalls { get; init; }    // set on an assistant message that asked for tools
    public string? ToolName { get; init; }                // set on a tool message (the answer to a tool call)
    public string? ToolResultJson { get; init; }
}

public class LlmException(string message) : Exception(message);