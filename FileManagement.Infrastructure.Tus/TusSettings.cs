namespace FileManagement.Infrastructure.Tus;

public class TusSettings
{
    public string StoragePath { get; set; } = "wwwroot/tus-uploads";
    // ❌ حذف شد - وقتی از MapTus استفاده می‌کنیم نباید ست شود 
    // public string UrlPath { get; set; } = "/api/Upload/tus"; 
    public long MaxFileSizeBytes { get; set; } = 5L * 1024 * 1024 * 1024; // 5GB 
    public int ExpirationHours { get; set; } = 24;
    public string[] BlockedExtensions { get; set; } = new[]
    {
        ".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".msi", ".scr", ".com"
    };
}
