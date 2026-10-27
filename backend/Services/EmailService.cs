namespace Day17MiddlewareCors.Services;

// Everything in the API sends email through this one interface.
// Today it is ConsoleEmailService; later a real sender (Gmail, Brevo, Resend) replaces it
// with one line in Program.cs, and nothing else changes.
public interface IEmailService
{
    Task SendAsync(string to, string subject, string body);
}

// Development only: prints the email in the API's console window instead of sending it
public class ConsoleEmailService(ILogger<ConsoleEmailService> logger) : IEmailService
{
    public Task SendAsync(string to, string subject, string body)
    {
        logger.LogWarning(
            "\n========== EMAIL (not really sent) ==========\nTo:      {To}\nSubject: {Subject}\n\n{Body}\n=============================================",
            to, subject, body);
        return Task.CompletedTask;
    }
}