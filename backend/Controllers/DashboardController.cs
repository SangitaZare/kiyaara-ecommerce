using Kiyaara.Api.Data;
using Kiyaara.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Controllers;

// Lives at /api/dashboard, not /api/admin: the Day 17 short-circuit middleware blocks /api/admin.
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = UserRoles.Admin)]                     // NEW (4C): every endpoint here is admins only
public class DashboardController : ControllerBase
{
    private const int LowStockBelow = 5;   // same rule as the "Only 3 left" tag in the store

    private readonly KiyaaraDbContext _db;

    public DashboardController(KiyaaraDbContext db) => _db = db;

    // GET api/dashboard/summary
    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummary>> GetSummary()
    {
        // "Today" in India, as a UTC range for SQL. Not DateTime.Today: on a cloud server running in UTC
        // that would start the day at 5:30 AM India time and count late-night orders on the wrong day.
        var startUtc = TodayInIndia.StartUtc();
        var endUtc = startUtc.AddDays(1);

        var todaysTotals = await _db.Orders
            .Where(o => o.PlacedAt >= startUtc && o.PlacedAt < endUtc && o.Status != OrderStatus.Cancelled)
            .Select(o => o.Total)
            .ToListAsync();

        var products = await _db.Products.AsNoTracking().ToListAsync();

        var summary = new DashboardSummary
        {
            OrdersToday = todaysTotals.Count,
            SalesToday = todaysTotals.Sum(),
            WaitingToPack = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Placed),
            OnTheWay = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Shipped),

            ProductCount = products.Count,
            InStock = products.Count(p => p.Stock >= LowStockBelow),
            RunningLow = products.Count(p => p.Stock > 0 && p.Stock < LowStockBelow),
            SoldOut = products.Count(p => p.Stock == 0),
            StockValue = products.Sum(p => p.Price * p.Stock),

            RecentOrders = await _db.Orders.AsNoTracking().OrderByDescending(o => o.PlacedAt).Take(5).ToListAsync(),
            NeedsAttention = products.Where(p => p.Stock < LowStockBelow).OrderBy(p => p.Stock).ToList()
        };

        return Ok(summary);
    }
    // Midnight in India (UTC+5:30, no daylight saving) as a UTC time, whatever the server's own time zone
    public static class TodayInIndia
    {
        private static readonly TimeSpan Ist = TimeSpan.FromHours(5.5);

        public static DateTime StartUtc() => StartUtc(DateTime.UtcNow);

        public static DateTime StartUtc(DateTime utcNow)
        {
            var nowInIndia = utcNow + Ist;
            return DateTime.SpecifyKind(nowInIndia.Date - Ist, DateTimeKind.Utc);
        }
    }
}
