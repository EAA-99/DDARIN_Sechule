using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace DdarinSongCollector;

public class MainForm : Form
{
    readonly WebView2 webView = new();

    public MainForm()
    {
        Text = "DDARIN 신청곡 받기";
        Width = 1100;
        Height = 760;
        StartPosition = FormStartPosition.CenterScreen;

        // 창/작업표시줄 아이콘 (exe 아이콘과 동일한 파일 사용)
        var iconPath = Path.Combine(AppContext.BaseDirectory, "app.ico");
        if (File.Exists(iconPath)) Icon = new System.Drawing.Icon(iconPath);

        webView.Dock = DockStyle.Fill;
        Controls.Add(webView);

        Load += MainForm_Load;
    }

    async void MainForm_Load(object? sender, EventArgs e)
    {
        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "DDARIN_songcollector", "WebView2");
            var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
            await webView.EnsureCoreWebView2Async(env);

            // 실행할 때마다 항상 최신 webui 파일을 쓰도록, 이전 실행에서 남은 캐시를 지운다
            await webView.CoreWebView2.CallDevToolsProtocolMethodAsync("Network.clearBrowserCache", "{}");

            // 실제 일정표 도메인(ddarin-sechule.vercel.app)에서 페이지를 여는 것처럼 만들어야
            // Google Sheets API 키의 "허용된 도메인(리퍼러)" 제한을 통과해 노래책 데이터를 불러올 수 있다.
            // 단, /api/... 같은 실제 서버 경로는 계속 진짜 네트워크로 나가야 하므로 webui 폴더에
            // 있는 파일(index.html, app.js, style.css)만 골라서 로컬로 가로채고 나머지는 그대로 흘려보낸다.
            var webuiPath = Path.Combine(AppContext.BaseDirectory, "webui");
            const string origin = "https://ddarin-sechule.vercel.app";
            webView.CoreWebView2.AddWebResourceRequestedFilter($"{origin}/*", CoreWebView2WebResourceContext.All);
            webView.CoreWebView2.WebResourceRequested += (sender, args) =>
            {
                var requestUri = new Uri(args.Request.Uri);
                var relativePath = requestUri.AbsolutePath.TrimStart('/');
                var localFilePath = Path.Combine(webuiPath, relativePath);
                if (!File.Exists(localFilePath)) return;

                var contentType = Path.GetExtension(localFilePath).ToLowerInvariant() switch
                {
                    ".html" => "text/html; charset=utf-8",
                    ".js" => "application/javascript; charset=utf-8",
                    ".css" => "text/css; charset=utf-8",
                    _ => "application/octet-stream",
                };
                var stream = File.OpenRead(localFilePath);
                args.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                    stream, 200, "OK", $"Content-Type: {contentType}");
            };
            webView.CoreWebView2.Navigate($"{origin}/index.html");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                this,
                "이 프로그램을 실행하려면 Microsoft Edge WebView2 런타임이 필요합니다.\n" +
                "대부분의 Windows 10/11에는 이미 설치되어 있지만, 없다면 아래 주소에서 설치할 수 있어요.\n\n" +
                "https://developer.microsoft.com/microsoft-edge/webview2/",
                "WebView2 런타임 필요",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, $"화면을 여는 중 오류가 발생했습니다: {ex.Message}", "오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
