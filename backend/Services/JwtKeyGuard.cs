using Microsoft.Extensions.Configuration;

namespace Kiyaara.Api.Services;

// The JWT key signs every login token. Anyone who knows it can make their own token, including an
// admin one. The appsettings*.json files are in the Git repository, so a key read from them is public.
//
// In Development that's fine (the demo key). Anywhere else the app refuses to start until Jwt:Key
// comes from somewhere private: an environment variable (Jwt__Key), user secrets, or a key vault.
public static class JwtKeyGuard
{
    public static void EnsurePrivateKey(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment()) return;

        var source = WhereKeyComesFrom(configuration);
        if (source is not null)
            throw new InvalidOperationException(
                $"Jwt:Key is read from {source}, which is in the Git repository, so anyone could sign their own " +
                $"login tokens. Set a private key of at least 32 random characters in the '{environment.EnvironmentName}' " +
                "environment, for example the environment variable Jwt__Key.");
    }

    // The appsettings file the key comes from, or null when it comes from somewhere else.
    // Later providers win, so the last one that has the key is the one in use.
    private static string? WhereKeyComesFrom(IConfiguration configuration)
    {
        if (configuration is not IConfigurationRoot root) return null;

        var provider = root.Providers.LastOrDefault(p => p.TryGet("Jwt:Key", out var value) && !string.IsNullOrEmpty(value));
        return provider is FileConfigurationProvider { Source.Path: { } path }
               && Path.GetFileName(path).StartsWith("appsettings", StringComparison.OrdinalIgnoreCase)
            ? Path.GetFileName(path)
            : null;
    }
}
