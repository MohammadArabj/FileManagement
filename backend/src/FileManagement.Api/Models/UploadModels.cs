using System.ComponentModel.DataAnnotations;

namespace FileManagement.Api.Models;

public class UploadFileModel
{
    [Required]
    public IFormFile File { get; set; } = default!;

    public string? Description { get; set; }
    public string? FolderPath { get; set; }
}

public class UploadResult
{
    public Guid Guid { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public string DownloadUrl { get; set; } = string.Empty;
}

public class InitiateUploadRequest
{
    [Required]
    public string FileName { get; set; } = string.Empty;

    [Required]
    public string ContentType { get; set; } = "application/octet-stream";

    public long FileSize { get; set; }
    public string? FolderPath { get; set; }
    public string? Description { get; set; }
}

public class CompleteUploadRequest
{
    [Required]
    public Guid SessionGuid { get; set; }

    [Required]
    public string TusFileId { get; set; } = string.Empty;

    public string? Description { get; set; }
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Message { get; set; }
}

public class TusUploadStatus
{
    public string FileId { get; set; } = string.Empty;
    public long TotalSize { get; set; }
    public long UploadedSize { get; set; }
    public bool IsComplete { get; set; }
    public int ProgressPercentage => TotalSize > 0 ? (int)Math.Round((double)UploadedSize / TotalSize * 100) : 0;
}
