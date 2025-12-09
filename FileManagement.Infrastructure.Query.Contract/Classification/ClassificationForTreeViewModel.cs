using System;

namespace FileManagement.Infrastructure.Query.Contracts.Classification;

public class ClassificationForTreeViewModel
{
    public string Id { get; set; }
    public Guid Guid { get; set; }
    public string Parent { get; set; }
    public int SystemId { get; set; }
    public Guid SystemGuid { get; set; }
    public string Text { get; set; }
    public string Code { get; set; }
    public int? Level { get; set; }
    public int? AccountType { get; set; }
    public int? AccountNature { get; set; }
    public int? CheckNatureType { get; set; }
    public int? UnitId { get; set; }
    public int? ForeignExchangeId { get; set; }
    public int? AccountUsage { get; set; }
    public bool DontUseInPartyFlow { get; set; }
}