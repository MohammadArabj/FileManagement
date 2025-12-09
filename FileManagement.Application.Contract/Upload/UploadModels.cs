using Epc.Application.Command;

namespace FileManagement.Application.Contract.Upload;

/// <summary>
/// درخواست شروع آپلود
/// </summary>
public record InitiateUpload(
    string ClientId,
    string FileName,
    string ContentType,
    long FileSize,
    string? FolderPath = null,
    int? ClassificationId = null,
    string? Description = null
):ICommand;

/// <summary>
/// نتیجه شروع آپلود
/// ✅ اصلاح شده: uploadUrl فقط endpoint است
/// </summary>
public record InitiateUploadResult(
    Guid SessionGuid,
    string TusFileId,      // فقط برای tracking داخلی
    string UploadUrl,      // ✅ فقط endpoint: "/api/Upload/tus"
    DateTime ExpiresAt
) : ICommand;

/// <summary>
/// درخواست تکمیل آپلود
/// ✅ TusFileId باید ID واقعی از URL آپلود باشد
/// </summary>
public record CompleteUpload(
    Guid SessionGuid,
    string TusFileId,      // ✅ ID واقعی که TUS Server ساخته
    string? Description = null
) : ICommand;

/// <summary>
/// نتیجه تکمیل آپلود
/// </summary>
public record CompleteUploadResult(
    Guid FileGuid,
    string FileName,
    long FileSize,
    string ContentType
) : ICommand;

/// <summary>
/// درخواست لغو آپلود
/// </summary>
public record CancelUpload(Guid SessionGuid) : ICommand;

/// <summary>
/// به‌روزرسانی پیشرفت آپلود
/// </summary>
public record UpdateUploadProgress(
    string TusFileId,
    long UploadedBytes
) : ICommand;

/// <summary>
/// پاسخ استاندارد API
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
    public static ApiResponse<T> Fail(string message) => new() { Success = false, Message = message };
}

/// <summary>
/// وضعیت آپلود TUS
/// </summary>
public class TusUploadStatus
{
    public string FileId { get; set; } = string.Empty;
    public long TotalSize { get; set; }
    public long UploadedSize { get; set; }
    public bool IsComplete { get; set; }

    public int ProgressPercentage => TotalSize > 0
        ? (int)Math.Round((double)UploadedSize / TotalSize * 100)
        : 0;
}