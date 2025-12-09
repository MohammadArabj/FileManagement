using FileManagement.Infrastructure.Query.Contracts.Attachment;
using FileManagement.Presentation.Facade.Contracts.Attachment;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "FileManagementApi")]
public class AttachmentController(
    IAttachmentCommandFacade attachmentCommandFacade,
    IAttachmentQueryFacade attachmentQueryFacade)
    : ControllerBase
{
    [HttpGet("GetList")]
    public async Task<IActionResult> GetAll([FromQuery] AttachmentSearchModel searchModel) =>
        new JsonResult(await attachmentQueryFacade.GetList(searchModel));

    [HttpGet("GetForOtherSystems")]
    public async Task<IActionResult> GetForOtherSystems([FromQuery] OtherSystemAttachmentSearchModel searchModel) =>
        new JsonResult(await attachmentQueryFacade.GetForOtherSystems(searchModel));

    [HttpGet("GetFileName/{guid:guid}")]
    public async Task<IActionResult> GetFileName(Guid guid) =>
        new JsonResult(await attachmentQueryFacade.GetFileNameBy(guid));

    //// ✅ جدید: فقط اطلاعات فایل (بدون byte[])
    //[HttpGet("Info/{guid:guid}")]
    //public async Task<IActionResult> Info(Guid guid)
    //{
    //    var info = await attachmentQueryFacade.GetFileInfo(guid);
    //    if (info == null) return NotFound();
    //    return new JsonResult(info);
    //}

    [HttpGet("Download/{guid:guid}")]
    public async Task<IActionResult> Download(Guid guid)
    {
        var info = await attachmentQueryFacade.Download(guid); // فقط Path/Name/Type
        var stream = System.IO.File.OpenRead(info.Path);       // یا fileService.OpenRead
        return File(stream, info.ContentType, info.FileName, enableRangeProcessing: true);
    }

    //// ✅ نمایش (inline) با Range support (برای PDF/Video/Image عالیه)
    //[HttpGet("Preview/{guid:guid}")]
    //public async Task<IActionResult> Preview(Guid guid)
    //{
    //    var info = await attachmentQueryFacade.GetFileInfo(guid);
    //    if (info == null) return NotFound();

    //    var physicalPath = ToPhysicalPathSafe(info.Path);
    //    if (physicalPath == null || !System.IO.File.Exists(physicalPath))
    //        return NotFound();

    //    Response.Headers["Cache-Control"] = "no-store";
    //    // اگر خواستید حتما inline باشد:
    //    Response.Headers["Content-Disposition"] = "inline";

    //    return PhysicalFile(
    //        physicalPath,
    //        info.ContentType,
    //        enableRangeProcessing: true);
    //}

    private static string? ToPhysicalPathSafe(string storedPath)
    {
        if (string.IsNullOrWhiteSpace(storedPath)) return null;

        // normalize
        var p = storedPath.Replace('\\', '/');

        // جلوگیری از traversal
        if (p.Contains("..")) return null;

        // اگر با / شروع شود Path.Combine را خراب می‌کند
        p = p.TrimStart('/');

        // شما مسیرها را مثل "files/..." ذخیره می‌کنید
        var root = Directory.GetCurrentDirectory();
        var physical = Path.Combine(root, p.Replace('/', Path.DirectorySeparatorChar));

        return physical;
    }

    // AttachmentController
    [HttpGet("GetMeta/{guid:guid}")]
    public async Task<IActionResult> GetMeta(Guid guid) =>
        new JsonResult(await attachmentQueryFacade.GetMeta(guid));

    [HttpPost("GetMetas")]
    public async Task<IActionResult> GetMetas([FromBody] List<Guid> guids) =>
        new JsonResult(await attachmentQueryFacade.GetMetas(guids));

}
