using Epc.Application.Command;

namespace FileManagement.Application.Contracts.Classification;

public class DeleteClassification(int id) : ICommand
{
    public int Id { get; set; } = id;
}