using Epc.Application.FileValidation;
using Epc.Application.Query;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Infrastructure.Query.Contract.Attachment;
using FileManagement.Infrastructure.Query.Contracts.Attachment;
using FileManagement.Presentation.Facade.Contracts.Attachment;

public class AttachmentQueryFacade(IQueryBus queryBus, IQueryBusAsync queryBusAsync, IFileService fileService) : IAttachmentQueryFacade
{
    public async Task<List<AttachmentViewModel>> GetList(AttachmentSearchModel searchModel) => await
    queryBusAsync.Dispatch<List<AttachmentViewModel>, AttachmentSearchModel>(searchModel);
    public async Task<EditAttachment> GetBy(int id) => await queryBusAsync.Dispatch<EditAttachment, int>(id);
    public async Task<AttachmentDownload> Download(Guid guid)
    {
        var result = await queryBusAsync.Dispatch<AttachmentDownload, Guid>(guid);
        if (result != null)
            result.File = fileService.Download(result.Path);
        return result;
    }
    public async Task<List<OtherSystemsAttachmentViewModel>> GetForOtherSystems(OtherSystemAttachmentSearchModel searchModel) => await
    queryBusAsync.Dispatch<List<OtherSystemsAttachmentViewModel>, OtherSystemAttachmentSearchModel>(searchModel);
    public async Task<AttachmentNameViewModel> GetFileNameBy(Guid guid) => await queryBusAsync.Dispatch<AttachmentNameViewModel, Guid>(guid);
    public async Task<AttachmentDto> GetFile(Guid guid) => await queryBusAsync.Dispatch<AttachmentDto, Guid>(guid);
    public async Task<List<AttachmentDownload>> DownloadFiles(List<Guid> guids) => await queryBusAsync.Dispatch<List<AttachmentDownload>, List<Guid>>(guids);

    public async Task<AttachmentMetaDto?> GetMeta(Guid guid) => await queryBusAsync.Dispatch<AttachmentMetaDto?, Guid>(guid);

    public async Task<List<AttachmentMetaDto>> GetMetas(List<Guid> guids) => await queryBusAsync.Dispatch<List<AttachmentMetaDto>, List<Guid>>(guids);
}
