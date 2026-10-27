using Day17MiddlewareCors.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Day17MiddlewareCors.Data;

// The Kiyaara database. Each DbSet is a table; OnModelCreating adds the rules.
public class KiyaaraDbContext(DbContextOptions<KiyaaraDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Customer> Customers => Set<Customer>();          // 4B: accounts (shoppers and staff)

    // Rules for every property of a type, in one place
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(10, 2);                  // prices like 1499.00
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(product =>
        {
            // Two orders can't both take the last piece: the second save fails and is told to retry
            product.Property(p => p.Stock).IsConcurrencyToken();
        });

        // Accounts (4B). One account per email address.
        modelBuilder.Entity<Customer>(customer =>
        {
            customer.HasIndex(c => c.Email).IsUnique();
            // NEW (4C): existing accounts become "Customer" when the column is added
            customer.Property(c => c.Role).HasMaxLength(20).HasDefaultValue(UserRoles.Customer);
            customer.Property(c => c.Email).HasMaxLength(254);
            customer.Property(c => c.FullName).HasMaxLength(80);
            customer.Property(c => c.Mobile).HasMaxLength(10);
            customer.Property(c => c.PasswordHash).HasMaxLength(200);
            customer.Property(c => c.ResetTokenHash).HasMaxLength(64);
        });

        modelBuilder.Entity<Order>(order =>
        {
            order.Property(o => o.Id).UseIdentityColumn(seed: 1001, increment: 1);     // KY-1001, KY-1002...
            order.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
            order.Property(o => o.PaymentMethod).HasMaxLength(3);

            // 4B: an order belongs to one customer. If that account is ever deleted,
            // the order stays (the shop still needs it) and CustomerId becomes empty.
            order.HasOne<Customer>()
                 .WithMany()
                 .HasForeignKey(o => o.CustomerId)
                 .OnDelete(DeleteBehavior.SetNull);

            order.OwnsOne(o => o.Address);                                            // columns in Orders
            order.OwnsMany(o => o.Items, item => item.ToTable("OrderItems"));         // its own table
            order.OwnsMany(o => o.History, change =>
            {
                change.ToTable("OrderStatusChanges");
                change.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
            });
        });
    }
}

// SQL Server's datetime2 doesn't remember that a time is UTC. This puts the label back when
// reading, so the JSON says "...Z" and Angular converts it to India time correctly.
public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter()
        : base(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc)) { }
}
