using System;

namespace FileManagement.Infrastructure.Query.Contracts.Attachment
{
    public class AttachmentDownload
    {
        public byte[] File { get; set; }
        public string Path { get; set; }
        public string ContentType { get; set; }
        public string FileName { get; set; }
        public Guid Guid { get; set; }
    }
}