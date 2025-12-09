using Epc.EntityFramework;
using FileManagement.Domain.AttachmentAgg;

namespace FileManagement.Infrastructure.Persistence.Repositories;

public class AttachmentRepository(FileManagementCommandContext context) : BaseRepository<long, Attachment>(context), IAttachmentRepository
{
    public Task DeleteAsync(Guid guid)
    {
        throw new NotImplementedException();
    }

    public Task GetMetaAsync(Guid guid)
    {
        throw new NotImplementedException();
    }

    public Task GetMetaBatchAsync(List<Guid> guids)
    {
        throw new NotImplementedException();
    }
}