using System;

namespace FileManagement.Application.Contracts.Attachment
{
    public class EditAttachment : CreateAttachment
    {
        public Guid Guid { get; set; }
    }
}