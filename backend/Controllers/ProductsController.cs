using Kiyaara.Api.Data;
using Kiyaara.Api.Models;
using Kiyaara.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kiyaara.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly KiyaaraDbContext _db;
    private readonly PhotoStorage _photos;                    // NEW (4D)
    private readonly ProductSearchService _search;            // shared with the AI assistant

    // All arrive through dependency injection (registered in Program.cs)
    public ProductsController(KiyaaraDbContext db, PhotoStorage photos, ProductSearchService search)
    {
        _db = db;
        _photos = photos;
        _search = search;
    }

    // GET api/products   (everyone: the shop needs it)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetAll() =>
        Ok(await _db.Products.AsNoTracking().OrderBy(p => p.Id).ToListAsync());

    // GET api/products/1   (everyone)
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Product>> GetById(int id)
    {
        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        return product is null ? NotFound() : Ok(product);
    }

    // POST api/products/photo   (NEW 4D: admins only)
    // Angular sends the photo as form data in a field called "photo" (the same name as the parameter).
    // The answer is { "url": "/uploads/products/....jpg" }. The product itself doesn't change yet:
    // the form puts this address in its photo field, and Save (PUT or POST) stores it.
    [Authorize(Roles = UserRoles.Admin)]
    [HttpPost("photo")]
    public async Task<ActionResult<PhotoUploadResponse>> UploadPhoto(IFormFile? photo, CancellationToken cancellationToken)
    {
        if (photo is null)
        {
            ModelState.AddModelError("photo", "Choose a photo to upload.");
            return ValidationProblem(ModelState);
        }

        var result = await _photos.SaveProductPhotoAsync(photo, cancellationToken);
        if (result.Error is not null)
        {
            // 400 with { "errors": { "photo": ["..."] } }, the same shape Angular already reads
            ModelState.AddModelError("photo", result.Error);
            return ValidationProblem(ModelState);
        }

        return Ok(new PhotoUploadResponse(result.Url!));
    }

    // POST api/products
    [Authorize(Roles = UserRoles.Admin)]                 // (4C): admins only
    [HttpPost]
    public async Task<ActionResult<Product>> Create(ProductInput input)
    {
        // A new product: SQL Server chooses the id; rating and date are the shop's, not the form's
        var product = new Product { CreatedAt = DateTime.UtcNow };
        input.ApplyTo(product);

        _db.Products.Add(product);
        await _db.SaveChangesAsync();                         // INSERT happens here; product.Id is now set
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT api/products/2
    [Authorize(Roles = UserRoles.Admin)]                 // (4C): admins only
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ProductInput input)
    {
        var product = await _db.Products.FindAsync(id);       // tracked: EF Core sees what changes
        if (product is null) return NotFound();

        input.ApplyTo(product);                               // rating, rating count and date are kept

        try
        {
            await _db.SaveChangesAsync();                     // UPDATE only the columns that changed
        }
        catch (DbUpdateConcurrencyException)
        {
            ModelState.AddModelError("Stock", "An order changed this product's stock at the same moment. Reload the page and try again.");
            return ValidationProblem(ModelState);
        }
        return NoContent();
    }

    // DELETE api/products/2
    [Authorize(Roles = UserRoles.Admin)]                 // (4C): admins only
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET api/products/search?q=kurta&maxPrice=1500&size=M&inStock=true&page=1   (everyone)
    [HttpGet("search")]
    public async Task<ActionResult<ProductSearchResult>> Search([FromQuery] ProductSearchQuery search, CancellationToken cancellationToken)
    {
        if (search.MinPrice > search.MaxPrice)
        {
            ModelState.AddModelError("MinPrice", "Minimum price can't be higher than maximum price.");
            return ValidationProblem(ModelState);
        }

        return Ok(await _search.SearchAsync(search, cancellationToken));
    }
}
