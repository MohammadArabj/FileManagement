namespace FileManagement.Domain.Shared.Acls.UserManagement;

public class UserViewHelper
{
    public Guid Guid { get; set; }
    public string Fullname { get; set; }
    public string UserName { get; set; }
    public string Mobile { get; set; }
    public Guid UnitGuid { get; set; }
    public string? NationalCode { get; set; }
    public bool IsSuperAdmin { get; set; }
}