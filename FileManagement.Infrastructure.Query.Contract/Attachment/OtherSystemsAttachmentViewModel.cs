using System;

namespace FileManagement.Infrastructure.Query.Contracts.Attachment;

public class OtherSystemsAttachmentViewModel
{
    public long Id { get; set; }
    public Guid Guid { get; set; }
    public string Title { get; set; }
    public string? Path { get; set; }
    public string FileName { get; set; }
    public string? Description { get; set; }
    public string Type { get; set; }
    public int? ParentId { get; set; }
}