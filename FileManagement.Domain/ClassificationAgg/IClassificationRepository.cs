using Epc.Domain;

namespace FileManagement.Domain.ClassificationAgg;

public interface IClassificationRepository : IRepository<int, Classification>
{
    string GetParentGuidPath(int id);
    Classification? GetByTitle(string rootFolderName, Guid systemGuid,  int? parnetId);
}