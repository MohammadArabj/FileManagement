namespace FileManagement.Infrastructure.Query.Contract.Attachment;

public sealed record AttachmentMetaDto(
    Guid Guid,
    string FileName,
    string? OriginalFileName,
    string ContentType,
    long FileSize,
    string Path
);

