namespace Day17MiddlewareCors.Services;

// What POST api/products/photo sends back: { "url": "/uploads/products/3f9c2a7e....jpg" }
public record PhotoUploadResponse(string Url);

// The result of trying to save a photo: a web address, or a message for the admin
public record PhotoSaveResult(string? Url, string? Error)
{
    public static PhotoSaveResult Saved(string url) => new(url, null);
    public static PhotoSaveResult Refused(string error) => new(null, error);
}

// 4D: saves the product photos that admins upload, in wwwroot/uploads/products.
// Registered once in Program.cs (AddSingleton), which also serves the folder at /uploads.
public class PhotoStorage
{
    public const long MaxBytes = 5 * 1024 * 1024;     // 5 MB, the same limit as the Angular form

    // Every JPG, PNG and WebP file starts with its own "signature" bytes
    private static readonly byte[] PngSignature = { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };

    private readonly string _productsFolder;

    // The folder Program.cs serves at https://localhost:7001/uploads
    public string UploadsFolder { get; }

    public PhotoStorage(IWebHostEnvironment env)
    {
        UploadsFolder = Path.Combine(env.ContentRootPath, "wwwroot", "uploads");
        _productsFolder = Path.Combine(UploadsFolder, "products");
        Directory.CreateDirectory(_productsFolder);    // creates the folders the first time; does nothing after that
    }

    // Checks the file, saves it with a new random name, and returns its web address
    public async Task<PhotoSaveResult> SaveProductPhotoAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var name = Path.GetFileName(file.FileName);

        if (file.Length == 0)
            return PhotoSaveResult.Refused($"{name} is empty. Choose a photo.");

        if (file.Length > MaxBytes)
            return PhotoSaveResult.Refused($"{name} is {file.Length / 1024d / 1024d:0.0} MB. Choose a photo under 5 MB.");

        await using var input = file.OpenReadStream();

        // Look at the first 12 bytes, not at the name: a file renamed to .jpg is still caught
        var header = new byte[12];
        var read = await input.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        var extension = ExtensionFromSignature(header.AsSpan(0, read));

        if (extension is null)
            return PhotoSaveResult.Refused($"{name} isn't a photo. Choose a JPG, PNG or WebP file.");

        // A new random name: two photos called front.jpg never overwrite each other,
        // and nobody can sneak in a name like ..\..\Program.cs
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var path = Path.Combine(_productsFolder, fileName);

        await using (var output = File.Create(path))
        {
            await output.WriteAsync(header.AsMemory(0, read), cancellationToken);   // the 12 bytes we already read
            await input.CopyToAsync(output, cancellationToken);                     // then the rest of the file
        }

        return PhotoSaveResult.Saved($"/uploads/products/{fileName}");
    }

    // ".jpg", ".png" or ".webp" from the first bytes, or null when it isn't one of them
    private static string? ExtensionFromSignature(ReadOnlySpan<byte> h)
    {
        if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
            return ".jpg";

        if (h.Length >= 8 && h[..8].SequenceEqual(PngSignature))
            return ".png";

        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8))
            return ".webp";

        return null;
    }
}
