using System.IO;
using Microsoft.Web.WebView2.Core;

namespace Daymark;

internal static class BundledInterface
{
    // Use the hosted origin so upgrades retain local storage and device keys.
    const string Root = "https://domalega.github.io/diploma/";
    public const string Page = Root + "app.html";
    static readonly Uri AppPage = new(Page);

    public static bool IsAppPage(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        uri.Scheme == AppPage.Scheme && uri.Host == AppPage.Host && uri.IsDefaultPort &&
        uri.UserInfo.Length == 0 && uri.AbsolutePath == AppPage.AbsolutePath;

    public static void Attach(CoreWebView2 web, CoreWebView2Environment environment)
    {
        var root = Path.Combine(AppContext.BaseDirectory, "web");
        var index = Path.Combine(root, "index.html");
        if (!File.Exists(index))
            throw new FileNotFoundException("The bundled Jotstride interface is missing. Extract the entire Windows ZIP.", index);

        // Build the URL-to-file map from the package, never from a request path.
        var files = Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Where(file => ContentType(file) != null)
            .ToDictionary(file => new Uri(Root + Path.GetRelativePath(root, file).Replace('\\', '/')).AbsolutePath,
                StringComparer.Ordinal);
        files.Add(AppPage.AbsolutePath, index);

        web.AddWebResourceRequestedFilter(Root + "*", CoreWebView2WebResourceContext.All,
            CoreWebView2WebResourceRequestSourceKinds.All);
        web.WebResourceRequested += (_, args) =>
        {
            if (args.Request.Method == "GET" && Uri.TryCreate(args.Request.Uri, UriKind.Absolute, out var uri) &&
                files.TryGetValue(uri.AbsolutePath, out var file))
            {
                var headers = $"Content-Type: {ContentType(file)}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff";
                args.Response = environment.CreateWebResourceResponse(File.OpenRead(file), 200, "OK", headers);
                return;
            }
            args.Response = environment.CreateWebResourceResponse(Stream.Null, 404, "Not Found", "");
        };
    }

    static string? ContentType(string file) => Path.GetExtension(file) switch
    {
        ".html" => "text/html; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".js" => "application/javascript; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".woff" => "font/woff",
        ".woff2" => "font/woff2",
        _ => null
    };
}
