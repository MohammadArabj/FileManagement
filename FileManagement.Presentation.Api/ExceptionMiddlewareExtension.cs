using System.Net;
using Epc.Core.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace FileManagement.Presentation.Api;

public static class ExceptionMiddlewareExtension
{
    public const int UserControlledErrorCode = 410;

    public static void ConfigureExceptionHandler(this IApplicationBuilder app)
    {
        app.UseExceptionHandler(appError =>
        {
            appError.Run(async context =>
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                context.Response.ContentType = "application/json";
                var contextFeature = context.Features.Get<IExceptionHandlerFeature>();
                if (contextFeature != null)
                {
                    var error = contextFeature.Error;
                    if (error is BusinessException)
                    {
                        context.Response.StatusCode = UserControlledErrorCode;
                        await context.Response.WriteAsync(error.ToString());
                    }
                    else
                    {
                        if (error.InnerException is not null)
                        {
                            if (error.InnerException.Message.Contains("DELETE statement conflicted"))
                            {
                                context.Response.StatusCode = UserControlledErrorCode;
                                await context.Response.WriteAsync("ردیف مورد نظر در سایر قسمت ها استفاده شده است.");
                            }
                            else if (error.Message.Contains("could not execute query"))
                            {
                                context.Response.StatusCode = UserControlledErrorCode;
                                await context.Response.WriteAsync(error.InnerException.Message);
                            }
                        }
                        else
                        {
                            await context.Response.WriteAsync("خطایی رخ داده است.");
                        }
                    }
                }
            });
        });
    }
}