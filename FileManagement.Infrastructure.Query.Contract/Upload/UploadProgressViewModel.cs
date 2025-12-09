using FileManagement.Common;

namespace FileManagement.Infrastructure.Query.Contract.Upload;

/// <summary>
/// مدل پیشرفت آپلود برای SignalR
/// </summary>
/// <param name="SessionGuid"></param>
/// <param name="FileName"></param>
/// <param name="UploadedBytes"></param>
/// <param name="TotalBytes"></param>
/// <param name="ProgressPercentage"></param>
/// <param name="SpeedBytesPerSecond"></param>
/// <param name="RemainingSeconds"></param>
/// <param name="Status"></param>
/// <param name="ErrorMessage"></param>
public record UploadProgressViewModel(Guid SessionGuid, string FileName, long UploadedBytes, long TotalBytes, double ProgressPercentage, double SpeedBytesPerSecond, int RemainingSeconds, UploadSessionStatus Status, string? ErrorMessage);
