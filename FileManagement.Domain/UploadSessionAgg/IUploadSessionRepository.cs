using Epc.Domain;

namespace FileManagement.Domain.UploadSessionAgg;

public interface IUploadSessionRepository : IRepository<long, UploadSession>
{
    Task<UploadSession?> GetByTusFileIdAsync(string tusFileId);
    Task<List<UploadSession>> GetActiveSessionsByUserAsync(Guid userId);
    Task<List<UploadSession>> GetExpiredSessionsAsync();
}
