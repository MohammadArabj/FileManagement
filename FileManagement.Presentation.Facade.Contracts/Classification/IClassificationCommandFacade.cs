using System;
using Epc.Core;
using FileManagement.Application.Contracts.Classification;

namespace FileManagement.Presentation.Facade.Contracts.Classification
{
    public interface IClassificationCommandFacade : IFacadeService
    {
        Guid Create(CreateClassification command);
        void Edit(EditClassification command);
        void Delete(int id);
    }
}
