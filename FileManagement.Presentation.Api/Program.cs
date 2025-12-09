
using Autofac;
using Autofac.Extensions.DependencyInjection;
using Epc.Autofac;
using Epc.Core;
using FileManagement.Infrastructure.Configuration;
using FileManagement.Infrastructure.Tus;
using FileManagement.Presentation.Api;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IO.Compression;
using tusdotnet;
var builder = WebApplication.CreateBuilder(args);
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Services.AddRazorPages();
builder.Services.AddLogging();
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.AddHttpContextAccessor();
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>();
if (allowedOrigins is not null)
{
    builder.Services.AddCors(options => options.AddPolicy("FileManagement", p => p
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()
        .WithOrigins(allowedOrigins)
        .WithExposedHeaders(
            "Upload-Offset",
            "Upload-Length",
            "Location",
            "Tus-Resumable",
            "Tus-Version",
            "Tus-Extension",
            "Tus-Max-Size",
            "Upload-Metadata")
    ));
}
builder.Services.AddSignalR();
builder.Services.AddControllers().AddNewtonsoftJson();
var authorities = builder.Configuration.GetSection("IdentityAuthorities");
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.RequireHttpsMetadata = false;
        options.Authority = authorities["0"];
        options.TokenValidationParameters = new TokenValidationParameters { ValidateAudience = false };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("FileManagementApi", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireClaim("scope", "FileManagementApi");
    });
});
var connectionString = builder.Configuration.GetConnectionString("Application");
// ============================================ 
// تنظیمات Kestrel برای فایل‌های بزرگ 
// ============================================ 
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 5L * 1024 * 1024 * 1024; // 5GB 
    options.Limits.MinRequestBodyDataRate = new Microsoft.AspNetCore.Server.Kestrel.Core.MinDataRate(
        bytesPerSecond: 100, gracePeriod: TimeSpan.FromSeconds(10));
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(30);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(5);
});
if (string.IsNullOrWhiteSpace(connectionString))
    throw new Exception("Please Set Connection String");
builder.Host.ConfigureContainer<ContainerBuilder>(containerBuilder =>
{
    containerBuilder.RegisterModule<EpcModule>();
    containerBuilder.RegisterModule(new FileManagementModule(connectionString));
});
// تنظیمات Form برای فایل‌های بزرگ 
builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 5L * 1024 * 1024 * 1024; // 5GB 
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartHeadersLengthLimit = int.MaxValue;
});
// TUS Services 
builder.Services.AddTusServices(builder.Configuration);
var app = builder.Build();
var autofacContainer = app.Services.GetAutofacRoot();
ServiceLocator.SetCurrent(new AutofacServiceLocator(autofacContainer));
app.UseResponseCompression();
app.UseStaticFiles();
app.UseDeveloperExceptionPage();
IdentityModelEventSource.ShowPII = true;
app.UseHttpsRedirection();
app.UseRouting();
app.ConfigureExceptionHandler();
app.UseCors("FileManagement");
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiXssMiddleware();
// Controllers (secured) 
app.MapControllers().RequireAuthorization("FileManagementApi");
// Static Files 
app.UseStaticFiles();
// ============================================ 
// TUS Endpoint 
// ============================================ 
app.MapTus("/api/Upload/tus", async httpContext =>
{
    var serviceProvider = httpContext.RequestServices;
    return TusConfiguration.GetTusConfiguration(serviceProvider, httpContext);
}).RequireAuthorization("FileManagementApi");
app.MapRazorPages();
app.MapDefaultControllerRoute();
app.Run();