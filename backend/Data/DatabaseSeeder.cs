using Day17MiddlewareCors.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Day17MiddlewareCors.Data;

// Called by EF Core every time the API starts and applies migrations (UseSeeding in Program.cs).
// 1. An EMPTY database gets the 12 products and the 6 sample orders.
// 2. 4B: if there are no customers yet, the demo customer Priya is added and
//    linked to the sample order that was sent to her mobile number (KY-1003).
// 3. NEW (4C): if there is no admin yet, the demo admin Asha is added.
public static class DatabaseSeeder
{
    public const string DemoEmail = "priya@example.com";
    public const string DemoPassword = "Kiyaara123";
    private const string DemoMobile = "9847012345";

    public const string AdminEmail = "admin@kiyaara.com";      // NEW (4C)
    public const string AdminPassword = "Admin2026";

    public static void Seed(DbContext context, bool seedDemoAccounts)
    {
        SeedStore(context);
        if (!seedDemoAccounts) return;
        SeedDemoCustomer(context);
        SeedDemoAdmin(context);
    }

    public static async Task SeedAsync(DbContext context, bool seedDemoAccounts, CancellationToken cancellationToken)
    {
        await SeedStoreAsync(context, cancellationToken);
        if (!seedDemoAccounts) return;
        await SeedDemoCustomerAsync(context, cancellationToken);
        await SeedDemoAdminAsync(context, cancellationToken);
    }
    // ---------- 1. Products and sample orders (only into an empty database) ----------

    private static void SeedStore(DbContext context)
    {
        if (context.Set<Product>().Any() || context.Set<Order>().Any()) return;   // never seed twice

        var products = SeedData.Products();
        var orders = DemoOrders.Create(products);   // built first, while products still have ids 1 to 12

        foreach (var product in products)
        {
            product.Id = 0;                      // let SQL Server number it: 1, 2, 3...
            context.Set<Product>().Add(product);
            context.SaveChanges();               // one at a time keeps the numbers in seed order
        }

        foreach (var order in orders)
        {
            order.Id = 0;                        // SQL Server numbers orders from 1001
            context.Set<Order>().Add(order);
            context.SaveChanges();
        }
    }

    private static async Task SeedStoreAsync(DbContext context, CancellationToken cancellationToken)
    {
        if (await context.Set<Product>().AnyAsync(cancellationToken) ||
            await context.Set<Order>().AnyAsync(cancellationToken)) return;

        var products = SeedData.Products();
        var orders = DemoOrders.Create(products);

        foreach (var product in products)
        {
            product.Id = 0;
            context.Set<Product>().Add(product);
            await context.SaveChangesAsync(cancellationToken);
        }

        foreach (var order in orders)
        {
            order.Id = 0;
            context.Set<Order>().Add(order);
            await context.SaveChangesAsync(cancellationToken);
        }
    }

    // ---------- 2. The demo customer (added once, even to a database that already has data) ----------

    private static void SeedDemoCustomer(DbContext context)
    {
        if (context.Set<Customer>().Any()) return;

        var priya = DemoCustomer();
        context.Set<Customer>().Add(priya);
        context.SaveChanges();                   // now Priya has her Id

        var herOrders = context.Set<Order>()
            .Where(o => o.Address.Mobile == DemoMobile && o.CustomerId == null)
            .ToList();
        foreach (var order in herOrders) order.CustomerId = priya.Id;
        context.SaveChanges();
    }

    private static async Task SeedDemoCustomerAsync(DbContext context, CancellationToken cancellationToken)
    {
        if (await context.Set<Customer>().AnyAsync(cancellationToken)) return;

        var priya = DemoCustomer();
        context.Set<Customer>().Add(priya);
        await context.SaveChangesAsync(cancellationToken);

        var herOrders = await context.Set<Order>()
            .Where(o => o.Address.Mobile == DemoMobile && o.CustomerId == null)
            .ToListAsync(cancellationToken);
        foreach (var order in herOrders) order.CustomerId = priya.Id;
        await context.SaveChangesAsync(cancellationToken);
    }

    // ---------- 3. NEW (4C): the demo admin (added once, if no admin exists) ----------

    private static void SeedDemoAdmin(DbContext context)
    {
        if (context.Set<Customer>().Any(c => c.Role == UserRoles.Admin)) return;
        if (context.Set<Customer>().Any(c => c.Email == AdminEmail)) return;   // that email is already a shopper

        context.Set<Customer>().Add(DemoAdmin());
        context.SaveChanges();
    }

    private static async Task SeedDemoAdminAsync(DbContext context, CancellationToken cancellationToken)
    {
        if (await context.Set<Customer>().AnyAsync(c => c.Role == UserRoles.Admin, cancellationToken)) return;
        if (await context.Set<Customer>().AnyAsync(c => c.Email == AdminEmail, cancellationToken)) return;

        context.Set<Customer>().Add(DemoAdmin());
        await context.SaveChangesAsync(cancellationToken);
    }

    private static Customer DemoAdmin()
    {
        var admin = new Customer
        {
            FullName = "Asha Rao",
            Email = AdminEmail,
            Mobile = "9800012345",
            Role = UserRoles.Admin,
            CreatedAt = DateTime.UtcNow
        };
        admin.PasswordHash = new PasswordHasher<Customer>().HashPassword(admin, AdminPassword);
        return admin;
    }

    private static Customer DemoCustomer()
    {
        var customer = new Customer
        {
            FullName = "Priya Nair",
            Email = DemoEmail,
            Mobile = DemoMobile,
            CreatedAt = DateTime.UtcNow
        };
        customer.PasswordHash = new PasswordHasher<Customer>().HashPassword(customer, DemoPassword);
        return customer;
    }
}
