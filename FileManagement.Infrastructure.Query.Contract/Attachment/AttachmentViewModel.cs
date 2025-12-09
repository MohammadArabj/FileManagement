using System;

namespace FileManagement.Infrastructure.Query.Contracts.Attachment;

public class AttachmentViewModel
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string FileName { get; set; }
    public string? ContentType { get; set; }
    public string? Description { get; set; }
    public Guid CreatedByGuid { get; set; }
    public string CreatedBy { get; set; }
    public string Created { get; set; }
    public string Type { get; set; }
}