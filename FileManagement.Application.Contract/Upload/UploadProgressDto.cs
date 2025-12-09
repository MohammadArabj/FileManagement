using FileManagement.Common;

namespace FileManagement.Application.Contract.Upload;

/// <summary>
/// وضعیت پیشرفت آپلود
/// </summary>
/// <param name="SessionGuid"></param>
/// <param name="FileName"></param>
/// <param name="UploadedBytes"></param>
/// <param name="TotalBytes"></param>
/// <param name="ProgressPercentage"></param>
/// <param name="Status"></param>
/// <param name="ErrorMessage"></param>
public record UploadProgressDto(Guid SessionGuid, string FileName, long UploadedBytes, long TotalBytes, double ProgressPercentage, UploadSessionStatus Status, string? ErrorMessage);
