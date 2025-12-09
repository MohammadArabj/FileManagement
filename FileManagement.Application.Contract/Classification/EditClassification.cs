namespace FileManagement.Application.Contracts.Classification;

public class EditClassification : CreateClassification
{
    public int Id { get; set; }
    public string? ParentCode { get; set; }
}