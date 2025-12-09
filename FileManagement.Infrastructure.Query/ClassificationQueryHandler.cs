using System.Collections.Generic;
using System.Linq;
using Epc.Application.Query;
using Epc.Dapper;
using FileManagement.Application.Contracts.Classification;
using FileManagement.Infrastructure.Persistence;
using FileManagement.Infrastructure.Query.Contracts;
using FileManagement.Infrastructure.Query.Contracts.Classification;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace FileManagement.Infrastructure.Query;

public class ClassificationQueryHandler(
    BaseDapperRepository repository,
    FileManagementQueryContext context,
    IConfiguration configuration)
    :
        IQueryHandler<List<AttachmentClassificationViewModel>>,
        IQueryHandler<EditClassification, int>,
        IQueryHandler<List<AttachmentClassificationComboModel>, string>,
        IQueryHandler<List<ClassificationForTreeViewModel>>
{
    private const string GetAttachmentClassificationFor = "FileManagement.spGetAttachmentClassificationFor";

    List<AttachmentClassificationViewModel> IQueryHandler<List<AttachmentClassificationViewModel>>.Handle()
    {
        return repository.SelectFromSp<AttachmentClassificationViewModel>(GetAttachmentClassificationFor,
            new { Type = QueryOutputs.List });
    }

    public EditClassification Handle(int id)
    {
        return repository.SelectFromSpFirstOrDefault<EditClassification>(GetAttachmentClassificationFor,
            new { Type = QueryOutputs.Edit, Id = id });
    }

    public List<AttachmentClassificationComboModel> Handle(string condition)
    {
        var value = condition.Split(",");
        return repository.SelectFromSp<AttachmentClassificationComboModel>(GetAttachmentClassificationFor,
            new { Type = QueryOutputs.Combo, Term = value[0], Level = value[1], OnlyLastNode = value[2] });
    }

    List<ClassificationForTreeViewModel> IQueryHandler<List<ClassificationForTreeViewModel>>.
        Handle()
    {
        var classifications = context.Classifications
            .Select(x => new ClassificationForTreeViewModel
            {
                Id = x.Id.ToString(),
                Guid = x.Guid,
                Text = x.Title,
                SystemGuid = x.SystemGuid,
                Parent = x.ParentId.ToString()
            }).AsNoTracking()
            .ToList();

        var ssoDatabaseName = configuration["ssoDatabaseName"];
        var systems = repository.Select<SystemViewModel>($"SELECT Id, Guid FROM {ssoDatabaseName}..tbSystems");

        foreach (var item in classifications) item.SystemId = systems.First(x => x.Guid == item.SystemGuid).Id;

        return classifications;
    }
}