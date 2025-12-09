using FileManagement.Application;
using FileManagement.Application.Contract.Upload;
using FileManagement.Presentation.Facade.Contract.Upload;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace FileManagement.Presentation.Api.Controllers;

/// <summary> 
/// کنترلر آپلود با TUS 
/// </summary> 
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UploadController : ControllerBase
{
    private readonly ITusFileService _tusFileService;
    private readonly ILogger<UploadController> _logger;
    private readonly IUploadCommandFacade _commandFacade;
    public UploadController(
        ITusFileService tusFileService,
        ILogger<UploadController> logger,
        IUploadCommandFacade commandFacade)
    {
        _tusFileService = tusFileService;
        _logger = logger;
        _commandFacade = commandFacade;
    }
    /// <summary> 
    /// شروع جلسه آپلود 
    /// </summary> 
    [HttpPost("Initiate")]
    public async Task<IActionResult> Initiate([FromBody] InitiateUpload request)
    {
        // TODO: پیاده‌سازی کامل با UploadCommandHandler 
        var result = await _commandFacade.InitiateUpload(request);
        return Ok(new ApiResponse<InitiateUploadResult>
        {
            Success = true,
            Data = result
        });
    }
    /// <summary> 
    /// تکمیل آپلود 
    /// </summary> 
    [HttpPost("Complete")]
    public async Task<IActionResult> Complete([FromBody] CompleteUpload request)
    {
        _logger.LogInformation("Completing upload for TusFileId: {TusFileId}", request.TusFileId);
        // بررسی وضعیت آپلود 
        var status = await _tusFileService.GetUploadStatusAsync(request.TusFileId);
        if (status == null)
        {
            _logger.LogWarning("TUS file not found: {TusFileId}", request.TusFileId);
            // Debug: لیست فایل‌های موجود 
            var existingFiles = _tusFileService.GetAllFiles();
            _logger.LogWarning("Existing TUS files: {Files}", string.Join(", ", existingFiles));
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"فایل با شناسه {request.TusFileId} یافت نشد"
            });
        }
        if (!status.IsComplete)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = $"آپلود کامل نشده است. پیشرفت: {status.ProgressPercentage}%"
            });
        }
        // دریافت Stream فایل 
        var fileStream = await _tusFileService.GetFileStreamAsync(request.TusFileId);
        if (fileStream == null)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "خطا در دریافت فایل"
            });
        }
        var result = await _commandFacade.CompleteUpload(request);
        // TODO: ذخیره فایل در مسیر نهایی و ایجاد Attachment 
        // دریافت metadata 
        var metadata = await _tusFileService.GetMetadataAsync(request.TusFileId);
        var fileName = metadata?.GetValueOrDefault("filename") ?? "unknown";
        var contentType = metadata?.GetValueOrDefault("filetype") ?? "application/octet-stream";
        // بستن stream 
        await fileStream.DisposeAsync();
        // حذف فایل موقت TUS 
        await _tusFileService.DeleteFileAsync(request.TusFileId);
        return Ok(new ApiResponse<CompleteUploadResult>
        {
            Success = true,
            Data = new CompleteUploadResult(result.FileGuid, result.FileName, result.FileSize, contentType)
        });
    }
    /// <summary> 
    /// لغو آپلود 
    /// </summary> 
    [HttpPost("Cancel/{sessionGuid}")]
    public async Task<IActionResult> Cancel(string sessionGuid)
    {
        _logger.LogInformation("Cancelling upload: {SessionGuid}", sessionGuid);
        // TODO: پیاده‌سازی کامل 
        return Ok(new ApiResponse<object> { Success = true });
    }
    /// <summary> 
    /// ✅ DEBUG: بررسی وضعیت TUS Storage 
    /// </summary> 
    [HttpGet("Debug/Status")]
    public IActionResult DebugStatus()
    {
        var files = _tusFileService.GetAllFiles().ToList();
        return Ok(new
        {
            TotalFiles = files.Count,
            Files = files,
            StoragePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/tus-uploads")
        });
    }
    /// <summary> 
    /// ✅ DEBUG: بررسی یک فایل خاص 
    /// </summary> 
    [HttpGet("Debug/File/{tusFileId}")]
    public async Task<IActionResult> DebugFile(string tusFileId)
    {
        var exists = _tusFileService.FileExists(tusFileId);
        var status = await _tusFileService.GetUploadStatusAsync(tusFileId);
        var metadata = await _tusFileService.GetMetadataAsync(tusFileId);
        return Ok(new
        {
            TusFileId = tusFileId,
            FileExists = exists,
            Status = status,
            Metadata = metadata
        });
    }
}