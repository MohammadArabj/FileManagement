using FileManagement.Application.Contract.Upload;

namespace FileManagement.Application;

/// <summary> 
/// اینترفیس سرویس TUS 
/// </summary> 
public interface ITusFileService
{
    /// <summary> 
    /// دریافت Stream فایل آپلود شده 
    /// </summary> 
    Task<Stream?> GetFileStreamAsync(string tusFileId);
    /// <summary> 
    /// دریافت وضعیت آپلود 
    /// </summary> 
    Task<TusUploadStatus?> GetUploadStatusAsync(string tusFileId);
    /// <summary> 
    /// حذف فایل TUS 
    /// </summary> 
    Task<bool> DeleteFileAsync(string tusFileId);
    /// <summary> 
    /// دریافت متادیتا 
    /// </summary> 
    Task<Dictionary<string, string>?> GetMetadataAsync(string tusFileId);
    /// <summary> 
    /// بررسی وجود فایل 
    /// </summary> 
    bool FileExists(string tusFileId);
    /// <summary> 
    /// لیست فایل‌ها (برای debug) 
    /// </summary> 
    IEnumerable<string> GetAllFiles();
}