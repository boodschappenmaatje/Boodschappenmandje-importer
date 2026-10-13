namespace Bluey;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // Only one Bluey at a time: a second copy would fight over the phone and the screen.
        using var single = new Mutex(true, "Bluey.Windows.SingleInstance", out bool first);
        if (!first) return;

        ApplicationConfiguration.Initialize();
        Application.Run(new TrayApp());
    }
}
