using Epc.Core;
using FileManagement.Infrastructure.Query.Contract.Upload;

namespace FileManagement.Presentation.Facade.Contract.Upload;

public interface IUploadQueryFacade : IFacadeService
{
    Task<List<UploadSessionViewModel>> GetActiveUploads();
    Task<UploadSessionViewModel?> GetUploadSession(Guid sessionGuid);
    Task<UploadProgressViewModel?> GetProgress(string tusFileId);
}