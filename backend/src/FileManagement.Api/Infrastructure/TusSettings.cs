namespace FileManagement.Api.Infrastructure;

public class TusSettings
{
    public string StoragePath { get; set; } = Path.Combine("storage", "tus");
    public long MaxFileSizeBytes { get; set; } = 5L * 1024 * 1024 * 1024;
    public int ExpirationHours { get; set; } = 24;
}
