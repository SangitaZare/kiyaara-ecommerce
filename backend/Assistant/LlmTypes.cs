using System.Text.Json;

namespace Day17MiddlewareCors.Assistant;

// The one door to any model. Gemini today, Claude or another provider later.
public interface ILlmClient
{
    Task<LlmResponse> GenerateAsync(LlmRequest request, CancellationToken ct = default);
}

public record LlmToolDefinition(string Name, string Description, object Parameters);
public record LlmToolCall(string Name, JsonElement Args);
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