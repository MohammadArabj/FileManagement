using FileManagement.Api.Infrastructure;
using FileManagement.Api.Models;
using FileManagement.Api.Services;
using tusdotnet;
using tusdotnet.Models.Configuration;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<TusSettings>(builder.Configuration.GetSection("TusSettings"));
builder.Services.Configure<FileStorageOptions>(builder.Configuration.GetSection("FileStorage"));
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<FileStorageOptions>>().Value);
builder.Services.AddSingleton<IAttachmentRepository, InMemoryAttachmentRepository>();
builder.Services.AddScoped<IAttachmentService, AttachmentService>();
builder.Services.AddSingleton<ITusFileService, TusDiskFileService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();

app.MapControllers();

app.MapTus("/api/upload/tus", httpContext => TusConfigurationFactory.Build(httpContext));

app.Run();
