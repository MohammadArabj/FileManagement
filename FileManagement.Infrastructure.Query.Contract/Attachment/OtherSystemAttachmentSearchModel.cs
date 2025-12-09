using System;

namespace FileManagement.Infrastructure.Query.Contracts.Attachment;

public class OtherSystemAttachmentSearchModel
{
    public Guid SystemGuid { get; set; }
    public int Type { get; set; }
    public string Term { get; set; }
}