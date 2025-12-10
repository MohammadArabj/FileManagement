using FileManagement.Api.Models;
using System.Linq;

namespace FileManagement.Api.Services;

public interface IAttachmentRepository
{
    Task<AttachmentDto?> GetAsync(Guid id);
    Task<IReadOnlyList<AttachmentDto>> GetAllAsync(string? folderPath = null);
    Task AddAsync(AttachmentDto attachment);
    Task DeleteAsync(Guid id);
}

public class InMemoryAttachmentRepository : IAttachmentRepository
{
    private readonly List<AttachmentDto> _attachments = new();
    private readonly object _lock = new();

    public Task AddAsync(AttachmentDto attachment)
    {
        lock (_lock)
        {
            _attachments.Add(attachment);
        }

        return Task.CompletedTask;
    }

    public Task DeleteAsync(Guid id)
    {
        lock (_lock)
        {
            var item = _attachments.FirstOrDefault(x => x.Guid == id);
            if (item != null)
            {
                _attachments.Remove(item);
            }
        }

        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AttachmentDto>> GetAllAsync(string? folderPath = null)
    {
        lock (_lock)
        {
            var normalized = Normalize(folderPath);
            var data = string.IsNullOrEmpty(normalized)
                ? _attachments.ToList()
                : _attachments.Where(x => string.Equals(x.FolderPath, normalized, StringComparison.OrdinalIgnoreCase)).ToList();
            return Task.FromResult<IReadOnlyList<AttachmentDto>>(data);
        }
    }

    public Task<AttachmentDto?> GetAsync(Guid id)
    {
        lock (_lock)
        {
            return Task.FromResult(_attachments.FirstOrDefault(x => x.Guid == id));
        }
    }

    private static string Normalize(string? folderPath)
    {
        return string.IsNullOrWhiteSpace(folderPath)
            ? string.Empty
            : folderPath.Trim().TrimStart(Path.DirectorySeparatorChar, '/').Replace('\\', '/');
    }
}
