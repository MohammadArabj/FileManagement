using System;
using Epc.Application.Command;

namespace FileManagement.Application.Contracts.Attachment;

public class DeleteAttachmentGuidDto(Guid guid):ICommand
{
    public Guid Guid { get; set; } = guid;
}