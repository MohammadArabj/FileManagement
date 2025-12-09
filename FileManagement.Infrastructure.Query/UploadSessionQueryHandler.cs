using Epc.Application.Query;
using Epc.Dapper;
using Epc.Identity;
using FileManagement.Common;
using FileManagement.Domain.Shared.Acls.UserManagement;
using FileManagement.Infrastructure.Persistence;
using FileManagement.Infrastructure.Query.Contract.Upload;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FileManagement.Infrastructure.Query;

public class UploadSessionQueryHandler(
    FileManagementQueryContext context,
    BaseDapperRepository repository,
    IClaimHelper claimHelper,
    IUserManagementAclService userManagementAclService,
    IConfiguration configuration)
    :
        IQueryHandlerAsync<List<UploadSessionViewModel>>,
        IQueryHandlerAsync<UploadSessionViewModel?, Guid>,
        IQueryHandlerAsync<UploadProgressViewModel?, string>
{
    /// <summary>
    /// دریافت آپلودهای فعال کاربر جاری
    /// </summary>
    public async Task<List<UploadSessionViewModel>> Handle()
    {
        var userId = claimHelper.GetCurrentUserGuid();
        var ssoDatabaseName = configuration["ssoDatabaseName"];

        var sessions = await context.UploadSessions
            .Where(x => x.CreatedBy == userId &&
                        x.Status != UploadSessionStatus.Completed &&
                        x.Status != UploadSessionStatus.Cancelled &&
                        x.Status != UploadSessionStatus.Expired &&
                        x.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(x => x.Created)
            .Select(x => new UploadSessionViewModel
            {
                Id = x.Id,
                Guid = x.Guid,
                TusFileId = x.TusFileId,
                FileName = x.FileName,
                ContentType = x.ContentType,
                TotalSize = x.TotalSize,
                UploadedSize = x.UploadedSize,
                ProgressPercentage = x.TotalSize > 0
                    ? Math.Round((double)x.UploadedSize / x.TotalSize * 100, 2)
                    : 0,
                Status = x.Status,
                StatusText = GetStatusText(x.Status),
                Created = x.Created,
                ExpiresAt = x.ExpiresAt,
                CreatedBy = x.CreatedBy,
                AttachmentGuid = x.AttachmentGuid
            })
            .AsNoTracking()
            .ToListAsync();

        // دریافت نام کاربران
        if (sessions.Any())
        {
            var userGuids = sessions.Select(x =>(Guid?) x.CreatedBy).Distinct().ToList();
            var users = await userManagementAclService.GetUsersByGuidsAsync(userGuids);
            foreach (var session in sessions)
            {
                session.CreatedByName = users.FirstOrDefault(u => u.Guid == session.CreatedBy)?.Fullname ?? "";
            }
        }

        return sessions;
    }

    /// <summary>
    /// دریافت یک جلسه آپلود با Guid
    /// </summary>
    public async Task<UploadSessionViewModel?> Handle(Guid condition)
    {
        var session = await context.UploadSessions
            .Where(x => x.Guid == condition)
            .Select(x => new UploadSessionViewModel
            {
                Id = x.Id,
                Guid = x.Guid,
                TusFileId = x.TusFileId,
                FileName = x.FileName,
                ContentType = x.ContentType,
                TotalSize = x.TotalSize,
                UploadedSize = x.UploadedSize,
                ProgressPercentage = x.TotalSize > 0
                    ? Math.Round((double)x.UploadedSize / x.TotalSize * 100, 2)
                    : 0,
                Status = x.Status,
                StatusText = GetStatusText(x.Status),
                Created = x.Created,
                ExpiresAt = x.ExpiresAt,
                CreatedBy = x.CreatedBy,
                AttachmentGuid = x.AttachmentGuid
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return session;
    }

    /// <summary>
    /// دریافت وضعیت پیشرفت با TusFileId
    /// </summary>
    public async Task<UploadProgressViewModel?> Handle(string condition)
    {
        var session = await context.UploadSessions
            .Where(x => x.TusFileId == condition)
            .Select(x => new UploadProgressViewModel(default, default, default, default, default, default, default, default, null)
            {
                SessionGuid = x.Guid,
                FileName = x.FileName,
                UploadedBytes = x.UploadedSize,
                TotalBytes = x.TotalSize,
                ProgressPercentage = x.TotalSize > 0
                    ? Math.Round((double)x.UploadedSize / x.TotalSize * 100, 2)
                    : 0,
                Status = x.Status,
                ErrorMessage = x.ErrorMessage
            })
            .AsNoTracking()
            .FirstOrDefaultAsync();

        return session;
    }

    private static string GetStatusText(UploadSessionStatus status) => status switch
    {
        UploadSessionStatus.Created => "ایجاد شده",
        UploadSessionStatus.InProgress => "در حال آپلود",
        UploadSessionStatus.Paused => "متوقف شده",
        UploadSessionStatus.Completed => "تکمیل شده",
        UploadSessionStatus.Failed => "خطا",
        UploadSessionStatus.Cancelled => "لغو شده",
        UploadSessionStatus.Expired => "منقضی شده",
        _ => "نامشخص"
    };

    private class UserNameDto
    {
        public Guid Guid { get; set; }
        public string Fullname { get; set; }
    }
}
