namespace Day17MiddlewareCors.Models;

// Everything the admin dashboard shows, in one response
public class DashboardSummary
{
    // Orders
    public int OrdersToday { get; set; }
    public decimal SalesToday { get; set; }
    public int WaitingToPack { get; set; }     // status Placed
    public int OnTheWay { get; set; }          // status Shipped

    // Stock
    public int ProductCount { get; set; }
    public int InStock { get; set; }           // 5 or more
    public int RunningLow { get; set; }        // 1 to 4 left
    public int SoldOut { get; set; }           // 0 left
    public decimal StockValue { get; set; }    // price x stock, added up

    // Lists
    public List<Order> RecentOrders { get; set; } = new();
    public List<Product> NeedsAttention { get; set; } = new();
}