using Epc.Application.FileValidation;
using Epc.Domain;
using Microsoft.AspNetCore.Http;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.ClassificationAgg;

namespace FileManagement.Domain.AttachmentAgg;

public class Attachment : AggregateRootBase<long>
{

    public int ClassificationId { get; private set; }
    public Classification Classification { get; private set; }
    public string FileName { get; private set; }
    public string OriginalFileName { get;private set; }
    public long FileSize { get;private set; }
    public string TusFileId { get;private set; }
    public string StoragePath { get;private set; }
    public string ContentType { get; private set; }
    public string? Description { get; private set; }
    public string Checksum { get; set; }
    protected Attachment()
    {
    }

    public Attachment(Guid creator, int classificationId, string fileName, string originalFileName, 
        string storagePath, string contentType, long fileSize, string tusFileId, string? description,
        string checksum) : base(creator)
    {
        ClassificationId = classificationId;
        FileName = fileName;
        OriginalFileName = originalFileName;
        StoragePath = storagePath;
        ContentType = contentType;
        FileSize = fileSize;
        TusFileId = tusFileId;
        Description = description;
        Checksum = checksum;
    }

    public void Edit(int classificationId, string? description, IAttachmentService service)
    {
        ClassificationId = classificationId;
        Description = description;
    }
}