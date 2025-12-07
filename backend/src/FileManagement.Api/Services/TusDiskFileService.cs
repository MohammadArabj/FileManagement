using FileManagement.Api.Infrastructure;
using FileManagement.Api.Models;
using Microsoft.Extensions.Options;
using System.Linq;
using tusdotnet.Interfaces;
using tusdotnet.Stores;

namespace FileManagement.Api.Services;

public class TusDiskFileService : ITusFileService
{
    private readonly TusDiskStore _store;
    private readonly string _storagePath;
    private readonly ILogger<TusDiskFileService> _logger;

    public TusDiskFileService(IOptions<TusSettings> options, ILogger<TusDiskFileService> logger)
    {
        _logger = logger;
        _storagePath = Path.Combine(AppContext.BaseDirectory, options.Value.StoragePath);
        Directory.CreateDirectory(_storagePath);
        _store = new TusDiskStore(_storagePath);
    }

    public async Task<Stream?> GetFileStreamAsync(string tusFileId)
    {
        var file = await _store.GetFileAsync(tusFileId, CancellationToken.None);
        if (file == null)
        {
            var path = Path.Combine(_storagePath, tusFileId);
            return File.Exists(path) ? new FileStream(path, FileMode.Open, FileAccess.Read) : null;
        }

        return await file.GetContentAsync(CancellationToken.None);
    }

    public async Task<TusUploadStatus?> GetUploadStatusAsync(string tusFileId)
    {
        var uploadLength = await _store.GetUploadLengthAsync(tusFileId, CancellationToken.None) ?? 0;
        var uploaded = await _store.GetUploadOffsetAsync(tusFileId, CancellationToken.None);

        if (uploaded < 0 && !FileExists(tusFileId))
        {
            return null;
        }

        return new TusUploadStatus
        {
            FileId = tusFileId,
            TotalSize = uploadLength,
            UploadedSize = uploaded,
            IsComplete = uploadLength > 0 && uploaded >= uploadLength
        };
    }

    public async Task<Dictionary<string, string>?> GetMetadataAsync(string tusFileId)
    {
        var file = await _store.GetFileAsync(tusFileId, CancellationToken.None);
        if (file == null)
        {
            return null;
        }

        var metadata = await file.GetMetadataAsync(CancellationToken.None);
        return metadata.ToDictionary(k => k.Key, v => v.Value.GetString(System.Text.Encoding.UTF8));
    }

    public async Task<bool> DeleteFileAsync(string tusFileId)
    {
        if (_store is ITusTerminationStore terminator)
        {
            await terminator.DeleteFileAsync(tusFileId, CancellationToken.None);
            return true;
        }

        return false;
    }

    public bool FileExists(string tusFileId)
    {
        var path = Path.Combine(_storagePath, tusFileId);
        return File.Exists(path);
    }

    public IEnumerable<string> GetAllFiles()
    {
        if (!Directory.Exists(_storagePath)) yield break;

        foreach (var file in Directory.GetFiles(_storagePath))
        {
            if (!file.EndsWith(".metadata", StringComparison.OrdinalIgnoreCase))
            {
                yield return Path.GetFileName(file);
            }
        }
    }
}
