namespace FileManagement.Infrastructure.Query.Contract.Attachment
{
    public class FileInfoDto
    {
        public string Guid { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string? OriginalFileName { get; set; }
        public string ContentType { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string? CreatedAt { get; set; }
    }
}