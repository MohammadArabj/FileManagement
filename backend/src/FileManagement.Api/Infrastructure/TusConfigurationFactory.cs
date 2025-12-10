using Microsoft.Extensions.Options;
using System.Text;
using tusdotnet.Models.Configuration;
using tusdotnet.Models.Expiration;
using tusdotnet.Stores;

namespace FileManagement.Api.Infrastructure;

public static class TusConfigurationFactory
{
    public static DefaultTusConfiguration Build(HttpContext context)
    {
        var settings = context.RequestServices.GetRequiredService<IOptions<TusSettings>>().Value;
        var logger = context.RequestServices.GetRequiredService<ILogger<DefaultTusConfiguration>>();
        var storagePath = Path.Combine(AppContext.BaseDirectory, settings.StoragePath);

        Directory.CreateDirectory(storagePath);

        logger.LogInformation("TUS storage path resolved to {Path}", storagePath);

        return new DefaultTusConfiguration
        {
            Store = new TusDiskStore(storagePath),
            Expiration = new AbsoluteExpiration(TimeSpan.FromHours(settings.ExpirationHours)),
            MaxAllowedUploadSizeInBytes = (int?)settings.MaxFileSizeBytes,
            Events = new tusdotnet.Models.Events
            {
                OnBeforeCreateAsync = ctx =>
                {
                    var fileName = ctx.Metadata.ContainsKey("filename")
                        ? ctx.Metadata["filename"].GetString(Encoding.UTF8)
                        : null;

                    if (string.IsNullOrWhiteSpace(fileName))
                    {
                        ctx.FailRequest("filename metadata is required");
                    }

                    return Task.CompletedTask;
                }
            }
        };
    }
}
