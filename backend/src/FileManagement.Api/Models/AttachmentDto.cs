namespace FileManagement.Api.Models;

public record AttachmentDto(
    Guid Guid,
    string FileName,
    string ContentType,
    string Path,
    string FolderPath,
    string? Description,
    DateTime CreatedAt,
    long FileSize);
