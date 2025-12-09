using Epc.Application.Query;
using FileManagement.Infrastructure.Query.Contract.Upload;
using FileManagement.Presentation.Facade.Contract.Upload;

namespace FileManagement.Presentation.Facade.Query;

public class UploadQueryFacade(IQueryBusAsync queryBusAsync) : IUploadQueryFacade
{
    public async Task<List<UploadSessionViewModel>> GetActiveUploads() =>
        await queryBusAsync.Dispatch<List<UploadSessionViewModel>>();

    public async Task<UploadSessionViewModel?> GetUploadSession(Guid sessionGuid) =>
        await queryBusAsync.Dispatch<UploadSessionViewModel?, Guid>(sessionGuid);

    public async Task<UploadProgressViewModel?> GetProgress(string tusFileId) =>
        await queryBusAsync.Dispatch<UploadProgressViewModel?, string>(tusFileId);
}

