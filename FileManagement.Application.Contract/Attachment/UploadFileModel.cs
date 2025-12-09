using System;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace FileManagement.Application.Contracts.Attachment;

public class UploadFileModel:ICommand
{
    public string FolderPath { get; set; }
    public string SystemGuid { get; set; }
    public IFormFile File { get; set; }
}
