using System.Globalization;

namespace Kiyaara.Api.Models;

// The delivery charge, in one place. Checkout (OrdersController) charges it and the AI assistant
// describes it, so changing a number here changes both and they can never disagree.
public static class DeliveryRules
{
    public const decimal FreeFrom = 999m;   // orders of this much or more deliver free
    public const decimal Fee = 79m;         // charged below that

    public static decimal FeeFor(decimal subtotal) => subtotal >= FreeFrom ? 0m : Fee;

    // "Delivery is free from ₹999; below that it costs ₹79."
    public static string Describe() =>
        $"Delivery is free from ₹{Rupees(FreeFrom)}; below that it costs ₹{Rupees(Fee)}.";

    private static string Rupees(decimal amount) => amount.ToString("#,##,##0", CultureInfo.InvariantCulture);
}
