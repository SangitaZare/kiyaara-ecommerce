using System.Globalization;
using Day17MiddlewareCors.Data;
using Day17MiddlewareCors.Models;
using Microsoft.EntityFrameworkCore;

namespace Day17MiddlewareCors.Services;

// Emails the customer when their order is placed, shipped, delivered or cancelled.
// A failed email is written to the log and never stops the order itself.
public class OrderNotifier(
    KiyaaraDbContext db,
    IEmailService emails,
    IConfiguration configuration,
    ILogger<OrderNotifier> logger)
{
    private static readonly CultureInfo India = CultureInfo.GetCultureInfo("en-IN");

    public async Task NotifyAsync(Order order)
    {
        try
        {
            if (order.CustomerId is null) return;      // the sample orders have no account

            var customer = await db.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == order.CustomerId);
            if (customer is null) return;

            var firstName = customer.FullName.Split(' ')[0];
            var email = Compose(order, firstName);
            if (email is null) return;                 // no email for this status (Packed)

            await emails.SendAsync(customer.Email, email.Value.Subject, email.Value.Body);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not send the email for order {OrderNumber}", order.OrderNumber);
        }
    }

    private (string Subject, string Body)? Compose(Order order, string firstName)
    {
        var site = configuration["ClientUrl"] ?? "http://localhost:4200";
        var number = order.OrderNumber;
        var footer = $"\n\nSee your order: {site}/order/{order.Id}\n\nThank you for shopping with Kiyaara.";
        var delivery = order.ExpectedDelivery.ToString("dddd, d MMMM", India);

        switch (order.Status)
        {
            case OrderStatus.Placed:
                {
                    var items = string.Join("\n", order.Items.Select(i =>
                        $"  - {i.Name} ({(string.IsNullOrEmpty(i.Size) ? "one size" : "size " + i.Size)}) x {i.Quantity}: ₹{(i.Price * i.Quantity).ToString("N0", India)}"));
                    var a = order.Address;
                    var payment = order.PaymentMethod == "COD" ? "Cash on delivery. Pay when it arrives." : "Paid by UPI.";

                    return ($"Order {number} is confirmed",
                        $"Hi {firstName},\n\nThank you! We've received your order {number}.\n\n" +
                        $"{items}\n\n" +
                        $"Total: ₹{order.Total.ToString("N0", India)} ({payment})\n" +
                        $"Expected delivery: {delivery}\n\n" +
                        $"Delivering to:\n{a.FullName}\n{a.House}, {a.Area}\n{a.City}, {a.State} {a.Pincode}" +
                        footer);
                }

            case OrderStatus.Shipped:
                return ($"Your order {number} is on the way",
                    $"Hi {firstName},\n\nGood news: your order {number} has been shipped.\nExpected delivery: {delivery}." + footer);

            case OrderStatus.Delivered:
                return ($"Your order {number} was delivered",
                    $"Hi {firstName},\n\nYour order {number} has been delivered. We hope you love it!" + footer);

            case OrderStatus.Cancelled:
                return ($"Your order {number} is cancelled",
                    $"Hi {firstName},\n\nYour order {number} has been cancelled and the items are back on our shelf." +
                    (order.PaymentMethod == "COD" ? "\nIt was cash on delivery, so you have nothing to pay." : string.Empty) +
                    footer);

            default:
                return null;      // Packed: no email
        }
    }
}