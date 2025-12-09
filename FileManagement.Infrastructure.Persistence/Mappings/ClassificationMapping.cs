using FileManagement.Domain.ClassificationAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FileManagement.Infrastructure.Persistence.Mappings;

public class ClassificationMapping : IEntityTypeConfiguration<Classification>
{
    public void Configure(EntityTypeBuilder<Classification> builder)
    {
        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.SystemGuid, x.ParentId, x.Title }).IsUnique();

        builder.Ignore(x => x.IsActive);
        builder.Ignore(x => x.IsRemoved);
        builder.Ignore(x => x.IsLocked);
        builder.Ignore(x => x.LastModified);
        builder.Ignore(x => x.LastModifiedBy);
    }
}
