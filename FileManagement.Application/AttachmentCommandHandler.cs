using Epc.Application.Command;
using Epc.Application.FileValidation;
using Epc.Company.Query;
using Epc.Identity;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Domain.AttachmentAgg;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.ClassificationAgg.Service;
using FileManagement.Domain.Shared.Acls.UserManagement;
using FileSignatures;

namespace FileManagement.Application;

public class AttachmentCommandHandler(
    IAttachmentRepository attachmentRepository,
    IClaimHelper claimHelper,
    IAttachmentService attachmentService,
    IFileService fileService,
    IClassificationRepository classificationRepository,
    IUserManagementAclService userManagementAclService,
    IClassificationService classificationService)
    :
        ICommandHandlerAsync<CreateAttachment, Guid>,
        ICommandHandlerAsync<EditAttachment>,
        ICommandHandlerAsync<DeleteAttachment>,
        ICommandHandlerAsync<UploadFileModel, UploadResult>,
        ICommandHandlerAsync<UploadFileList,List<UploadResult>>,
        ICommandHandlerAsync<DeleteAttachmentGuidDto,Result<bool>>
{
    public async Task<Guid> Handle(CreateAttachment command)
    {
        throw new NotImplementedException();
    }


    public async Task Handle(EditAttachment command)
    {
        var attachment = await attachmentRepository.LoadAsync(command.Guid);

        attachment.Edit(command.ClassificationId, command.Description, attachmentService);

        attachmentRepository.Update(attachment);
    }

    public async Task Handle(DeleteAttachment command)
    {
        var attachment = await attachmentRepository.LoadAsync(command.Id);
        attachmentRepository.Delete(attachment);
    }

    public async Task<UploadResult> Handle(UploadFileModel command)
    {
        throw new NotImplementedException();

    }


    public async Task<List<UploadResult>> Handle(UploadFileList command)
    {
        throw new NotImplementedException();

    }

    public async Task<Result<bool>> Handle(DeleteAttachmentGuidDto command)
    {
        var file = await attachmentRepository.LoadAsync(command.Guid);
        if (file == null)
            return Result<bool>.Failure(false, "فایل یافت نشد");

        // اول مسیر رو ذخیره کن، ولی حذف نکن
        var filePath = file.StoragePath;

        // فقط از دیتابیس حذف کن
        attachmentRepository.Delete(file);

        // اینجا تراکنش تمام می‌شه و بعد فایل رو حذف کن
        await Task.Run(() => fileService.DeleteDirectory(filePath));

        return Result<bool>.Success(true);
    }
}