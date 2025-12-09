using FileManagement.Common;

namespace FileManagement.Infrastructure.Query.Contract.Upload;

public class UploadSessionViewModel
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string TusFileId { get; set; }
    public string FileName { get; set; }
    public string ContentType { get; set; }
    public long TotalSize { get; set; }
    public long UploadedSize { get; set; }
    public double ProgressPercentage { get; set; }
    public UploadSessionStatus Status { get; set; }
    public string StatusText { get; set; }
    public DateTime Created { get; set; }
    public DateTime ExpiresAt { get; set; }
    public Guid CreatedBy { get; set; }
    public string CreatedByName { get; set; }
    public Guid? AttachmentGuid { get; set; }
}