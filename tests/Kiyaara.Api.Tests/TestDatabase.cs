using Kiyaara.Api.Data;
using Kiyaara.Api.Models;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Tests;

// A fresh SQLite database in memory for each test: real SQL (so searches are translated the way
// a database runs them) without touching the development SQL Server.
public sealed class TestDatabase : IDisposable
{
    public const int Priya = 1;     // the customer most tests log in as
    public const int Arjun = 2;     // someone else

    private readonly SqliteConnection _connection;
    public KiyaaraDbContext Db { get; }

    public TestDatabase()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();                       // the database lives as long as this connection
        Db = new KiyaaraDbContext(new DbContextOptionsBuilder<KiyaaraDbContext>().UseSqlite(_connection).Options);
        Db.Database.EnsureCreated();
        Seed();
    }

    private void Seed()
    {
        Db.Customers.AddRange(
            new Customer { Id = Priya, FullName = "Priya Sharma", Email = "priya@test.local", Mobile = "9876543210" },
            new Customer { Id = Arjun, FullName = "Arjun Rao", Email = "arjun@test.local", Mobile = "9123456780" });

        Db.Products.AddRange(
            Product(1, "Block Print Cotton Kurta Set", "Kurta Sets", "Women", 1499, 2999, stock: 25, "S", "M", "L"),
            Product(2, "Banarasi Silk Blend Saree", "Sarees", "Women", 3299, 6599, stock: 8),
            Product(3, "Linen Shirt", "Shirts", "Men", 1799, 2499, stock: 0, "M", "L", "XL"),
            Product(4, "Blue Denim Kurta", "Kurtas", "Men", 999, 1499, stock: 5, "L"));

        Db.Orders.AddRange(
            Order(1001, Arjun, OrderStatus.Delivered, placedDaysAgo: 30, "Linen Shirt"),
            Order(1002, Priya, OrderStatus.Delivered, placedDaysAgo: 20, "Banarasi Silk Blend Saree"),
            Order(1003, Priya, OrderStatus.Packed, placedDaysAgo: 2, "Block Print Cotton Kurta Set"));

        // Order items and status history get their row numbers from SQL Server automatically.
        // SQLite can't do that for these two-part keys, so the test numbers them itself.
        var rowNumber = 1;
        foreach (var order in Db.Orders.Local)
        {
            foreach (var item in order.Items) Db.Entry(item).Property("Id").CurrentValue = rowNumber++;
            foreach (var change in order.History) Db.Entry(change).Property("Id").CurrentValue = rowNumber++;
        }

        Db.SaveChanges();
        Db.ChangeTracker.Clear();
    }

    private static Product Product(int id, string name, string category, string gender,
        decimal price, decimal mrp, int stock, params string[] sizes) => new()
    {
        Id = id, Name = name, Brand = "Test Brand", Category = category, Gender = gender,
        Description = $"{name} for testing.", Price = price, Mrp = mrp, Stock = stock,
        Sizes = sizes.ToList(), Rating = 4.2, RatingCount = 10, CreatedAt = DateTime.UtcNow.AddDays(-id)
    };

    private static Order Order(int id, int customerId, OrderStatus status, int placedDaysAgo, string itemName)
    {
        var placed = DateTime.UtcNow.AddDays(-placedDaysAgo);
        return new Order
        {
            Id = id,
            CustomerId = customerId,
            PlacedAt = placed,
            ExpectedDelivery = placed.Date.AddDays(4),
            Status = status,
            History = { new OrderStatusChange { Status = status, At = placed } },
            Items = { new OrderItem { ProductId = 1, Name = itemName, Brand = "Test Brand", Size = "M", Quantity = 1, Price = 1499, Mrp = 2999 } },
            Address = new DeliveryAddress
            {
                FullName = customerId == Priya ? "Priya Sharma" : "Arjun Rao",
                Mobile = "9876543210", Pincode = "682001", City = "Kochi", State = "Kerala",
                House = "12 Rose Villa", Area = "MG Road"
            },
            PaymentMethod = "COD",
            TotalMrp = 2999, Subtotal = 1499, DeliveryFee = 0, Total = 1499
        };
    }

    public void Dispose()
    {
        Db.Dispose();
        _connection.Dispose();
    }
}
