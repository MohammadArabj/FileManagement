using Epc.EntityFramework;
using FileManagement.Common;
using FileManagement.Domain.UploadSessionAgg;
using Microsoft.EntityFrameworkCore;

namespace FileManagement.Infrastructure.Persistence.Repositories;

public class UploadSessionRepository : BaseRepository<long, UploadSession>, IUploadSessionRepository
{
    private readonly FileManagementCommandContext _context;

    public UploadSessionRepository(FileManagementCommandContext context) : base(context)
    {
        _context = context;
    }

    public async Task<UploadSession?> GetByTusFileIdAsync(string tusFileId)
    {
        return await _context.UploadSessions
            .FirstOrDefaultAsync(x => x.TusFileId == tusFileId);
    }

    public async Task<List<UploadSession>> GetActiveSessionsByUserAsync(Guid userId)
    {
        return await _context.UploadSessions
            .Where(x => x.CreatedBy == userId &&
                        x.Status != UploadSessionStatus.Completed &&
                        x.Status != UploadSessionStatus.Cancelled &&
                        x.Status != UploadSessionStatus.Expired &&
                        x.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(x => x.Created)
            .ToListAsync();
    }

    public async Task<List<UploadSession>> GetExpiredSessionsAsync()
    {
        return await _context.UploadSessions
            .Where(x => x.Status != UploadSessionStatus.Completed &&
                        x.Status != UploadSessionStatus.Cancelled &&
                        x.Status != UploadSessionStatus.Expired &&
                        x.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync();
    }
}
