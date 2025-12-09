using Epc.Application.Command;
using Epc.Identity;
using FileManagement.Application.Contract.Upload;
using FileManagement.Domain.AttachmentAgg;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.ClassificationAgg.Service;
using FileManagement.Domain.Shared.Acls.UserManagement;
using FileManagement.Domain.UploadSessionAgg;
using System;
using System.IO;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace FileManagement.Application;

public class UploadCommandHandler(
    IUploadSessionRepository uploadSessionRepository,
    IAttachmentRepository attachmentRepository,
    IClassificationRepository classificationRepository,
    IUserManagementAclService userManagementAclService,
    IClaimHelper claimHelper,
    IClassificationService classificationService,
    IAttachmentService attachmentService,
    ITusFileService tusFileService)
    :
        ICommandHandlerAsync<InitiateUpload, InitiateUploadResult>,
        ICommandHandlerAsync<CompleteUpload, CompleteUploadResult>,
        ICommandHandlerAsync<CancelUpload>,
        ICommandHandlerAsync<UpdateUploadProgress>
{
    /// <summary> 
    /// شروع جلسه آپلود TUS 
    /// </summary> 
    public async Task<InitiateUploadResult> Handle(InitiateUpload command)
    {
        var creator = claimHelper.GetCurrentUserGuid();
        // بررسی سیستم 
        var system = await userManagementAclService.GetSystemByAsync(command.ClientId);
        if (system == null)
            throw new Exception("سیستم مورد نظر یافت نشد.");
        // پردازش مسیر پوشه و ایجاد Classification ها 
        int? classificationId = command.ClassificationId;
        if (!string.IsNullOrEmpty(command.FolderPath))
        {
            classificationId = await EnsureFolderPathExistsAsync(
                command.FolderPath, system.Guid, system.Id, creator);
        }
        // ایجاد TusFileId یکتا 
        var tusFileId = Guid.NewGuid().ToString("N");
        // ایجاد جلسه آپلود 
        var session = new UploadSession(
            creator: creator,
            tusFileId: tusFileId,
            fileName: command.FileName,
            contentType: command.ContentType,
            totalSize: command.FileSize,
            systemGuid: system.Guid,
            folderPath: command.FolderPath,
            classificationId: classificationId
        );
        await uploadSessionRepository.CreateAsync(session);
        return new InitiateUploadResult(
            session.Guid,
            tusFileId,
            $"/api/Upload/tus/{tusFileId}",
            session.ExpiresAt
        );
    }
    /// <summary> 
    /// تکمیل آپلود و ثبت فایل 
    /// </summary> 
    public async Task<CompleteUploadResult> Handle(CompleteUpload command)
    {
        var creator = claimHelper.GetCurrentUserGuid();
        // یافتن جلسه آپلود 
        var session = await uploadSessionRepository.LoadAsync(command.SessionGuid);
        if (session == null)
            throw new Exception("جلسه آپلود یافت نشد.");
        var realTusFileId = command.TusFileId;
        var tusStatus = await tusFileService.GetUploadStatusAsync(realTusFileId);
        if (tusStatus == null || !tusStatus.IsComplete)
            throw new Exception("آپلود فایل هنوز تکمیل نشده است.");
        var fileStream = await tusFileService.GetFileStreamAsync(realTusFileId);
        if (fileStream == null)
            throw new Exception("فایل آپلود شده یافت نشد.");
        try
        {
            // ایجاد مسیر ذخیره‌سازی 
            var storagePath = GenerateStoragePath(session.SystemGuid, session.ClassificationId);
            var fileName = $"{Guid.NewGuid():N}{Path.GetExtension(session.FileName)}";
            var fullPath = Path.Combine(storagePath, fileName);
            // محاسبه Checksum و ذخیره فایل 
            var checksum = await SaveFileWithChecksumAsync(fileStream, fullPath);
            // ایجاد رکورد Attachment 
            var attachment = new Attachment(
                creator: creator,
                classificationId: session.ClassificationId ?? 0,
                fileName: fileName,
                originalFileName: session.FileName,
                storagePath: fullPath.Replace("\\", "/"),
                contentType: session.ContentType,
                fileSize: session.TotalSize,
                tusFileId: command.TusFileId,
                description: command.Description,
                checksum: checksum
            );
            await attachmentRepository.CreateAsync(attachment);
            // به‌روزرسانی جلسه 
            session.Complete(attachment.Guid);
            await uploadSessionRepository.SaveChangesAsync();
            // حذف فایل موقت TUS 
            await tusFileService.DeleteFileAsync(realTusFileId);
            return new CompleteUploadResult(
                 attachment.Guid,
                 session.FileName,
                 session.TotalSize,
                session.ContentType
            );
        }
        catch (Exception ex)
        {
            session.Fail(ex.Message);
            await uploadSessionRepository.SaveChangesAsync();
            throw;
        }
    }
    /// <summary> 
    /// لغو آپلود 
    /// </summary> 
    public async Task Handle(CancelUpload command)
    {
        var session = await uploadSessionRepository.LoadAsync(command.SessionGuid);
        if (session == null)
            throw new Exception("جلسه آپلود یافت نشد.");
        // حذف فایل TUS 
        await tusFileService.DeleteFileAsync(session.TusFileId);
        session.Cancel();
        await uploadSessionRepository.SaveChangesAsync();
    }
    /// <summary> 
    /// به‌روزرسانی پیشرفت آپلود 
    /// </summary> 
    public async Task Handle(UpdateUploadProgress command)
    {
        var session = await uploadSessionRepository.GetByTusFileIdAsync(command.TusFileId);
        if (session == null) return;
        session.UpdateProgress(command.UploadedBytes);
        await uploadSessionRepository.SaveChangesAsync();
    }
    #region Private Methods 
    private async Task<int> EnsureFolderPathExistsAsync(
        string folderPath, Guid systemGuid, int systemId, Guid creator)
    {
        var folders = folderPath.Split("{{Folder}}", StringSplitOptions.RemoveEmptyEntries);
        if (folders.Length == 0)
            throw new Exception("مسیر پوشه نامعتبر است.");
        int? parentId = null;
        Classification? currentFolder = null;
        foreach (var folderName in folders)
        {
            var trimmedName = folderName.Trim();
            var existingFolder = classificationRepository.GetByTitle(trimmedName, systemGuid, parentId);
            if (existingFolder == null)
            {
                var newFolder = new Classification(
                    creator: creator,
                    systemGuid: systemGuid,
                    systemId: systemId,
                    title: trimmedName,
                    parentId: parentId,
                    service: classificationService
                );
                await classificationRepository.CreateAsync(newFolder);
                await classificationRepository.SaveChangesAsync();
                currentFolder = newFolder;
                parentId = newFolder.Id;
            }
            else
            {
                currentFolder = existingFolder;
                parentId = existingFolder.Id;
            }
        }
        return currentFolder?.Id ?? 0;
    }
    private string GenerateStoragePath(Guid systemGuid, int? classificationId)
    {
        var basePath = "files"; // از تنظیمات خوانده شود 
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month.ToString("00");
        // مسیر کوتاه با hash برای جلوگیری از مشکل path طولانی 
        var classHash = classificationId.HasValue
            ? Convert.ToBase64String(BitConverter.GetBytes(classificationId.Value))
                .Replace("/", "_").Replace("+", "-")[..4]
            : "root";
        return Path.Combine(basePath, systemGuid.ToString("N")[..8], year.ToString(), month, classHash);
    }
    private async Task<string> SaveFileWithChecksumAsync(Stream sourceStream, string destinationPath)
    {
        // اطمینان از وجود دایرکتوری 
        var directory = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
        using var sha256 = SHA256.Create();
        await using var destinationStream = new FileStream(
            destinationPath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 81920,
            useAsync: true);
        var buffer = new byte[81920]; // 80KB buffer 
        int bytesRead;
        while ((bytesRead = await sourceStream.ReadAsync(buffer)) > 0)
        {
            await destinationStream.WriteAsync(buffer.AsMemory(0, bytesRead));
            sha256.TransformBlock(buffer, 0, bytesRead, null, 0);
        }
        sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
        return BitConverter.ToString(sha256.Hash!).Replace("-", "").ToLowerInvariant();
    }
    #endregion
}