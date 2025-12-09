using Epc.Core;
using FileManagement.Application.Contract.Upload;

namespace FileManagement.Presentation.Facade.Contract.Upload;

public interface IUploadCommandFacade : IFacadeService
{
    Task<InitiateUploadResult> InitiateUpload(InitiateUpload command);
    Task<CompleteUploadResult> CompleteUpload(CompleteUpload command);
    Task CancelUpload(CancelUpload command);
    Task UpdateProgress(UpdateUploadProgress command);
}