using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Epc.Company.Query;
using Epc.Core;
using FileManagement.Application.Contracts.Attachment;

namespace FileManagement.Presentation.Facade.Contracts.Attachment
{
    public interface IAttachmentCommandFacade : IFacadeService
    {
        Task<Guid> Create(CreateAttachment command);
        Task Edit(EditAttachment command);
        Task<Result<bool>> Delete(Guid guid);
        Task<UploadResult> UploadFile(UploadFileModel command);
        Task<List<UploadResult>> UploadFiles(UploadFileList command);
    }
}
