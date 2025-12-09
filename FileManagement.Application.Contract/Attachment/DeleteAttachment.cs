using Epc.Application.Command;

namespace FileManagement.Application.Contracts.Attachment;

public class DeleteAttachment(int id) : ICommand
{
    public int Id { get; set; } = id;
}