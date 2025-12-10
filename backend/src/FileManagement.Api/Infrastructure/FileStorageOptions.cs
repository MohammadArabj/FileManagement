namespace FileManagement.Api.Infrastructure;

public class FileStorageOptions
{
    public string RootPath { get; set; } = Path.Combine("storage", "files");

    public string AbsoluteRootPath =>
        Path.IsPathRooted(RootPath)
            ? RootPath
            : Path.Combine(AppContext.BaseDirectory, RootPath);
}
