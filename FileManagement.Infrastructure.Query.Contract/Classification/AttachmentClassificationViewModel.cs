using Epc.Company.Query;

namespace FileManagement.Infrastructure.Query.Contracts.Classification
{
    public class AttachmentClassificationViewModel : ViewModelAbilities
    {
        public int Id { get; set; }
        public int Parent { get; set; }
        public string Level { get; set; }
        public string Code { get; set; }
        public string Name { get; set; }
        public string EngName { get; set; }
        public string ParentId { get; set; }
        public string AccountType { get; set; }
        public string AccountNature { get; set; }
        public string CheckNatureType { get; set; }
        public string ForeignExchange { get; set; }
        public string Unit { get; set; }
        public string UseInDebit { get; set; }
        public string UseInCredit { get; set; }
        public string DontUseInPartyFlow { get; set; }
        public string Description { get; set; }
        public string IsActive { get; set; }
    }
}