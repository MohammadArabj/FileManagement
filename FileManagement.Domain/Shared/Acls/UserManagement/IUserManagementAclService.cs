using Epc.Core;

namespace FileManagement.Domain.Shared.Acls.UserManagement;

public interface IUserManagementAclService : IAclService
{
    Task<SystemViewHelper> GetSystemByAsync(string clientId);
    Task<List<UserViewHelper>> GetUsersByGuidsAsync(List<Guid?> userGuids);


}