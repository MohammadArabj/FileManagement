using System;

namespace FileManagement.Application.Contracts.Attachment;

public class UploadResult(Guid guid)
{
    public Guid Guid { get; set; } = guid;
}