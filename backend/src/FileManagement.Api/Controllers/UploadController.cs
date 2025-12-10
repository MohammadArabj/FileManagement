using FileManagement.Api.Models;
using FileManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly ITusFileService _tusFileService;

    public UploadController(ITusFileService tusFileService)
    {
        _tusFileService = tusFileService;
    }

    [HttpGet("status/{id}")]
    public async Task<ActionResult<ApiResponse<TusUploadStatus>>> Status(string id)
    {
        var status = await _tusFileService.GetUploadStatusAsync(id);
        if (status == null)
        {
            return NotFound(new ApiResponse<TusUploadStatus> { Success = false, Message = "Upload not found" });
        }

        return Ok(new ApiResponse<TusUploadStatus> { Success = true, Data = status });
    }

    [HttpGet("metadata/{id}")]
    public async Task<ActionResult<ApiResponse<Dictionary<string, string>>>> Metadata(string id)
    {
        var metadata = await _tusFileService.GetMetadataAsync(id);
        if (metadata == null)
        {
            return NotFound(new ApiResponse<Dictionary<string, string>> { Success = false, Message = "Metadata not found" });
        }

        return Ok(new ApiResponse<Dictionary<string, string>> { Success = true, Data = metadata });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Cancel(string id)
    {
        var deleted = await _tusFileService.DeleteFileAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("debug")]
    public ActionResult<IEnumerable<string>> DebugFiles() => Ok(_tusFileService.GetAllFiles());
}
