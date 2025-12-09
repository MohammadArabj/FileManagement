using System.Net;
using System.Text;
using Newtonsoft.Json;

namespace FileManagement.Presentation.Api;

public class AntiXssMiddleware
{
    private readonly RequestDelegate _next;
    private ErrorResponse _error;
    private readonly int _statusCode = (int)HttpStatusCode.BadRequest;

    private static readonly string[] SkipPaths =
    {
        "/api/upload/tus",
        "/api/attachment/upload",
        "/api/attachment/uploadfile",
        "/api/attachment/uploadfiles"
    };

    public AntiXssMiddleware(RequestDelegate next)
    {
        _next = next ?? throw new ArgumentNullException(nameof(next));
    }

    public async Task Invoke(HttpContext context)
    {
        // ✅ Skip کردن مسیرهای آپلود فایل
        var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
        if (ShouldSkipPath(path))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        // Check XSS in URL
        if (!string.IsNullOrWhiteSpace(context.Request.Path.Value))
        {
            var url = context.Request.Path.Value;

            if (CrossSiteScriptingValidation.IsDangerousString(url, out _))
            {
                await RespondWithAnError(context).ConfigureAwait(false);
                return;
            }
        }

        // Check XSS in query string
        if (!string.IsNullOrWhiteSpace(context.Request.QueryString.Value))
        {
            var queryString = WebUtility.UrlDecode(context.Request.QueryString.Value);

            if (CrossSiteScriptingValidation.IsDangerousString(queryString, out _))
            {
                await RespondWithAnError(context).ConfigureAwait(false);
                return;
            }
        }

        // ✅ Skip body check for large requests or file uploads
        if (ShouldSkipBodyCheck(context))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        // Check XSS in request content
        var originalBody = context.Request.Body;
        try
        {
            var content = await ReadRequestBody(context);

            if (CrossSiteScriptingValidation.IsDangerousString(content, out _))
            {
                await RespondWithAnError(context).ConfigureAwait(false);
                return;
            }

            await _next(context).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // کلاینت خودش قطع کرده (طبیعی)
            return;
        }
        catch (IOException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client reset the request stream
            return;
        }

    }

    /// <summary>
    /// آیا این مسیر باید Skip شود؟
    /// </summary>
    private static bool ShouldSkipPath(string path)
    {
        foreach (var skipPath in SkipPaths)
        {
            if (path.StartsWith(skipPath, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// آیا بررسی Body باید Skip شود؟
    /// </summary>
    private static bool ShouldSkipBodyCheck(HttpContext context)
    {
        var method = context.Request.Method;

        // 1) روش‌های بدون بدنه
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method))
            return true;

        // 2) درخواست‌های بزرگ
        if (context.Request.ContentLength.HasValue && context.Request.ContentLength.Value > 1024 * 1024)
            return true;

        // 3) فایل‌ها / باینری‌ها
        var contentType = (context.Request.ContentType ?? "").ToLowerInvariant();

        if (contentType.Contains("multipart/form-data"))
            return true;

        if (contentType.Contains("application/offset+octet-stream"))
            return true;

        if (contentType.Contains("application/octet-stream"))
            return true;

        // 4) فقط متنی‌ها را بررسی کن
        var isTextLike =
            contentType.Contains("application/json") ||
            contentType.Contains("application/x-www-form-urlencoded") ||
            contentType.Contains("text/") ||
            contentType.Contains("application/xml");

        if (!isTextLike)
            return true;

        // 5) TUS HEAD/PATCH با header
        if ((method.Equals("PATCH", StringComparison.OrdinalIgnoreCase) || method.Equals("HEAD", StringComparison.OrdinalIgnoreCase)) &&
            !string.IsNullOrEmpty(context.Request.Headers["Tus-Resumable"].FirstOrDefault()))
            return true;

        return false;
    }


    private static async Task<string> ReadRequestBody(HttpContext context)
    {
        const int maxChars = 1024 * 1024; // تقریبی: 1MB در حد کاراکتر

        // این کار Body را rewindable می‌کند (بدون اینکه Stream را عوض کنیم)
        context.Request.EnableBuffering(bufferThreshold: 1024 * 30, bufferLimit: 1024 * 1024);

        context.Request.Body.Position = 0;

        using var reader = new StreamReader(
            context.Request.Body,
            Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 8192,
            leaveOpen: true);

        var sb = new StringBuilder();
        var buf = new char[8192];

        while (sb.Length < maxChars)
        {
            var read = await reader.ReadAsync(buf.AsMemory(0, buf.Length), context.RequestAborted);
            if (read == 0) break;
            sb.Append(buf, 0, read);
            if (sb.Length >= maxChars) break;
        }

        context.Request.Body.Position = 0;
        return sb.ToString();
    }


    private async Task RespondWithAnError(HttpContext context)
    {
        context.Response.Clear();
        context.Response.Headers.AddHeaders();
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.StatusCode = _statusCode;

        if (_error == null)
        {
            _error = new ErrorResponse
            {
                Description = "Error from AntiXssMiddleware",
                ErrorCode = 500
            };
        }

        await context.Response.WriteAsync(_error.ToJSON());
    }
}

public static class AntiXssMiddlewareExtension
{
    public static IApplicationBuilder UseAntiXssMiddleware(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AntiXssMiddleware>();
    }
}

public static class CrossSiteScriptingValidation
{
    private static readonly char[] StartingChars = { '<', '&' };

    #region Public methods

    public static bool IsDangerousString(string s, out int matchIndex)
    {
        matchIndex = 0;

        if (s.Contains("<script") || s.Contains("<html") || s.Contains("<css") || s.Contains("<php"))
            return true;

        for (var i = 0; ;)
        {
            var n = s.IndexOfAny(StartingChars, i);

            if (n < 0) return false;
            if (n == s.Length - 1) return false;

            matchIndex = n;
            i = n + 1;
        }
    }

    #endregion

    #region Private methods

    private static bool IsAtoZ(char c)
    {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
    }

    #endregion

    public static void AddHeaders(this IHeaderDictionary headers)
    {
        if (headers["P3P"].IsNullOrEmpty())
        {
            headers.Add("P3P", "CP=\"IDC DSP COR ADM DEVi TAIi PSA PSD IVAi IVDi CONi HIS OUR IND CNT\"");
        }
    }

    public static bool IsNullOrEmpty<T>(this IEnumerable<T> source)
    {
        return source == null || !source.Any();
    }

    public static string ToJSON(this object value)
    {
        return JsonConvert.SerializeObject(value);
    }
}

public class ErrorResponse
{
    public int ErrorCode { get; set; }
    public string Description { get; set; }
}
