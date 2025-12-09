
public record AttachmentDto(Guid Guid, string? OriginalFileName, long FileSize, DateTime Created)
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
}