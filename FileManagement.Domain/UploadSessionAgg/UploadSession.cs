using Epc.Domain;
using FileManagement.Common;

namespace FileManagement.Domain.UploadSessionAgg;

/// <summary>
/// موجودیت جلسه آپلود برای پیگیری آپلودهای TUS
/// </summary>
public class UploadSession : AggregateRootBase<long>
{
    public string TusFileId { get; private set; }
    public string FileName { get; private set; }
    public string ContentType { get; private set; }
    public long TotalSize { get; private set; }
    public long UploadedSize { get; private set; }
    public int? ClassificationId { get; private set; }
    public Guid SystemGuid { get; private set; }
    public string? FolderPath { get; private set; }
    public string? Metadata { get; private set; }
    public UploadSessionStatus Status { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public string? ErrorMessage { get; private set; }
    public int RetryCount { get; private set; }
    public Guid? AttachmentGuid { get; private set; }

    protected UploadSession() { }

    public UploadSession(
        Guid creator,
        string tusFileId,
        string fileName,
        string contentType,
        long totalSize,
        Guid systemGuid,
        string? folderPath = null,
        int? classificationId = null,
        string? metadata = null) : base(creator)
    {
        TusFileId = tusFileId;
        FileName = fileName;
        ContentType = contentType;
        TotalSize = totalSize;
        UploadedSize = 0;
        SystemGuid = systemGuid;
        FolderPath = folderPath;
        ClassificationId = classificationId;
        Metadata = metadata;
        Status = UploadSessionStatus.Created;
        ExpiresAt = DateTime.UtcNow.AddHours(24);
        RetryCount = 0;
    }

    public void UpdateProgress(long uploadedSize)
    {
        UploadedSize = uploadedSize;
        if (Status == UploadSessionStatus.Created)
            Status = UploadSessionStatus.InProgress;
    }

    public void Complete(Guid attachmentGuid)
    {
        Status = UploadSessionStatus.Completed;
        CompletedAt = DateTime.UtcNow;
        UploadedSize = TotalSize;
        AttachmentGuid = attachmentGuid;
    }

    public void Fail(string errorMessage)
    {
        Status = UploadSessionStatus.Failed;
        ErrorMessage = errorMessage;
        RetryCount++;
    }

    public void Pause() => Status = UploadSessionStatus.Paused;

    public void Cancel() => Status = UploadSessionStatus.Cancelled;

    public void SetClassification(int classificationId) => ClassificationId = classificationId;

    public double GetProgressPercentage() => 
        TotalSize == 0 ? 0 : Math.Round((double)UploadedSize / TotalSize * 100, 2);

    public bool IsExpired() => DateTime.UtcNow > ExpiresAt;

    public bool CanResume() =>
        Status is UploadSessionStatus.Failed or UploadSessionStatus.Paused
        && !IsExpired() && RetryCount < 5;

    public void UpdateTusFileId(string realTusFileId)
    {
        TusFileId= realTusFileId;
    }

    public void BindTusFileId(string tusFileId)
    {
        if (string.IsNullOrWhiteSpace(tusFileId)) return;
        TusFileId = tusFileId;
    }

   
}
