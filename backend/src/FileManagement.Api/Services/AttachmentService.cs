using FileManagement.Api.Infrastructure;
using FileManagement.Api.Models;
using Microsoft.Extensions.Options;

namespace FileManagement.Api.Services;

public interface IAttachmentService
{
    Task<UploadResult> SaveAsync(UploadFileModel model, CancellationToken cancellationToken = default);
    Task<(Stream Stream, AttachmentDto Meta)?> DownloadAsync(Guid id);
    Task DeleteAsync(Guid id);
}

public class AttachmentService : IAttachmentService
{
    private readonly FileStorageOptions _options;
    private readonly IAttachmentRepository _repository;
    private readonly ILogger<AttachmentService> _logger;

    public AttachmentService(FileStorageOptions options, IAttachmentRepository repository, ILogger<AttachmentService> logger)
    {
        _options = options;
        _repository = repository;
        _logger = logger;

        Directory.CreateDirectory(_options.AbsoluteRootPath);
    }

    public async Task<UploadResult> SaveAsync(UploadFileModel model, CancellationToken cancellationToken = default)
    {
        var guid = Guid.NewGuid();
        var extension = Path.GetExtension(model.File.FileName);
        var storedName = $"{guid:N}{extension}";
        var (folder, relativeFolder) = ResolveFolder(model.FolderPath);
        var path = Path.Combine(folder, storedName);

        Directory.CreateDirectory(folder);

        await using (var fileStream = new FileStream(path, FileMode.Create, FileAccess.Write))
        {
            await model.File.CopyToAsync(fileStream, cancellationToken);
        }

        var dto = new AttachmentDto(
            guid,
            model.File.FileName,
            model.File.ContentType,
            path,
            relativeFolder,
            model.Description,
            DateTime.UtcNow,
            model.File.Length);
        await _repository.AddAsync(dto);

        _logger.LogInformation("Saved file {File} to {Path}", model.File.FileName, path);

        return new UploadResult
        {
            Guid = guid,
            FileName = model.File.FileName,
            ContentType = model.File.ContentType,
            FileSize = model.File.Length,
            DownloadUrl = $"/api/attachments/download/{guid}"
        };
    }

    public async Task<(Stream Stream, AttachmentDto Meta)?> DownloadAsync(Guid id)
    {
        var attachment = await _repository.GetAsync(id);
        if (attachment == null || !File.Exists(attachment.Path))
        {
            return null;
        }

        var stream = new FileStream(attachment.Path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, attachment);
    }

    public async Task DeleteAsync(Guid id)
    {
        var attachment = await _repository.GetAsync(id);
        if (attachment != null && File.Exists(attachment.Path))
        {
            File.Delete(attachment.Path);
        }

        await _repository.DeleteAsync(id);
    }

    private (string PhysicalPath, string RelativePath) ResolveFolder(string? folderPath)
    {
        if (string.IsNullOrWhiteSpace(folderPath))
        {
            var month = DateTime.UtcNow.ToString("yyyy/MM");
            return (Path.Combine(_options.AbsoluteRootPath, month), month.Replace('\\', '/'));
        }

        var normalized = folderPath.Trim().TrimStart(Path.DirectorySeparatorChar, '/').Replace('\\', '/');
        return (Path.Combine(_options.AbsoluteRootPath, normalized), normalized);
    }
}
