using System.Collections.Generic;
using Epc.Core;
using FileManagement.Application.Contracts.Classification;
using FileManagement.Infrastructure.Query.Contracts.Classification;

namespace FileManagement.Presentation.Facade.Contracts.Classification
{
    public interface IClassificationQueryFacade : IFacadeService
    {
        List<AttachmentClassificationViewModel> GetList();
        EditClassification GetBy(int id);
        List<AttachmentClassificationComboModel> GetForCombo(string condition);
        List<ClassificationForTreeViewModel> GetForTree();
    }
}