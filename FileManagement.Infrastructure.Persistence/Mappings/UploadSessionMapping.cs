using FileManagement.Domain.UploadSessionAgg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FileManagement.Infrastructure.Persistence.Mappings;

public class UploadSessionMapping : IEntityTypeConfiguration<UploadSession>
{
    public void Configure(EntityTypeBuilder<UploadSession> builder)
    {
        builder.HasKey(x => x.Id);

        builder.Property(x => x.TusFileId)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.FileName)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.ContentType)
            .HasMaxLength(200);

        builder.Property(x => x.FolderPath)
            .HasMaxLength(1000);

        builder.Property(x => x.Metadata)
            .HasMaxLength(4000);

        builder.Property(x => x.ErrorMessage)
            .HasMaxLength(2000);

        builder.HasIndex(x => x.TusFileId)
            .IsUnique();

        builder.HasIndex(x => x.Guid)
            .IsUnique();

        builder.HasIndex(x => new { x.CreatedBy, x.Status });

        builder.HasIndex(x => x.ExpiresAt);

        builder.Ignore(x => x.IsActive);
    }
}
