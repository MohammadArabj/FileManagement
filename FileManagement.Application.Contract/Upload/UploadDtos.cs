using FileManagement.Common;

namespace FileManagement.Application.Contract.Upload;

/// <summary>
/// لیست آپلودهای فعال
/// </summary>
public class UploadDtos
{
    public Guid SessionGuid { get; set; }
    public string TusFileId { get; set; }
    public string FileName { get; set; }
    public long TotalSize { get; set; }
    public long UploadedSize { get; set; }
    public double ProgressPercentage { get; set; }
    public UploadSessionStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
