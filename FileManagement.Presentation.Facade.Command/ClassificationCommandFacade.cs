using System;
using Epc.Application.Command;
using FileManagement.Application.Contracts.Classification;
using FileManagement.Presentation.Facade.Contracts.Classification;

namespace FileManagement.Presentation.Facade;

public class ClassificationCommandFacade(ICommandBus commandBus, IResponsiveCommandBus responsiveCommandBus)
    : IClassificationCommandFacade
{
    public Guid Create(CreateClassification command) =>
        responsiveCommandBus.Dispatch<CreateClassification, Guid>(command);

    public void Edit(EditClassification command) => commandBus.Dispatch(command);

    public void Delete(int id)
    {
        var command = new DeleteClassification(id);
        commandBus.Dispatch(command);
    }
}