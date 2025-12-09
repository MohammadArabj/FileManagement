using System.Collections.Generic;
using Epc.Application.Query;
using FileManagement.Application.Contracts.Classification;
using FileManagement.Infrastructure.Query.Contracts.Classification;
using FileManagement.Presentation.Facade.Contracts.Classification;

namespace FileManagement.Presentation.Facade.Query;

public class ClassificationQueryFacade(IQueryBus queryBus) : IClassificationQueryFacade
{
    public List<AttachmentClassificationViewModel> GetList() =>
        queryBus.Dispatch<List<AttachmentClassificationViewModel>>();

    public EditClassification GetBy(int id) => queryBus.Dispatch<EditClassification, int>(id);

    public List<AttachmentClassificationComboModel> GetForCombo(string condition) =>
        queryBus.Dispatch<List<AttachmentClassificationComboModel>, string>(condition);

    public List<ClassificationForTreeViewModel> GetForTree() =>
        queryBus.Dispatch<List<ClassificationForTreeViewModel>>();
}