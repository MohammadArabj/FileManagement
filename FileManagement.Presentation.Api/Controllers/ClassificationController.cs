using FileManagement.Application.Contracts.Classification;
using FileManagement.Presentation.Facade.Contracts.Classification;
using Microsoft.AspNetCore.Mvc;

namespace FileManagement.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClassificationController(
    IClassificationCommandFacade classificationCommandFacade,
    IClassificationQueryFacade classificationQueryFacade)
    : ControllerBase
{
    [HttpPost("Create")]
    public IActionResult Post([FromBody] CreateClassification command)
    {
        return new JsonResult(classificationCommandFacade.Create(command));
    }

    [HttpPost("Edit")]
    public void Put([FromBody] EditClassification command)
    {
        classificationCommandFacade.Edit(command);
    }

    [HttpDelete("{id:int}")]
    public void Delete(int id)
    {
        classificationCommandFacade.Delete(id);
    }

    [HttpGet("GetList")]
    public IActionResult GetAll()
    {
        return new JsonResult(classificationQueryFacade.GetList());
    }

    [HttpGet("GetBy/{id:int}")]
    public IActionResult GetBy(int id)
    {
        return new JsonResult(classificationQueryFacade.GetBy(id));
    }

    [HttpGet("GetForTree")]
    public IActionResult GetForTree()
    {
        return new JsonResult(classificationQueryFacade.GetForTree());
    }

    [HttpGet("GetForCombo/{condition}")]
    public IActionResult GetForCombo(string condition)
    {
        return new JsonResult(classificationQueryFacade.GetForCombo(condition));
    }
}