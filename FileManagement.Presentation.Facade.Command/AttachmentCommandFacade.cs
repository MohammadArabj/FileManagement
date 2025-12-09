using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Application.Command;
using Epc.Company.Query;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Presentation.Facade.Contracts.Attachment;

namespace FileManagement.Presentation.Facade.Command;

public class AttachmentCommandFacade(ICommandBus commandBus,ICommandBusAsync commandBusAsync, IResponsiveCommandBus responsiveCommandBus,IResponsiveCommandBusAsync responsiveCommandBusAsync)
    : IAttachmentCommandFacade
{
    public async Task<Guid> Create(CreateAttachment command) => await responsiveCommandBusAsync.Dispatch<CreateAttachment, Guid>(command);

    public Task Edit(EditAttachment command) => commandBusAsync.Dispatch(command);

    public async Task<Result<bool>> Delete(Guid guid)
    {
        var model = new DeleteAttachmentGuidDto(guid);
        return await responsiveCommandBusAsync.Dispatch<DeleteAttachmentGuidDto, Result<bool>>(
            model);
    }

    //public void Delete(int id)
    //{
    //    var command = new DeleteAttachment(id);
    //    commandBusAsync.Dispatch(command);
    //}

    public async Task<UploadResult> UploadFile(UploadFileModel command) => await responsiveCommandBusAsync.Dispatch<UploadFileModel, UploadResult>(command);

    public async Task<List<UploadResult>> UploadFiles(UploadFileList command) =>await 
        responsiveCommandBusAsync.Dispatch<UploadFileList, List<UploadResult>>(command);
}