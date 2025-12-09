using FileManagement.Common;

namespace FileManagement.Infrastructure.Query.Contract.Upload;

/// <summary>
/// مدل جستجوی جلسات آپلود
/// </summary>
public class UploadSessionSearchModel
{
    public Guid? UserGuid { get; set; }
    public UploadSessionStatus? Status { get; set; }
    public Guid? SystemGuid { get; set; }
}
