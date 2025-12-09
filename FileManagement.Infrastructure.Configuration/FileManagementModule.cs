using Autofac;
using Autofac.Extras.DynamicProxy;
using Epc.Application.Command;
using Epc.Application.Query;
using Epc.Autofac;
using Epc.Domain;
using FileManagement.Application;
using FileManagement.Domain.AttachmentAgg.Service;
using FileManagement.Domain.UploadSessionAgg;
using FileManagement.Infrastructure.Acl;
using FileManagement.Infrastructure.Persistence;
using FileManagement.Infrastructure.Persistence.Repositories;
using FileManagement.Infrastructure.Query;
using FileManagement.Infrastructure.Tus;
using FileManagement.Presentation.Facade.Command;
using FileManagement.Presentation.Facade.Query;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace FileManagement.Infrastructure.Configuration;

public class FileManagementModule(string connectionString) : Module
{
    private string ConnectionString { get; set; } = connectionString;

    protected override void Load(ContainerBuilder builder)
    {
        // ============================================
        // Repositories
        // ============================================
        var repositoryAssembly = typeof(AttachmentRepository).Assembly;
        builder.RegisterAssemblyTypes(repositoryAssembly)
            .AsClosedTypesOf(typeof(IRepository<,>))
            .InstancePerLifetimeScope();

        // UploadSession Repository
        builder.RegisterType<UploadSessionRepository>()
            .As<IUploadSessionRepository>()
            .InstancePerLifetimeScope();

        // ============================================
        // Domain Services
        // ============================================
        var domainServiceAssembly = typeof(AttachmentService).Assembly;
        builder.RegisterAssemblyTypes(domainServiceAssembly)
            .Where(t => t.Name.EndsWith("Service"))
            .AsImplementedInterfaces();

        // ============================================
        // Command Handlers
        // ============================================
        var commandHandlersAssembly = typeof(AttachmentCommandHandler).Assembly;

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandler<>))
            .InstancePerLifetimeScope();

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandler<,>))
            .InstancePerLifetimeScope();

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandlerAsync<>))
            .InstancePerLifetimeScope();

        builder.RegisterAssemblyTypes(commandHandlersAssembly)
            .AsClosedTypesOf(typeof(ICommandHandlerAsync<,>))
            .InstancePerLifetimeScope();

        // ============================================
        // Query Handlers
        // ============================================
        var queryHandlerAssembly = typeof(AttachmentQueryHandler).Assembly;

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandler<>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandler<,>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandlerAsync<>))
            .InstancePerDependency();

        builder.RegisterAssemblyTypes(queryHandlerAssembly)
            .AsClosedTypesOf(typeof(IQueryHandlerAsync<,>))
            .InstancePerDependency();

        // ============================================
        // DbContexts
        // ============================================
        if (!ConnectionString.Contains("Server"))
            ConnectionString = Encoding.UTF8.GetString(Convert.FromBase64String(ConnectionString));

        builder.Register(_ =>
        {
            var optionsBuilder = new DbContextOptionsBuilder<FileManagementCommandContext>();
            optionsBuilder.UseSqlServer(ConnectionString);
            return new FileManagementCommandContext(optionsBuilder.Options);
        })
            .As<DbContext>()
            .As<FileManagementCommandContext>()
            .InstancePerLifetimeScope();

        builder.Register(_ =>
        {
            var optionsBuilder = new DbContextOptionsBuilder<FileManagementQueryContext>();
            optionsBuilder.UseSqlServer(ConnectionString);
            return new FileManagementQueryContext(optionsBuilder.Options);
        })
            .As<FileManagementQueryContext>()
            .InstancePerDependency();

        // ============================================
        // Facades
        // ============================================
        var facadeAssembly = typeof(AttachmentCommandFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeAssembly)
            .Where(t => t.Name.EndsWith("CommandFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        var facadeQueryAssembly = typeof(AttachmentQueryFacade).Assembly;
        builder.RegisterAssemblyTypes(facadeQueryAssembly)
            .Where(t => t.Name.EndsWith("QueryFacade"))
            .InstancePerLifetimeScope()
            .EnableInterfaceInterceptors()
            .InterceptedBy(typeof(SecurityInterceptor))
            .AsImplementedInterfaces();

        // ============================================
        // ACL Services
        // ============================================
        var aclServiceAssembly = typeof(UserManagementAclService).Assembly;
        builder.RegisterAssemblyTypes(aclServiceAssembly)
            .Where(t => t.Name.EndsWith("AclService"))
            .AsImplementedInterfaces()
            .InstancePerLifetimeScope();

        // ============================================
        // TUS Services
        // ============================================
        builder.RegisterType<TusFileService>()
            .As<ITusFileService>()
            .InstancePerLifetimeScope();

        base.Load(builder);
    }
}
