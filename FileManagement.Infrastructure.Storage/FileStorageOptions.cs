namespace FileManagement.Infrastructure.Storage;

public class FileStorageOptions
{
    public string BasePath { get; set; } = default!;
    public string TusTempPath { get; set; } = default!;
}
