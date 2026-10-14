using System;
using System.Windows.Forms;

namespace DdarinSongCollector;

static class Program
{
    [STAThread]
    static void Main()
    {
        _ = ChatCollector.RunAsync();

        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm());
    }
}
