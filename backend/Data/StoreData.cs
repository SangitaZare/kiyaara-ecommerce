using Day17MiddlewareCors.Models;

namespace Day17MiddlewareCors.Data;

// One shared in-memory "database" for the whole API.
// Registered as a singleton in Program.cs, so every controller sees the same lists.
// It resets when the API restarts; a real database replaces it in Phase 4.
public class StoreData
{
    public List<Product> Products { get; }
    public List<Order> Orders { get; }

    // Two requests at the same moment must not both take the last item
    public object OrderLock { get; } = new();

    public StoreData()
    {
        Products = SeedData.Products();
        Orders = DemoOrders.Create(Products);   // NEW: sample orders KY-1001 to KY-1006
    }
}