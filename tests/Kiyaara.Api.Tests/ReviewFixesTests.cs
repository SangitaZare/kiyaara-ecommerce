using Kiyaara.Api.Controllers;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Kiyaara.Api.Tests;

public class DeliveryRulesTests
{
    [Theory]
    [InlineData(0, 79)]
    [InlineData(998.99, 79)]
    [InlineData(999, 0)]
    [InlineData(5000, 0)]
    public void Charges_the_fee_only_below_the_free_delivery_amount(decimal subtotal, decimal fee) =>
        Assert.Equal(fee, DeliveryRules.FeeFor(subtotal));

    [Fact]
    public void Describes_the_rule_with_the_same_numbers_it_charges() =>
        Assert.Equal("Delivery is free from ₹999; below that it costs ₹79.", DeliveryRules.Describe());
}

public class TodayInIndiaTests
{
    [Theory]
    // 3:30 PM in India on the 23rd: today began at 18:30 UTC on the 22nd
    [InlineData("2026-11-23T10:00:00Z", "2026-11-22T18:30:00Z")]
    // 1:30 AM in India on the 24th, still the 23rd in UTC: today already began at 18:30 UTC on the 23rd
    [InlineData("2026-11-23T20:00:00Z", "2026-11-23T18:30:00Z")]
    // Exactly midnight in India
    [InlineData("2026-11-23T18:30:00Z", "2026-11-23T18:30:00Z")]
    // One minute before midnight in India: still the 23rd there
    [InlineData("2026-11-23T18:29:00Z", "2026-11-22T18:30:00Z")]
    public void Starts_the_day_at_midnight_in_India_whatever_the_server_clock(string utcNow, string expectedStart)
    {
        var now = DateTime.Parse(utcNow, null, System.Globalization.DateTimeStyles.AdjustToUniversal);

        var start = DashboardController.TodayInIndia.StartUtc(now);

        Assert.Equal(DateTime.Parse(expectedStart, null, System.Globalization.DateTimeStyles.AdjustToUniversal), start);
        Assert.Equal(DateTimeKind.Utc, start.Kind);
    }
}

public sealed class JwtKeyGuardTests : IDisposable
{
    private readonly string _folder = Directory.CreateTempSubdirectory("kiyaara-jwt-").FullName;

    public JwtKeyGuardTests() =>
        File.WriteAllText(Path.Combine(_folder, "appsettings.json"),
            """{ "Jwt": { "Key": "kiyaara-dev-only-secret-key-change-before-going-live-2026" } }""");

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    private IConfigurationRoot Config(string? privateKey = null)
    {
        var builder = new ConfigurationBuilder().SetBasePath(_folder).AddJsonFile("appsettings.json");
        if (privateKey is not null)
            builder.AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = privateKey });   // like Jwt__Key
        return builder.Build();
    }

    [Fact]
    public void Refuses_to_start_in_production_with_the_key_from_the_repository()
    {
        var error = Assert.Throws<InvalidOperationException>(() =>
            JwtKeyGuard.EnsurePrivateKey(Config(), new Env("Production")));

        Assert.Contains("appsettings.json", error.Message);
        Assert.Contains("Jwt__Key", error.Message);
    }

    [Fact]
    public void Starts_in_production_when_a_private_key_overrides_the_file() =>
        JwtKeyGuard.EnsurePrivateKey(Config(privateKey: new string('x', 48)), new Env("Production"));

    [Fact]
    public void Allows_the_demo_key_in_development() =>
        JwtKeyGuard.EnsurePrivateKey(Config(), new Env(Environments.Development));

    [Fact]
    public void Also_refuses_it_in_staging() =>
        Assert.Throws<InvalidOperationException>(() => JwtKeyGuard.EnsurePrivateKey(Config(), new Env("Staging")));

    private sealed class Env(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Kiyaara.Api";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
