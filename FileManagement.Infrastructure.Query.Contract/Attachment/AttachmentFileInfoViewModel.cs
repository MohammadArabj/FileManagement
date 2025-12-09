namespace FileManagement.Infrastructure.Query.Contract.Attachment;

public sealed record AttachmentFileInfoViewModel(Guid Guid, long FileSize, int ClassificationId, string? Description)
{
    public string FileName { get; init; } = "";
    public string OriginalFileName { get; init; } = "";
    public string ContentType { get; init; } = "application/octet-stream";
    public string Path { get; init; } = "";
}
