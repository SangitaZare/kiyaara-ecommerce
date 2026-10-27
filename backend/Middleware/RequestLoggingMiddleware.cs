using System.Diagnostics;

namespace Day17MiddlewareCors.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var request = context.Request;

        // BEFORE: runs when the request comes in
        _logger.LogInformation("Incoming: {Method} {Path}{Query} | Origin: {Origin}",
            request.Method, request.Path, request.QueryString, request.Headers["Origin"].ToString());

        try
        {
            // Pass the request to the next middleware in the pipeline
            await _next(context);
        }
        finally
        {
            // AFTER: runs when the response comes back (even if an exception was thrown)
            stopwatch.Stop();
            _logger.LogInformation("Completed: {Method} {Path} -> {StatusCode} in {Elapsed} ms",
                request.Method, request.Path, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
        }
    }
}