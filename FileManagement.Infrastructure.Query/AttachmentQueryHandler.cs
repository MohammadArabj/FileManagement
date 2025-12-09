using Epc.Application;
using Epc.Application.FileValidation;
using Epc.Application.Query;
using Epc.Dapper;
using FileManagement.Application.Contracts.Attachment;
using FileManagement.Infrastructure.Persistence;
using FileManagement.Infrastructure.Query.Contract.Attachment;
using FileManagement.Infrastructure.Query.Contracts;
using FileManagement.Infrastructure.Query.Contracts.Attachment;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System;

namespace FileManagement.Infrastructure.Query;

public class AttachmentQueryHandler(
    BaseDapperRepository repository,
    FileManagementQueryContext context,
    IFileService fileService,
    IConfiguration configuration)
    :
    IQueryHandlerAsync<List<AttachmentViewModel>, AttachmentSearchModel>,
    IQueryHandlerAsync<EditAttachment, int>,
    IQueryHandlerAsync<List<OtherSystemsAttachmentViewModel>, OtherSystemAttachmentSearchModel>,
    IQueryHandlerAsync<AttachmentNameViewModel, Guid>,
    IQueryHandlerAsync<AttachmentDto, Guid>,
    IQueryHandlerAsync<List<AttachmentDownload>, List<Guid>>,
    IQueryHandlerAsync<AttachmentFileInfoViewModel?, Guid>,
    IQueryHandlerAsync<AttachmentMetaDto?,Guid>,
    IQueryHandlerAsync<List<AttachmentMetaDto>,List<Guid>>
{
    public async Task<List<AttachmentViewModel>> Handle(AttachmentSearchModel searchModel)
    {
        var result = new List<AttachmentViewModel>();

        var parts = (searchModel.ClassificationId ?? "").Split("-", StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2) return result;

        var type = parts[0];
        if (!int.TryParse(parts[1], out var classificationId)) return result;

        var folders = await context.Classifications
            .Where(x => x.ParentId == classificationId)
            .Select(x => new AttachmentViewModel
            {
                Id = x.Id,
                Guid = x.Guid,
                Title = x.Title,
                Type = "folder",
                CreatedByGuid = x.CreatedBy,
                Created = x.Created.ToFarsi()
            })
            .AsNoTracking()
            .ToListAsync();

        result.AddRange(folders);

        if (type == "c")
        {
            var files = await context.Attachments
                .Where(x => x.ClassificationId == classificationId)
                .Select(x => new AttachmentViewModel
                {
                    Guid = x.Guid,
                    Title = x.OriginalFileName ?? x.FileName,
                    Type = "file",
                    ContentType = x.ContentType,
                    Description = x.Description,
                    CreatedByGuid = x.CreatedBy,
                    Created = x.Created.ToFarsi()
                })
                .AsNoTracking()
                .ToListAsync();

            result.AddRange(files);
        }

        // ✅ بهینه: دیکشنری کاربران
        var ssoDatabaseName = configuration["ssoDatabaseName"];
        var users = repository.Select<UserViewModel>($"SELECT Guid, Fullname FROM {ssoDatabaseName}..Users");
        var map = users.GroupBy(x => x.Guid).ToDictionary(g => g.Key, g => g.First().Fullname);

        foreach (var item in result)
            item.CreatedBy = map.TryGetValue(item.CreatedByGuid, out var name) ? name : "نامشخص";

        return result;
    }

    public async Task<EditAttachment> Handle(int id) =>
        repository.SelectFromSpFirstOrDefault<EditAttachment>(FileManagementQueryConstants.GetAttachmentFor,
            new { Type = QueryOutputs.Edit, Id = id });

    public async Task<List<OtherSystemsAttachmentViewModel>> Handle(OtherSystemAttachmentSearchModel searchModel)
    {
        var result = new List<OtherSystemsAttachmentViewModel>();

        var folders = await context.Classifications
            .Where(x => x.SystemGuid == searchModel.SystemGuid)
            .Select(x => new OtherSystemsAttachmentViewModel
            {
                Id = x.Id,
                ParentId = x.ParentId,
                Guid = x.Guid,
                Title = x.Title,
                Type = "folder"
            })
            .AsNoTracking()
            .ToListAsync();

        result.AddRange(folders);

        if (searchModel.Type != 1) return result;

        var files = await context.Attachments
            .Where(x => x.Classification.SystemGuid == searchModel.SystemGuid)
            .Select(x => new OtherSystemsAttachmentViewModel
            {
                Id = x.Id,
                Guid = x.Guid,
                Title = x.OriginalFileName ?? x.FileName,
                Path = x.StoragePath,
                Type = "file",
                Description = x.Description,
                ParentId = x.ClassificationId
            })
            .AsNoTracking()
            .ToListAsync();

        result.AddRange(files);
        return result;
    }

    async Task<AttachmentDto> IQueryHandlerAsync<AttachmentDto, Guid>.Handle(Guid condition) =>
        await context.Attachments
            .Where(x => x.Guid == condition)
            .Select(c => new AttachmentDto(default, null, default, default)
            {
                ContentType = c.ContentType,
                FileName = c.OriginalFileName ?? c.FileName,
                Guid = c.Guid,
                Path = c.StoragePath
            })
            .FirstOrDefaultAsync();

    public async Task<List<AttachmentDownload>> Handle(List<Guid> condition)
    {
        var files = await context.Attachments
            .Where(x => condition.Contains(x.Guid))
            .Select(x => new AttachmentDownload
            {
                Path = x.StoragePath,
                FileName = x.OriginalFileName ?? x.FileName,
                Guid = x.Guid,
                ContentType = x.ContentType
            })
            .ToListAsync();

        foreach (var f in files)
            f.File = fileService.Download(f.Path);

        return files;
    }

    public async Task<AttachmentNameViewModel> Handle(Guid condition) =>
        await context.Attachments
            .Where(x => x.Guid == condition)
            .Select(x => new AttachmentNameViewModel { FileName = x.OriginalFileName ?? x.FileName })
            .FirstOrDefaultAsync();

    async Task<AttachmentFileInfoViewModel?> IQueryHandlerAsync<AttachmentFileInfoViewModel?, Guid>.Handle(Guid condition) =>
    await context.Attachments
        .Where(x => x.Guid == condition)
        .Select(x => new AttachmentFileInfoViewModel(default, default, default, null)
        {
            Guid = x.Guid,
            FileName = x.FileName,
            OriginalFileName = x.OriginalFileName ?? x.FileName,
            ContentType = x.ContentType,
            FileSize = x.FileSize,
            Path = x.StoragePath,
            ClassificationId = x.ClassificationId,
            Description = x.Description
        })
        .AsNoTracking()
        .FirstOrDefaultAsync();

    async Task<AttachmentMetaDto?> IQueryHandlerAsync<AttachmentMetaDto?, Guid>.Handle(Guid condition) =>
        await context.Attachments
            .Where(x => x.Guid == condition)
            .Select(x => new AttachmentMetaDto(
                x.Guid,
                x.FileName,
                x.OriginalFileName,
                x.ContentType,
                x.FileSize,
                x.StoragePath
            ))
            .AsNoTracking()
            .FirstOrDefaultAsync();
    async Task<List<AttachmentMetaDto>> IQueryHandlerAsync<List<AttachmentMetaDto>, List<Guid>>.Handle(List<Guid> condition) =>
        await context.Attachments
            .Where(x => condition.Contains(x.Guid))
            .Select(x => new AttachmentMetaDto(
                x.Guid,
                x.FileName,
                x.OriginalFileName,
                x.ContentType,
                x.FileSize,
                x.StoragePath
            ))
            .AsNoTracking()
            .ToListAsync();
}