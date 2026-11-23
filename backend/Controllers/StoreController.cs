using Kiyaara.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace Kiyaara.Api.Controllers;

// Shop-wide facts the website shows, read from the same rules the API charges with.
// Public: every visitor sees the delivery banner.
[ApiController]
[Route("api/[controller]")]
public class StoreController : ControllerBase
{
    public record DeliveryInfo(decimal FreeFrom, decimal Fee);

    // GET api/store/delivery   ->   { "freeFrom": 999, "fee": 79 }
    [HttpGet("delivery")]
    public DeliveryInfo Delivery() => new(DeliveryRules.FreeFrom, DeliveryRules.Fee);
}
