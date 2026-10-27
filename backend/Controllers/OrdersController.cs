using Day17MiddlewareCors.Data;
using Day17MiddlewareCors.Models;
using Day17MiddlewareCors.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Day17MiddlewareCors.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private const decimal FreeDeliveryFrom = 999m;
    private const decimal DeliveryFee = 79m;

    private readonly KiyaaraDbContext _db;
    private readonly OrderNotifier _notifier;

    public OrdersController(KiyaaraDbContext db, OrderNotifier notifier)
    {
        _db = db;
        _notifier = notifier;
    }

    // GET api/orders  (newest first, for the admin panel)
    // Items, address and history come along automatically: they are owned by the order
    [Authorize(Roles = UserRoles.Admin)]                 // NEW (4C): admins only
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetAll() =>
        Ok(await _db.Orders.AsNoTracking().OrderByDescending(o => o.PlacedAt).ToListAsync());

    // GET api/orders/mine  (the logged-in customer's own orders, newest first)
    [Authorize]
    [HttpGet("mine")]
    public async Task<ActionResult<IEnumerable<Order>>> GetMine()
    {
        var customerId = User.CustomerId();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.PlacedAt)
            .ToListAsync();
        return Ok(orders);
    }

    // GET api/orders/1001
    // CHANGED (4C): needs a login. Customers see only their own orders; admins see every order.
    [Authorize]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Order>> GetById(int id)
    {
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);

        // Someone else's order answers "not found", so nobody can guess which order numbers exist
        if (order is null || (order.CustomerId != User.CustomerId() && !User.IsInRole(UserRoles.Admin)))
            return NotFound();

        return Ok(order);
    }

    // POST api/orders   (4B: only a logged-in customer can place an order)
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<Order>> Place(PlaceOrderRequest request)
    {
        // 0. Who is ordering (read from the token, never from the request body)
        var customerId = User.CustomerId();
        if (!await _db.Customers.AnyAsync(c => c.Id == customerId))
            return Unauthorized();          // the account was deleted after the token was made

        // 1. How many of each product the bag wants (the same product can appear in two sizes)
        var wanted = request.Items
            .GroupBy(i => i.ProductId)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

        // 2. Load only those products (tracked, so their stock can be lowered)
        var ids = wanted.Keys.ToList();
        var products = await _db.Products.Where(p => ids.Contains(p.Id)).ToListAsync();

        // 3. Check every line: product exists, size is offered, enough stock
        foreach (var line in request.Items)
        {
            var product = products.FirstOrDefault(p => p.Id == line.ProductId);

            if (product is null)
                ModelState.AddModelError("Items", "An item in your bag is no longer sold. Remove it and try again.");
            else if (product.Sizes.Count > 0 && !product.Sizes.Contains(line.Size))
                ModelState.AddModelError("Items", $"{product.Name} isn't available in size {line.Size}.");
            else if (product.Stock < wanted[product.Id])
                ModelState.AddModelError("Items", product.Stock == 0
                    ? $"{product.Name} is sold out. Remove it to continue."
                    : $"Only {product.Stock} of {product.Name} left. Lower the quantity to continue.");
        }

        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        // 4. Build the order with prices from the database, never from the browser
        var items = request.Items.Select(line =>
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

        // 5. Lower the stock
        foreach (var (productId, quantity) in wanted)
            products.First(p => p.Id == productId).Stock -= quantity;

        // 6. Work out the totals
        var subtotal = items.Sum(i => i.Price * i.Quantity);
        var deliveryFee = subtotal >= FreeDeliveryFrom ? 0m : DeliveryFee;
        var now = DateTime.UtcNow;

        var order = new Order                  // no Id: SQL Server numbers it (1001, 1002...)
        {
            CustomerId = customerId,           // the order belongs to this account
            PlacedAt = now,
            ExpectedDelivery = now.Date.AddDays(4),
            Status = OrderStatus.Placed,
            History = { new OrderStatusChange { Status = OrderStatus.Placed, At = now } },
            Items = items,
            Address = request.Address,
            PaymentMethod = request.PaymentMethod,
            TotalMrp = items.Sum(i => i.Mrp * i.Quantity),
            Subtotal = subtotal,
            DeliveryFee = deliveryFee,
            Total = subtotal + deliveryFee
        };
        _db.Orders.Add(order);

        // 7. Save the order and the new stock together: all or nothing
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another order took the same stock between our check and our save
            ModelState.AddModelError("Items", "Someone just bought the last pieces of an item in your bag. Check your bag and try again.");
            return ValidationProblem(ModelState);
        }

        await _notifier.NotifyAsync(order);       // "Order KY-1009 is confirmed" email

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    // PUT api/orders/1003/cancel   (a customer cancels their own order, before it ships)
    [Authorize]
    [HttpPut("{id:int}/cancel")]
    public async Task<ActionResult<Order>> Cancel(int id)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id);    // tracked

        // Someone else's order answers "not found", the same as GetById
        if (order is null || order.CustomerId != User.CustomerId())
            return NotFound();

        if (!OrderRules.NextSteps(order.Status).Contains(OrderStatus.Cancelled))
        {
            ModelState.AddModelError("Status", order.Status switch
            {
                OrderStatus.Cancelled => "This order is already cancelled.",
                OrderStatus.Delivered => "This order is delivered, so it can't be cancelled.",
                _ => "This order is already on its way, so it can't be cancelled."
            });
            return ValidationProblem(ModelState);
        }

        await ReturnItemsToShelfAsync(order);
        order.Status = OrderStatus.Cancelled;
        order.History.Add(new OrderStatusChange { Status = OrderStatus.Cancelled, At = DateTime.UtcNow });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError("Status", "Something changed at the same moment. Please try again.");
            return ValidationProblem(ModelState);
        }

        await _notifier.NotifyAsync(order);       // "Your order is cancelled" email
        return Ok(order);
    }

    // PUT api/orders/1003/status   body: { "status": "Packed" }
    [Authorize(Roles = UserRoles.Admin)]                 // NEW (4C): admins only
    [HttpPut("{id:int}/status")]
    public async Task<ActionResult<Order>> UpdateStatus(int id, UpdateOrderStatusRequest request)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == id);    // tracked
        if (order is null) return NotFound();

        var newStatus = request.Status!.Value;     // [Required] already rejected a missing status
        if (newStatus == order.Status) return Ok(order);   // nothing to change, so no email either

        // 1. Only the moves in OrderRules are allowed
        if (!OrderRules.NextSteps(order.Status).Contains(newStatus))
        {
            ModelState.AddModelError(nameof(request.Status), order.Status switch
            {
                OrderStatus.Delivered => "This order is delivered, so its status can't change.",
                OrderStatus.Cancelled => "This order is cancelled, so its status can't change.",
                OrderStatus.Shipped when newStatus == OrderStatus.Cancelled => "A shipped order can't be cancelled.",
                _ => $"An order can't go back from {order.Status} to {newStatus}."
            });
            return ValidationProblem(ModelState);
        }

        // 2. Cancelling puts the items back on the shelf
        if (newStatus == OrderStatus.Cancelled)
            await ReturnItemsToShelfAsync(order);

        // 3. Save the new status and when it happened
        order.Status = newStatus;
        order.History.Add(new OrderStatusChange { Status = newStatus, At = DateTime.UtcNow });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError(nameof(request.Status), "The stock changed at the same moment. Please try again.");
            return ValidationProblem(ModelState);
        }

        await _notifier.NotifyAsync(order);       // shipped, delivered or cancelled email (Packed sends none)
        return Ok(order);
    }

    // Puts an order's items back into stock (used whenever an order is cancelled)
    private async Task ReturnItemsToShelfAsync(Order order)
    {
        var ids = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _db.Products.Where(p => ids.Contains(p.Id)).ToListAsync();
        foreach (var item in order.Items)
        {
            var product = products.FirstOrDefault(p => p.Id == item.ProductId);
            if (product is not null) product.Stock += item.Quantity;   // skipped if the product was deleted
        }
    }
}