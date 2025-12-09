using System;
using Epc.Application.Command;
using Epc.Identity;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.ClassificationAgg.Service;
using FileManagement.Application.Contracts.Classification;

namespace FileManagement.Application;

public class ClassificationCommandHandler(
    IClaimHelper claimHelper,
    IClassificationRepository classificationRepository,
    IClassificationService classificationService)
    :
        ICommandHandler<CreateClassification, Guid>,
        ICommandHandler<EditClassification>,
        ICommandHandler<DeleteClassification>
{
    public Guid Handle(CreateClassification command)
    {
        var creator = claimHelper.GetCurrentUserGuid();

        var attachmentClassification = new Classification(creator, command.SystemGuid, command.SystemId, command.Title,
            command.ParentId, classificationService);

        classificationRepository.Create(attachmentClassification);

        return attachmentClassification.Guid;
    }

    public void Handle(EditClassification command)
    {
        var actor = claimHelper.GetCurrentUserGuid();
        var classification = classificationRepository.Load(command.Id);

        classification.Edit(actor, command.Title, classificationService);

        classificationRepository.Update(classification);
    }

    public void Handle(DeleteClassification command)
    {
        var classification = classificationRepository.Load(command.Id);
        classificationRepository.Delete(classification);
    }
}