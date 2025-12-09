using System.Linq.Expressions;

namespace FileManagement.Domain.ClassificationAgg.Service;

public class ClassificationService : IClassificationService
{
    private Expression<Func<Classification, bool>> _predicate;
    private readonly IClassificationRepository _classificationRepository;

    public ClassificationService(IClassificationRepository classificationRepository)
    {
        _classificationRepository = classificationRepository;
    }
}