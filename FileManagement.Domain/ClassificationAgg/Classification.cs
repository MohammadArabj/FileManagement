using Epc.Domain;
using FileManagement.Domain.ClassificationAgg.Service;

namespace FileManagement.Domain.ClassificationAgg;

public class Classification : AuditableAggregateRootBase<int>
{
    public Guid SystemGuid { get; private set; }
    public int? ParentId { get; private set; }
    public string Title { get; private set; }

    protected Classification()
    {
    }

    public Classification(Guid creator, Guid systemGuid, int systemId, string title, int? parentId, IClassificationService service) :
        base(creator)
    {
        SystemGuid = systemGuid;
        
        if (systemId != parentId)
            ParentId = parentId;
        
        Title = title;
    }

    public void Edit(Guid actor, string name, IClassificationService service)
    {
        Title = name;

        Modified(actor);
    }
}