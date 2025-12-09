namespace FileManagement.Domain.Shared.Storage;

public interface IFileStorage
{
    Task SaveAsync(Stream content, string relativePath, CancellationToken ct);
    Task DeleteAsync(string relativePath, CancellationToken ct);
    string GetAbsolutePath(string relativePath);
}
