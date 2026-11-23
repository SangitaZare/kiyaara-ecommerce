using Kiyaara.Api.Data;
using Kiyaara.Api.Middleware;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Text.Json.Serialization;
using Kiyaara.Api.Assistant;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
var builder = WebApplication.CreateBuilder(args);

// ---------------- Services ----------------

const string AngularPolicy = "AllowAngularApp";

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .WithMethods("GET", "POST", "PUT", "DELETE")
              .WithHeaders("Content-Type", "Authorization");
    });
});
var seedDemoAccounts = builder.Environment.IsDevelopment();

// The SQL Server database (connection string "Kiyaara" in appsettings.json)
builder.Services.AddDbContext<KiyaaraDbContext>(options =>
    options.UseSqlServer(
               builder.Configuration.GetConnectionString("Kiyaara"),
               sql => sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
           .UseSeeding((context, _) => DatabaseSeeder.Seed(context, seedDemoAccounts))
.UseAsyncSeeding((context, _, cancellationToken) =>
    DatabaseSeeder.SeedAsync(context, seedDemoAccounts, cancellationToken)));

// 4B: login with JWT tokens
var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
if (jwt.Key.Length < 32)
    throw new InvalidOperationException("Jwt:Key in appsettings.json must be at least 32 characters long.");
JwtKeyGuard.EnsurePrivateKey(builder.Configuration, builder.Environment);   // outside Development: not the key in the repo

builder.Services.AddSingleton(jwt);
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<IPasswordHasher<Customer>, PasswordHasher<Customer>>();
builder.Services.AddScoped<OrderNotifier>();
var smtp = builder.Configuration.GetSection("Smtp").Get<SmtpSettings>() ?? new SmtpSettings();
builder.Services.AddSingleton(smtp);
if (string.IsNullOrWhiteSpace(smtp.User) || string.IsNullOrWhiteSpace(smtp.Password))
    builder.Services.AddScoped<IEmailService, ConsoleEmailService>();   // no settings: print to the console
else
    builder.Services.AddScoped<IEmailService, SmtpEmailService>();

// NEW (4D): saves uploaded product photos in wwwroot/uploads/products (one shared copy for the whole app)
builder.Services.AddSingleton<PhotoStorage>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;          // keep claim names as written: "sub", "email", "name"
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.SigningKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),   // allow for a small clock difference

            // (4C): which claims hold the name and the role, so [Authorize(Roles = "Admin")]
            // and User.IsInRole("Admin") read the "role" claim in our tokens
            NameClaimType = CustomerClaims.Name,
            RoleClaimType = CustomerClaims.Role
        };
    });
builder.Services.AddAuthorization();
// Rate limits: each visitor (by IP address) gets a fixed number of tries per time window
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Login, register, reset password: 10 tries per minute
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    // Forgot password sends an email, so it is stricter: 3 per 10 minutes
    options.AddPolicy("forgot", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0
            }));

    // AI assistant: every message costs Gemini quota, so each account gets 10 messages a minute.
    // Counted per logged-in user (from the token), so people sharing one Wi-Fi don't block each other.
    options.AddPolicy("assistant", httpContext =>
    {
        var customerId = httpContext.User.CustomerId();
        var key = customerId != 0
            ? $"user:{customerId}"
            : $"ip:{httpContext.Connection.RemoteIpAddress}";    // not logged in: [Authorize] answers 401 anyway
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });

    // Any 429 says why and how long to wait, so Angular can show a message instead of a blank error
    options.OnRejected = async (context, cancellationToken) =>
    {
        var message = "Too many requests. Please wait a moment and try again.";
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            var seconds = (int)Math.Ceiling(retryAfter.TotalSeconds);
            context.HttpContext.Response.Headers.RetryAfter = seconds.ToString();
            message = $"Too many requests. Please try again in {seconds} seconds.";
        }
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = message }, cancellationToken);
    };
});

// Enums travel as text ("Packed") in both directions, and numbers like 7 are refused
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        };
        document.Security =
        [
            new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = []
            }
        ];
        return Task.CompletedTask;
    });
});
builder.Services.AddHttpClient<ILlmClient, GeminiLlmClient>(client =>
{
    client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/v1beta/");
    client.Timeout = TimeSpan.FromSeconds(90);
});
builder.Services.AddScoped<ProductSearchService>();   // shop search, also used by the assistant
builder.Services.AddScoped<AssistantTools>();         // what the assistant can look up
var app = builder.Build();

// Create the database on the first run, apply new migrations, then seed what's missing
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<KiyaaraDbContext>().Database.Migrate();
}

// ---------------- Middleware pipeline (order matters) ----------------

// 1. Custom request logging - first, so it sees every request
app.UseRequestLogging();

// 2. OpenAPI document + Swagger UI (Development only)
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
        options.SwaggerEndpoint("/openapi/v1.json", "Kiyaara API v1"));
}

app.UseHttpsRedirection();

// NEW (4D): uploaded photos are plain files. A request for /uploads/products/3f9c2a7e.jpg is answered
// straight from the wwwroot/uploads folder, without reaching a controller. <img> tags don't need CORS.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(app.Services.GetRequiredService<PhotoStorage>().UploadsFolder),
    RequestPath = "/uploads"
});

// 3. CORS - before authentication, so even a 401 answer reaches Angular
app.UseCors(AngularPolicy);

// 4. Read the token (who is calling?), then check [Authorize] (are they allowed?)
app.UseAuthentication();

// 5. Rate limits - after authentication, so the "assistant" limit can count per user
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.Run();
