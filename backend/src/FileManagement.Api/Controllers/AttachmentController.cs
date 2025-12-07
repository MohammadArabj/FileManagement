using FileManagement.Api.Models;
using FileManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttachmentController : ControllerBase
{
    private readonly IAttachmentService _attachmentService;
    private readonly IAttachmentRepository _repository;

    public AttachmentController(IAttachmentService attachmentService, IAttachmentRepository repository)
    {
        _attachmentService = attachmentService;
        _repository = repository;
    }

    [HttpPost("upload"), RequestSizeLimit(524_288_000)]
    public async Task<ActionResult<ApiResponse<UploadResult>>> Upload([FromForm] UploadFileModel model)
    {
        var result = await _attachmentService.SaveAsync(model, HttpContext.RequestAborted);
        return Ok(new ApiResponse<UploadResult> { Success = true, Data = result });
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<AttachmentDto>>>> List([FromQuery] string? folderPath)
    {
        var list = await _repository.GetAllAsync(folderPath);
        return Ok(new ApiResponse<IReadOnlyList<AttachmentDto>> { Success = true, Data = list });
    }

    [HttpGet("download/{id:guid}")]
    public async Task<IActionResult> Download(Guid id)
    {
        var result = await _attachmentService.DownloadAsync(id);
        if (result == null)
        {
            return NotFound();
        }

        return File(result.Value.Stream, result.Value.Meta.ContentType, result.Value.Meta.FileName);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _attachmentService.DeleteAsync(id);
        return NoContent();
    }
}
