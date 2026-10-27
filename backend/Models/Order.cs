using System.ComponentModel.DataAnnotations;

namespace Day17MiddlewareCors.Models;

// ---------- Order status ----------

// The life of an order. JsonStringEnumConverter (Program.cs) sends it as text: "Packed", not 1.
public enum OrderStatus
{
    Placed,
    Packed,
    Shipped,
    Delivered,
    Cancelled
}

public static class OrderRules
{
    // Where an order may go next. Status only moves forward; Delivered and Cancelled are final.
    public static IReadOnlyList<OrderStatus> NextSteps(OrderStatus current) => current switch
    {
        OrderStatus.Placed => new[] { OrderStatus.Packed, OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Cancelled },
        OrderStatus.Packed => new[] { OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Cancelled },
        OrderStatus.Shipped => new[] { OrderStatus.Delivered },     // already with the courier, so no cancelling
        _ => Array.Empty<OrderStatus>()            // Delivered and Cancelled
    };
}

// ---------- What the Angular checkout sends ----------

public class PlaceOrderRequest
{
    [Required, MinLength(1, ErrorMessage = "Your bag is empty.")]
    public List<OrderLineRequest> Items { get; set; } = new();

    [Required]
    public DeliveryAddress Address { get; set; } = new();

    [RegularExpression("^(COD|UPI)$", ErrorMessage = "Choose cash on delivery or UPI.")]
    public string PaymentMethod { get; set; } = "COD";
}

public class OrderLineRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    public string Size { get; set; } = string.Empty;    // empty for one-size products

    [Range(1, 5, ErrorMessage = "You can order 1 to 5 of each item.")]
    public int Quantity { get; set; }
}

public class DeliveryAddress
{
    [Required(ErrorMessage = "Enter the full name.")]
    [StringLength(80, MinimumLength = 2, ErrorMessage = "Name must be 2 to 80 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a mobile number.")]
    [RegularExpression(@"^[6-9]\d{9}$", ErrorMessage = "Enter a valid 10-digit mobile number.")]
    public string Mobile { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter a pincode.")]
    [RegularExpression(@"^[1-9]\d{5}$", ErrorMessage = "Enter a valid 6-digit pincode.")]
    public string Pincode { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter the city."), StringLength(60)]
    public string City { get; set; } = string.Empty;

    [Required(ErrorMessage = "Choose a state.")]
    public string State { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter the house number and building."), StringLength(120)]
    public string House { get; set; } = string.Empty;

    [Required(ErrorMessage = "Enter the area and street."), StringLength(120)]
    public string Area { get; set; } = string.Empty;

    [StringLength(120)]
    public string? Landmark { get; set; }

    [RegularExpression("^(Home|Work)$")]
    public string AddressType { get; set; } = "Home";
}

// ---------- What the admin panel sends ----------

public class UpdateOrderStatusRequest
{
    // Nullable + Required: a missing "status" gives a clear 400 instead of silently meaning "Placed"
    [Required(ErrorMessage = "Choose a status.")]
    public OrderStatus? Status { get; set; }
}

// ---------- What the API saves and returns ----------

public class Order
{
    public int Id { get; set; }
    public string OrderNumber => $"KY-{Id}";            // read-only, still sent in the JSON
    public int? CustomerId { get; set; }
    public DateTime PlacedAt { get; set; }
    public DateTime ExpectedDelivery { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Placed;
    public List<OrderStatusChange> History { get; set; } = new();   // when each status was reached
    public IReadOnlyList<OrderStatus> NextStatuses => OrderRules.NextSteps(Status);  // for the admin picker
    public List<OrderItem> Items { get; set; } = new();
    public DeliveryAddress Address { get; set; } = new();
    public string PaymentMethod { get; set; } = "COD";
    public decimal TotalMrp { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }
    public int ItemCount => Items.Sum(i => i.Quantity);
}

public class OrderStatusChange
{
    public OrderStatus Status { get; set; }
    public DateTime At { get; set; }
}

public class OrderItem
{
    public int ProductId { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal Price { get; set; }      // price per item at the moment of ordering
    public decimal Mrp { get; set; }
}