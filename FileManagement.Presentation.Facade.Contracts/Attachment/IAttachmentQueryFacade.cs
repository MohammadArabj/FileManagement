using Epc.Core;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Infrastructure.Query.Contract.Attachment;
using FileManagement.Infrastructure.Query.Contracts.Attachment;

namespace FileManagement.Presentation.Facade.Contracts.Attachment;

public interface IAttachmentQueryFacade : IFacadeService
{
    Task<List<AttachmentViewModel>> GetList(AttachmentSearchModel searchModel);
    Task<EditAttachment> GetBy(int id);
    Task<AttachmentDownload> Download(Guid guid);
    Task<List<OtherSystemsAttachmentViewModel>> GetForOtherSystems(OtherSystemAttachmentSearchModel searchModel);
    Task<AttachmentNameViewModel> GetFileNameBy(Guid guid);
    Task<AttachmentDto> GetFile(Guid guid);
    Task<AttachmentMetaDto?> GetMeta(Guid guid);
    Task<List<AttachmentMetaDto>> GetMetas(List<Guid> guids);
    Task<List<AttachmentDownload>> DownloadFiles(List<Guid> guids);
}