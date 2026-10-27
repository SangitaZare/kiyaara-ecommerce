using Day17MiddlewareCors.Models;

namespace Day17MiddlewareCors.Data;

// Six sample orders so the admin panel has something to show right after the API starts.
// They count as orders placed before today's stock was counted, so they don't change the stock.
public static class DemoOrders
{
    public static List<Order> Create(List<Product> products)
    {
        var now = DateTime.UtcNow;

        return new List<Order>
        {
            Make(products, 1001, now.AddDays(-4), OrderStatus.Delivered, "COD",
                Address("Ananya Kulkarni", "9881012345", "411045", "Pune", "Maharashtra", "12 Sai Residency", "Baner Road, Baner"),
                (7, "L", 1), (10, "4-5Y", 2)),

            Make(products, 1002, now.AddDays(-2), OrderStatus.Shipped, "COD",
                Address("Rohan Deshmukh", "9823012345", "440022", "Nagpur", "Maharashtra", "Plot 18, Shanti Niwas", "Laxmi Nagar"),
                (8, "L", 1)),

            Make(products, 1003, now.AddDays(-1), OrderStatus.Shipped, "UPI",
                Address("Priya Nair", "9847012345", "682011", "Kochi", "Kerala", "14/2 Marine Drive Road", "Ernakulam"),
                (1, "M", 1), (11, "Free Size", 2)),

            Make(products, 1004, now.AddHours(-5), OrderStatus.Packed, "COD",
                Address("Sneha Patil", "9822012345", "411038", "Pune", "Maharashtra", "Flat 5, Shree Apartments", "Kothrud"),
                (2, "Free Size", 1), (12, "Free Size", 1)),

            Make(products, 1005, now.AddHours(-2), OrderStatus.Placed, "COD",
                Address("Arjun Mehta", "9820012345", "400053", "Mumbai", "Maharashtra", "B-704, Sea Breeze Tower", "Andheri West", "Work"),
                (6, "L", 1)),

            Make(products, 1006, now.AddMinutes(-20), OrderStatus.Placed, "UPI",
                Address("Kavya Iyer", "9845012345", "560038", "Bengaluru", "Karnataka", "No. 21, 3rd Cross", "Indiranagar"),
                (4, "S", 2), (11, "Free Size", 1))
        };
    }

    private static DeliveryAddress Address(string name, string mobile, string pincode, string city,
        string state, string house, string area, string type = "Home") => new()
        {
            FullName = name,
            Mobile = mobile,
            Pincode = pincode,
            City = city,
            State = state,
            House = house,
            Area = area,
            AddressType = type
        };

    private static Order Make(List<Product> products, int id, DateTime placedAt, OrderStatus status,
        string payment, DeliveryAddress address, params (int ProductId, string Size, int Quantity)[] lines)
    {
        var items = lines.Select(line =>
        {
            var p = products.First(x => x.Id == line.ProductId);
            return new OrderItem
            {
                ProductId = p.Id,
                Brand = p.Brand,
                Name = p.Name,
                ImageUrl = p.ImageUrl,
                Size = line.Size,
                Quantity = line.Quantity,
                Price = p.Price,
                Mrp = p.Mrp
            };
        }).ToList();

        var subtotal = items.Sum(i => i.Price * i.Quantity);
        var deliveryFee = subtotal >= 999m ? 0m : 79m;      // same rule as OrdersController

        // The steps this order has already been through, a few hours apart
        bool reached(OrderStatus step) => status != OrderStatus.Cancelled && status >= step;

        var history = new List<OrderStatusChange> { new() { Status = OrderStatus.Placed, At = placedAt } };
        if (reached(OrderStatus.Packed)) history.Add(new() { Status = OrderStatus.Packed, At = placedAt.AddHours(3) });
        if (reached(OrderStatus.Shipped)) history.Add(new() { Status = OrderStatus.Shipped, At = placedAt.AddHours(18) });
        if (reached(OrderStatus.Delivered)) history.Add(new() { Status = OrderStatus.Delivered, At = placedAt.AddHours(70) });

        return new Order
        {
            Id = id,
            PlacedAt = placedAt,
            ExpectedDelivery = placedAt.Date.AddDays(4),
            Status = status,
            History = history,
            Items = items,
            Address = address,
            PaymentMethod = payment,
            TotalMrp = items.Sum(i => i.Mrp * i.Quantity),
            Subtotal = subtotal,
            DeliveryFee = deliveryFee,
            Total = subtotal + deliveryFee
        };
    }
}