using Epc.Core;
using FileManagement.Application;
using FileManagement.Application.Contract.Upload;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using tusdotnet.Interfaces;
using tusdotnet.Stores;

namespace FileManagement.Infrastructure.Tus;
/// <summary> 
/// پیاده‌سازی سرویس TUS 
/// </summary> 
public class TusFileService : ITusFileService
{
    private readonly string _storagePath;
    private readonly ILogger<TusFileService> _logger;
    private readonly TusDiskStore _store;
    public TusFileService(IConfiguration configuration, ILogger<TusFileService> logger)
    {
        _logger = logger;
        // ✅ مسیر را دقیقاً مثل TusConfiguration بساز! 
        var relativePath = configuration["TusSettings:StoragePath"] ?? "wwwroot/tus-uploads";
        _storagePath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);
        _logger.LogInformation("TusFileService initialized with storage path: {Path}", _storagePath);
        if (!Directory.Exists(_storagePath))
        {
            Directory.CreateDirectory(_storagePath);
            _logger.LogInformation("Created TUS storage directory: {Path}", _storagePath);
        }
        _store = new TusDiskStore(_storagePath);
    }
    public async Task<Stream?> GetFileStreamAsync(string tusFileId)
    {
        try
        {
            _logger.LogDebug("Getting file stream for TUS file: {FileId}", tusFileId);
            // ✅ اول چک کن فایل فیزیکی وجود دارد 
            var filePath = Path.Combine(_storagePath, tusFileId);
            if (!File.Exists(filePath))
            {
                _logger.LogWarning("TUS file does not exist on disk: {Path}", filePath);
                // لیست فایل‌های موجود برای debug 
                var existingFiles = Directory.GetFiles(_storagePath).Select(Path.GetFileName);
                _logger.LogDebug("Existing files in storage: {Files}", string.Join(", ", existingFiles));
                return null;
            }
            var file = await _store.GetFileAsync(tusFileId, CancellationToken.None);
            if (file == null)
            {
                _logger.LogWarning("TUS store returned null for file: {FileId}", tusFileId);
                // ✅ Fallback: مستقیم فایل را بخوان 
                _logger.LogInformation("Using direct file read fallback for: {FileId}", tusFileId);
                return new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            }
            return await file.GetContentAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting TUS file stream: {FileId}", tusFileId);
            return null;
        }
    }
    public async Task<TusUploadStatus?> GetUploadStatusAsync(string tusFileId)
    {
        try
        {
            _logger.LogDebug("Getting upload status for TUS file: {FileId}", tusFileId);
            // ✅ اول چک کن فایل فیزیکی وجود دارد 
            var filePath = Path.Combine(_storagePath, tusFileId);
            var directory = Path.GetDirectoryName(filePath);
            // اگر پوشه وجود ندارد → ایجاد کن 
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
                _logger.LogInformation("Directory created: {Directory}", directory);
            }
            var uploadLengthPath = filePath + ".uploadlength";
            // ✅ روش اول: از Store استفاده کن 
            var file = await _store.GetFileAsync(tusFileId, CancellationToken.None);
            if (file != null)
            {
                var uploadLength = await _store.GetUploadLengthAsync(tusFileId, CancellationToken.None) ?? 0;
                var uploadOffset = await _store.GetUploadOffsetAsync(tusFileId, CancellationToken.None);
                return new TusUploadStatus
                {
                    FileId = tusFileId,
                    TotalSize = uploadLength,
                    UploadedSize = uploadOffset,
                    IsComplete = uploadLength > 0 && uploadOffset >= uploadLength
                };
            }
            // ✅ روش دوم (Fallback): مستقیم از فایل‌ها بخوان 
            _logger.LogInformation("Using fallback method to get upload status for: {FileId}", tusFileId);
            long totalSize = 0;
            long uploadedSize = new FileInfo(filePath).Length;
            // خواندن uploadlength از فایل متادیتا 
            if (File.Exists(uploadLengthPath))
            {
                var lengthStr = await File.ReadAllTextAsync(uploadLengthPath);
                if (long.TryParse(lengthStr, out var length))
                {
                    totalSize = length;
                }
            }
            else
            {
                // اگر فایل uploadlength نبود، یعنی آپلود کامل شده 
                totalSize = uploadedSize;
            }
            return new TusUploadStatus
            {
                FileId = tusFileId,
                TotalSize = totalSize,
                UploadedSize = uploadedSize,
                IsComplete = totalSize > 0 && uploadedSize >= totalSize
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting TUS upload status: {FileId}", tusFileId);
            return null;
        }
    }
    public async Task<bool> DeleteFileAsync(string tusFileId)
    {
        try
        {
            _logger.LogInformation("Deleting TUS file: {FileId}", tusFileId);
            if (_store is ITusTerminationStore terminationStore)
            {
                await terminationStore.DeleteFileAsync(tusFileId, CancellationToken.None);
                _logger.LogInformation("TUS file deleted via store: {FileId}", tusFileId);
                return true;
            }
            // ✅ حذف دستی همه فایل‌های مرتبط 
            var filePath = Path.Combine(_storagePath, tusFileId);
            var relatedFiles = new[]
            {
                filePath,
                filePath + ".metadata",
                filePath + ".chunkcomplete",
                filePath + ".uploadlength",
                filePath + ".chunkstart",
                filePath + ".expiration"
            };
            foreach (var path in relatedFiles)
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                    _logger.LogDebug("Deleted file: {Path}", path);
                }
            }
            _logger.LogInformation("TUS file manually deleted: {FileId}", tusFileId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting TUS file: {FileId}", tusFileId);
            return false;
        }
    }
    /// <summary> 
    /// دریافت متادیتای فایل TUS 
    /// </summary> 
    public async Task<Dictionary<string, string>?> GetMetadataAsync(string tusFileId)
    {
        try
        {
            var file = await _store.GetFileAsync(tusFileId, CancellationToken.None);
            if (file != null)
            {
                var metadata = await file.GetMetadataAsync(CancellationToken.None);
                return metadata.ToDictionary(
                    kvp => kvp.Key,
                    kvp => kvp.Value.GetString(System.Text.Encoding.UTF8));
            }
            // ✅ Fallback: خواندن مستقیم از فایل metadata 
            var metadataPath = Path.Combine(_storagePath, tusFileId + ".metadata");
            if (File.Exists(metadataPath))
            {
                var result = new Dictionary<string, string>();
                var lines = await File.ReadAllLinesAsync(metadataPath);
                foreach (var line in lines)
                {
                    var parts = line.Split(' ', 2);
                    if (parts.Length == 2)
                    {
                        var key = parts[0];
                        var value = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
                        result[key] = value;
                    }
                }
                return result;
            }
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting TUS metadata: {FileId}", tusFileId);
            return null;
        }
    }
    /// <summary> 
    /// بررسی وجود فایل 
    /// </summary> 
    public bool FileExists(string tusFileId)
    {
        var filePath = Path.Combine(_storagePath, tusFileId);
        return File.Exists(filePath);
    }
    /// <summary> 
    /// لیست فایل‌های موجود در storage (برای debug) 
    /// </summary> 
    public IEnumerable<string> GetAllFiles()
    {
        if (!Directory.Exists(_storagePath))
            return Enumerable.Empty<string>();
        return Directory.GetFiles(_storagePath)
            .Where(f => !f.EndsWith(".metadata") &&
                        !f.EndsWith(".uploadlength") &&
                        !f.EndsWith(".chunkcomplete"))
            .Select(Path.GetFileName)!;
    }
}