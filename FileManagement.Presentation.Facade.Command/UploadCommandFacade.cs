using Epc.Application.Command;
using FileManagement.Application.Contract.Upload;
using FileManagement.Presentation.Facade.Contract.Upload;

namespace FileManagement.Presentation.Facade.Command;

public class UploadCommandFacade(
    IResponsiveCommandBusAsync responsiveCommandBusAsync,
    ICommandBusAsync commandBusAsync)
    : IUploadCommandFacade
{
    public async Task<InitiateUploadResult> InitiateUpload(InitiateUpload command) =>
        await responsiveCommandBusAsync.Dispatch<InitiateUpload, InitiateUploadResult>(command);

    public async Task<CompleteUploadResult> CompleteUpload(CompleteUpload command) =>
        await responsiveCommandBusAsync.Dispatch<CompleteUpload, CompleteUploadResult>(command);

    public async Task CancelUpload(CancelUpload command) =>
        await commandBusAsync.Dispatch(command);

    public async Task UpdateProgress(UpdateUploadProgress command) =>
        await commandBusAsync.Dispatch(command);
}
