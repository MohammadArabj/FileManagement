using System.Collections.Generic;
using Epc.Application.Command;
using Microsoft.AspNetCore.Http;

namespace FileManagement.Application.Contracts.Attachment;

public class UploadFileList : ICommand
{
    public string SystemGuid { get; set; }
    public string FolderPath { get; set; }
    public List<IFormFile> Files { get; set; } = [];
}
