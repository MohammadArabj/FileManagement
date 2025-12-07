using FileManagement.Api.Models;

namespace FileManagement.Api.Services;

public interface ITusFileService
{
    Task<Stream?> GetFileStreamAsync(string tusFileId);
    Task<TusUploadStatus?> GetUploadStatusAsync(string tusFileId);
    Task<Dictionary<string, string>?> GetMetadataAsync(string tusFileId);
    Task<bool> DeleteFileAsync(string tusFileId);
    bool FileExists(string tusFileId);
    IEnumerable<string> GetAllFiles();
}
