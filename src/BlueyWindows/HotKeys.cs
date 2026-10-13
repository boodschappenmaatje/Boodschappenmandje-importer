using System.Runtime.InteropServices;

namespace Bluey;

/// System-wide shortcuts (Ctrl+Alt+key), working whichever app is in front.
public sealed class HotKeys : NativeWindow, IDisposable
{
    private const int WM_HOTKEY = 0x0312;
    private const uint MOD_ALT = 0x1, MOD_CONTROL = 0x2, MOD_NOREPEAT = 0x4000;

    private readonly Dictionary<int, Action> actions = new();
    private readonly List<string> failed = new();
    private int nextId = 1;

    /// Shortcuts another app already holds (so they can be mentioned in the menu).
    public IReadOnlyList<string> Failed => failed;

    public HotKeys() => CreateHandle(new CreateParams());

    public void Register(Keys key, Action action, string label)
    {
        int id = nextId++;
        if (RegisterHotKey(Handle, id, MOD_CONTROL | MOD_ALT | MOD_NOREPEAT, (uint)key)) actions[id] = action;
        else failed.Add(label);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY && actions.TryGetValue(m.WParam.ToInt32(), out var action)) action();
        base.WndProc(ref m);
    }

    public void Dispose()
    {
        foreach (var id in actions.Keys) UnregisterHotKey(Handle, id);
        DestroyHandle();
    }

    [DllImport("user32.dll")] private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
