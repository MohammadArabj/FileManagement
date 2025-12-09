using FileManagement.Domain.AttachmentAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Fle.Infrastructure.Persistence.Mappings;

public class AttachmentMapping : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> builder)
    {
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => x.Guid).IsUnique();

        builder.Property(x => x.OriginalFileName).HasMaxLength(300).IsRequired();
        builder.Property(x => x.StoragePath).HasMaxLength(600).IsRequired();
        builder.Property(x => x.ContentType).HasMaxLength(150).IsRequired();
    }
}
