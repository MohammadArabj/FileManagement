using Epc.Dapper;
using Epc.EntityFramework;
using FileManagement.Domain.ClassificationAgg;
using Microsoft.EntityFrameworkCore;

namespace FileManagement.Infrastructure.Persistence.Repositories;

public class ClassificationRepository(FileManagementCommandContext context, BaseDapperRepository repository) : BaseRepository<int, Classification>(context), IClassificationRepository
{

    public string GetParentGuidPath(int id)
    {
        var guids = repository.Select<Guid>($@"
            WITH CTE AS (
	            SELECT ID, GUID, ParentId, Title FROM Classifications WHERE ID = {id}
	            UNION ALL
	            SELECT C.ID, C.GUID, C.ParentId, C.Title FROM Classifications AS C 
	            INNER JOIN CTE ON C.Id = CTE.ParentId
            )
            SELECT GUID FROM CTE
            ");

        return string.Join("/", guids);
    }

    public Classification? GetByTitle(string rootFolderName, Guid systemGuid, int? parnetId)
    {
        var classification = context.Classifications.FirstOrDefault(c =>
            c.ParentId == parnetId && c.Title == rootFolderName && c.SystemGuid == systemGuid);
        return classification;
    }
}

