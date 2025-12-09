using FileManagement.Domain.Shared.Storage;
using FileManagement.Infrastructure.Storage;
using Microsoft.Extensions.Options;

namespace Fle.Infrastructure.Storage;

public class LocalFileStorage(IOptions<FileStorageOptions> options) : IFileStorage
{
    private readonly FileStorageOptions _opt = options.Value;

    public async Task SaveAsync(Stream content, string relativePath, CancellationToken ct)
    {
        var abs = GetAbsolutePath(relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(abs)!);

        await using var fs = new FileStream(abs, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024, useAsync: true);
        await content.CopyToAsync(fs, 1024 * 1024, ct);
        await fs.FlushAsync(ct);
    }

    public Task DeleteAsync(string relativePath, CancellationToken ct)
    {
        var abs = GetAbsolutePath(relativePath);
        if (File.Exists(abs)) File.Delete(abs);
        return Task.CompletedTask;
    }

    public string GetAbsolutePath(string relativePath)
        => Path.GetFullPath(Path.Combine(_opt.BasePath, relativePath.Replace('/', Path.DirectorySeparatorChar)));
}
