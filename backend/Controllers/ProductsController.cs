using Day17MiddlewareCors.Data;
using Day17MiddlewareCors.Models;
using Day17MiddlewareCors.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Day17MiddlewareCors.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly KiyaaraDbContext _db;
    private readonly PhotoStorage _photos;                    // NEW (4D)

    // Both arrive through dependency injection (registered in Program.cs)
    public ProductsController(KiyaaraDbContext db, PhotoStorage photos)
    {
        _db = db;
        _photos = photos;
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
    public async Task<ActionResult<Product>> Create(Product product)
    {
        product.Id = 0;                                       // SQL Server chooses the id
        if (product.Mrp == 0) product.Mrp = product.Price;   // no MRP given = no discount
        product.CreatedAt = DateTime.UtcNow;

        _db.Products.Add(product);
        await _db.SaveChangesAsync();                         // INSERT happens here; product.Id is now set
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT api/products/2
    [Authorize(Roles = UserRoles.Admin)]                 // (4C): admins only
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, Product updated)
    {
        var product = await _db.Products.FindAsync(id);       // tracked: EF Core sees what changes
        if (product is null) return NotFound();

        product.Name = updated.Name;
        product.Brand = updated.Brand;
        product.Category = updated.Category;
        product.Gender = updated.Gender;
        product.Description = updated.Description;
        product.ImageUrl = updated.ImageUrl;                  // a new upload's address arrives here
        product.Price = updated.Price;
        product.Mrp = updated.Mrp == 0 ? updated.Price : updated.Mrp;
        product.Stock = updated.Stock;
        product.Sizes = updated.Sizes;

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

    // GET api/products/internal  (Day 17 extra: CORS disabled for this endpoint)
    [HttpGet("internal")]
    [DisableCors]
    public IActionResult InternalOnly() => Ok("This endpoint ignores the CORS policy");
    // GET api/products/search?q=kurta&maxPrice=1500&size=M&inStock=true&page=1   (everyone)
    [HttpGet("search")]
    public async Task<ActionResult<ProductSearchResult>> Search([FromQuery] ProductSearchQuery search)
    {
        if (search.MinPrice > search.MaxPrice)
        {
            ModelState.AddModelError("MinPrice", "Minimum price can't be higher than maximum price.");
            return ValidationProblem(ModelState);
        }

        var page = Math.Max(search.Page, 1);
        var pageSize = Math.Clamp(search.PageSize, 1, 50);

        IQueryable<Product> query = _db.Products.AsNoTracking();

        // Free text: every word must appear in the name, brand, category or description
        var words = (search.Q ?? "")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(6);
        foreach (var word in words)
        {
            var w = word;
            query = query.Where(p => p.Name.Contains(w) || p.Brand.Contains(w)
                                  || p.Category.Contains(w) || p.Description.Contains(w));
        }

        if (!string.IsNullOrWhiteSpace(search.Category))
        {
            var category = search.Category.Trim();
            query = query.Where(p => p.Category.Contains(category));
        }

        if (!string.IsNullOrWhiteSpace(search.Gender))
        {
            var gender = search.Gender.Trim();
            query = query.Where(p => p.Gender == gender);
        }

        if (!string.IsNullOrWhiteSpace(search.Colour))
        {
            var colour = search.Colour.Trim();
            query = query.Where(p => p.Name.Contains(colour) || p.Description.Contains(colour));
        }

        if (!string.IsNullOrWhiteSpace(search.Size))
        {
            var size = search.Size.Trim().ToUpperInvariant();
            query = query.Where(p => p.Sizes.Contains(size));
        }

        if (search.MinPrice is decimal min) query = query.Where(p => p.Price >= min);
        if (search.MaxPrice is decimal max) query = query.Where(p => p.Price <= max);
        if (search.InStock) query = query.Where(p => p.Stock > 0);

        query = search.Sort?.ToLowerInvariant() switch
        {
            "price_asc" => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price_desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "rating" => query.OrderByDescending(p => p.Rating).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id)
        };

        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(new ProductSearchResult(items, total, page, pageSize));
    }
}
