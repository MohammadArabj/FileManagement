using System;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace FileManagement.Application.Contracts.Attachment;

public class CreateAttachment : ICommand
{
    public Guid SystemGuid { get; set; }
    public int SystemId { get; set; }
    public IFormFile File { get; set; }
    public int ClassificationId { get; set; }
    public string? Description { get; set; }
}