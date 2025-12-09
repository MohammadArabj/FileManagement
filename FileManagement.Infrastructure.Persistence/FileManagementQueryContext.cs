using FileManagement.Domain.AttachmentAgg;
using FileManagement.Domain.ClassificationAgg;
using FileManagement.Domain.UploadSessionAgg;
using FileManagement.Infrastructure.Persistence.Mappings;
using Microsoft.EntityFrameworkCore;

namespace FileManagement.Infrastructure.Persistence;

public class FileManagementQueryContext : DbContext
{
    public DbSet<Classification> Classifications { get; set; }
    public DbSet<Attachment> Attachments { get; set; }
    public DbSet<UploadSession> UploadSessions { get; set; }

    public FileManagementQueryContext(DbContextOptions<FileManagementQueryContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var assembly = typeof(ClassificationMapping).Assembly;
        modelBuilder.ApplyConfigurationsFromAssembly(assembly);

        base.OnModelCreating(modelBuilder);
    }
}