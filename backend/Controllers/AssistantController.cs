using Day17MiddlewareCors.Assistant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Day17MiddlewareCors.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]                                   // logged-in users only, so strangers can't use your quota
public class AssistantController(ILlmClient llm) : ControllerBase
{
    public record PingRequest(string Message);

    // TEMPORARY (step 2): proves the Gemini connection works
    [HttpPost("ping")]
    public async Task<IActionResult> Ping(PingRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 500)
            return BadRequest(new { error = "Message must be 1 to 500 characters." });

        try
        {
            var reply = await llm.GenerateAsync(new LlmRequest(
                "You are the assistant for Kiyaara, an Indian fashion store. Reply briefly.",
                [new LlmMessage { Role = "user", Text = request.Message }]), ct);

            return Ok(new { reply = reply.Text });
        }
        catch (LlmException ex)
        {
            return StatusCode(502, new { error = ex.Message });
        }
    }
}