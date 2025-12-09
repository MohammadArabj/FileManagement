using FileManagement.Application;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using tusdotnet.Models;
using tusdotnet.Models.Configuration;
using tusdotnet.Models.Expiration;
using tusdotnet.Stores;

namespace FileManagement.Infrastructure.Tus;

/// <summary> 
/// پیکربندی TUS 
/// </summary> 
public static class TusConfiguration
{
    public static IServiceCollection AddTusServices(this IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection("TusSettings").Get<TusSettings>() ?? new TusSettings();
        services.AddSingleton(settings);
        services.AddScoped<ITusFileService, TusFileService>();
        return services;
    }
    /// <summary> 
    /// دریافت تنظیمات TUS برای استفاده با MapTus (Endpoint Routing) 
    /// </summary> 
    public static DefaultTusConfiguration GetTusConfiguration(
        IServiceProvider serviceProvider,
        HttpContext httpContext)
    {
        var configuration = serviceProvider.GetRequiredService<IConfiguration>();
        var settings = configuration.GetSection("TusSettings").Get<TusSettings>() ?? new TusSettings();
        var logger = serviceProvider.GetService<ILogger<DefaultTusConfiguration>>();
        // ✅ اطمینان از وجود پوشه ذخیره‌سازی 
        var storagePath = Path.Combine(Directory.GetCurrentDirectory(), settings.StoragePath);
        logger?.LogInformation("TUS Configuration using storage path: {Path}", storagePath);
        if (!Directory.Exists(storagePath))
        {
            Directory.CreateDirectory(storagePath);
            logger?.LogInformation("Created TUS storage directory: {Path}", storagePath);
        }
        return new DefaultTusConfiguration
        {
            // ❌ UrlPath را ست نکنید وقتی از MapTus استفاده می‌کنید! 
            // UrlPath = settings.UrlPath, // این خط باعث خطا می‌شود 
            Store = new TusDiskStore(storagePath, deletePartialFilesOnConcat: true),
            MaxAllowedUploadSizeInBytes = (int?)settings.MaxFileSizeBytes,
            Expiration = new AbsoluteExpiration(TimeSpan.FromHours(settings.ExpirationHours)),
            Events = new Events
            {
                // بررسی احراز هویت 
                OnAuthorizeAsync = async eventContext =>
                {
                    if (!eventContext.HttpContext.User.Identity?.IsAuthenticated ?? true)
                    {
                        eventContext.FailRequest(System.Net.HttpStatusCode.Unauthorized, "Unauthorized");
                        return;
                    }
                    await Task.CompletedTask;
                },
                // اعتبارسنجی قبل از ایجاد فایل 
                OnBeforeCreateAsync = async eventContext =>
                {
                    // بررسی metadata 
                    var metadata = eventContext.Metadata;
                    if (!metadata.ContainsKey("filename"))
                    {
                        eventContext.FailRequest("filename metadata is required");
                        return;
                    }
                    var filename = metadata["filename"].GetString(System.Text.Encoding.UTF8);
                    var extension = Path.GetExtension(filename)?.ToLowerInvariant();
                    // بررسی پسوندهای ممنوع 
                    if (!string.IsNullOrEmpty(extension) && settings.BlockedExtensions.Contains(extension))
                    {
                        eventContext.FailRequest($"File extension '{extension}' is not allowed");
                        return;
                    }
                    // بررسی حجم 
                    if (eventContext.UploadLength > settings.MaxFileSizeBytes)
                    {
                        eventContext.FailRequest($"File size exceeds maximum allowed size of {settings.MaxFileSizeBytes / (1024 * 1024)} MB");
                        return;
                    }
                    logger?.LogInformation("TUS: Creating upload for file '{FileName}', Size: {Size} bytes",
                        filename, eventContext.UploadLength);
                    await Task.CompletedTask;
                },
                // لاگ بعد از ایجاد 
                OnCreateCompleteAsync = async eventContext =>
                {
                    logger?.LogInformation("TUS: Upload created with ID: {FileId}", eventContext.FileId);
                    await Task.CompletedTask;
                },
                // اطلاع‌رسانی تکمیل آپلود 
                OnFileCompleteAsync = async eventContext =>
                {
                    logger?.LogInformation("TUS: Upload completed for file ID: {FileId}", eventContext.FileId);
                    await Task.CompletedTask;
                }
            }
        };
    }
}