using System;
using Epc.Application.Command;

namespace FileManagement.Application.Contracts.Classification;

public class CreateClassification : ICommand
{
    public int SystemId { get; set; }
    public Guid SystemGuid { get; set; }
    public int? ParentId { get; set; }
    public string Title { get; set; }
}