using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Day17MiddlewareCors.Services;

// The "Smtp" block in appsettings / user-secrets
public class SmtpSettings
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string User { get; set; } = string.Empty;       // your Gmail address
    public string Password { get; set; } = string.Empty;   // the 16-letter app password
    public string FromName { get; set; } = "Kiyaara";
}

public class SmtpEmailService(SmtpSettings settings) : IEmailService
{
    public async Task SendAsync(string to, string subject, string body)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.User));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(settings.Host, settings.Port, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(settings.User, settings.Password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);
    }
}