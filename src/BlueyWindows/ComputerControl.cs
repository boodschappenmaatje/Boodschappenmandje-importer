using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Bluey;

/// Low-level hands on the keyboard and mouse, used only when the user asks him to do something.
/// Positions are in points from the primary screen's top-left (the overlay's space).
/// Takes the place of ComputerControl.swift (CGEvent) with Windows' SendInput.
public static class ComputerControl
{
    public sealed class UnknownKeyException(string key) : Exception($"I don't know the key \"{key}\".");

    // MARK: Coordinates

    private static (Rectangle Pixels, double Scale) Screen()
    {
        var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1440, 900);
        return (bounds, Native.ScaleFor(bounds));
    }

    private static Point ToPixels(Pt p)
    {
        var (px, scale) = Screen();
        return new Point(px.X + (int)Math.Round(p.X * scale), px.Y + (int)Math.Round(p.Y * scale));
    }

    /// Where the real mouse pointer is right now (points).
    public static Pt MouseLocation => CursorOverlay.MouseLocation;

    /// Puts the real pointer back where the user left it.
    public static void Warp(Pt point)
    {
        var p = ToPixels(point);
        SetCursorPos(p.X, p.Y);
    }

    // MARK: Mouse

    public static async Task Click(Pt point, bool right = false, int count = 1)
    {
        Move(point);
        await Task.Delay(30);
        uint down = right ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
        uint up = right ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;
        for (int i = 1; i <= Math.Max(1, count); i++)
        {
            SendMouse(down);
            await Task.Delay(35);
            SendMouse(up);
            if (i < count) await Task.Delay(60);
        }
    }

    public static void DragBegin(Pt point)
    {
        Move(point);
        SendMouse(MOUSEEVENTF_LEFTDOWN);
    }

    public static void DragMove(Pt point) => Move(point);

    public static void DragEnd(Pt point)
    {
        Move(point);
        SendMouse(MOUSEEVENTF_LEFTUP);
    }

    /// Scrolls smoothly at a point. Positive `dy` scrolls down the page, positive `dx` scrolls right.
    public static async Task Scroll(int dx, int dy, Pt point)
    {
        Move(point);
        const int steps = 12;
        for (int i = 0; i < steps; i++)
        {
            // Windows counts 120 per wheel notch; positive is up (vertical) or right (horizontal).
            if (dy != 0) SendMouse(MOUSEEVENTF_WHEEL, -dy / steps);
            if (dx != 0) SendMouse(MOUSEEVENTF_HWHEEL, dx / steps);
            await Task.Delay(16);
        }
    }

    /// Moves the real pointer (absolute, across the whole virtual desktop).
    private static void Move(Pt point)
    {
        var p = ToPixels(point);
        int left = GetSystemMetrics(SM_XVIRTUALSCREEN), top = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int width = Math.Max(1, GetSystemMetrics(SM_CXVIRTUALSCREEN) - 1), height = Math.Max(1, GetSystemMetrics(SM_CYVIRTUALSCREEN) - 1);
        var input = new INPUT
        {
            type = INPUT_MOUSE,
            u = new InputUnion
            {
                mi = new MOUSEINPUT
                {
                    dx = (int)Math.Round((p.X - left) * 65535.0 / width),
                    dy = (int)Math.Round((p.Y - top) * 65535.0 / height),
                    dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
                },
            },
        };
        SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>());
    }

    private static void SendMouse(uint flags, int data = 0)
    {
        var input = new INPUT { type = INPUT_MOUSE, u = new InputUnion { mi = new MOUSEINPUT { dwFlags = flags, mouseData = unchecked((uint)data) } } };
        SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>());
    }

    // MARK: Keyboard

    /// Types text as if on a keyboard, calling `onChunk` as each bit goes in (for the typing animation).
    public static async Task Type(string text, Action<string> onChunk)
    {
        // Short text types at a natural pace; long text goes in faster, a few characters at a time.
        int chunkSize = text.Length > 160 ? 6 : 1;
        int pause = text.Length > 160 ? 12 : 22;
        var chunk = new System.Text.StringBuilder();
        foreach (char c in text.Replace("\r\n", "\n"))
        {
            if (c == '\n' || c == '\r' || c == '\t')
            {
                if (chunk.Length > 0)
                {
                    TypeUnicode(chunk.ToString());
                    onChunk(chunk.ToString());
                    chunk.Clear();
                    await Task.Delay(pause);
                }
                PressKey(c == '\t' ? VK_TAB : VK_RETURN, Array.Empty<ushort>());
                await Task.Delay(pause);
                continue;
            }
            chunk.Append(c);
            if (chunk.Length >= chunkSize && !char.IsHighSurrogate(c))
            {
                TypeUnicode(chunk.ToString());
                onChunk(chunk.ToString());
                chunk.Clear();
                await Task.Delay(pause);
            }
        }
        if (chunk.Length > 0)
        {
            TypeUnicode(chunk.ToString());
            onChunk(chunk.ToString());
        }
    }

    private static void TypeUnicode(string text)
    {
        var inputs = new List<INPUT>();
        foreach (char unit in text)
        {
            foreach (uint up in new[] { 0u, KEYEVENTF_KEYUP })
                inputs.Add(new INPUT { type = INPUT_KEYBOARD, u = new InputUnion { ki = new KEYBDINPUT { wScan = unit, dwFlags = KEYEVENTF_UNICODE | up } } });
        }
        SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<INPUT>());
    }

    private static void PressKey(ushort key, ushort[] modifiers)
    {
        var inputs = new List<INPUT>();
        foreach (var m in modifiers) inputs.Add(Key(m, false));
        inputs.Add(Key(key, false));
        inputs.Add(Key(key, true));
        foreach (var m in modifiers.Reverse()) inputs.Add(Key(m, true));
        SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf<INPUT>());
    }

    private static INPUT Key(ushort vk, bool up) => new()
    {
        type = INPUT_KEYBOARD,
        u = new InputUnion
        {
            ki = new KEYBDINPUT
            {
                wVk = vk,
                dwFlags = (up ? KEYEVENTF_KEYUP : 0) | (ExtendedKeys.Contains(vk) ? KEYEVENTF_EXTENDEDKEY : 0),
            },
        },
    };

    /// Presses a key or shortcut like "ctrl+t", "enter", "ctrl+shift+n" or "down".
    /// "cmd" counts as Ctrl (he may think Mac). Returns a short label for it, like "Ctrl+T".
    public static string Press(string combo)
    {
        var modifiers = new List<ushort>();
        var label = new List<string>();
        ushort? key = null;
        string keyLabel = "";
        foreach (var part in combo.ToLowerInvariant().Replace(" ", "").Split('+', StringSplitOptions.RemoveEmptyEntries))
        {
            switch (part)
            {
                case "ctrl" or "control" or "cmd" or "command" or "⌘" or "⌃":
                    if (!modifiers.Contains(VK_CONTROL)) { modifiers.Add(VK_CONTROL); label.Add("Ctrl"); }
                    break;
                case "shift" or "⇧":
                    modifiers.Add(VK_SHIFT); label.Add("Shift");
                    break;
                case "alt" or "option" or "opt" or "⌥":
                    modifiers.Add(VK_MENU); label.Add("Alt");
                    break;
                case "win" or "windows" or "super" or "meta" or "start":
                    modifiers.Add(VK_LWIN); label.Add("Win");
                    break;
                default:
                    if (!KeyCodes.TryGetValue(part, out var code)) throw new UnknownKeyException(part);
                    key = code;
                    keyLabel = KeyLabels.TryGetValue(part, out var l) ? l : part.ToUpperInvariant();
                    break;
            }
        }
        if (key == null)
        {
            // A lone Windows key opens the Start menu.
            if (modifiers.Count == 1 && modifiers[0] == VK_LWIN) { PressKey(VK_LWIN, Array.Empty<ushort>()); return "Win"; }
            throw new UnknownKeyException(combo);
        }
        PressKey(key.Value, modifiers.ToArray());
        label.Add(keyLabel);
        return string.Join("+", label);
    }

    private static readonly Dictionary<string, ushort> KeyCodes = BuildKeyCodes();

    private static Dictionary<string, ushort> BuildKeyCodes()
    {
        var map = new Dictionary<string, ushort>
        {
            ["return"] = VK_RETURN, ["enter"] = VK_RETURN, ["tab"] = VK_TAB, ["space"] = 0x20, ["spacebar"] = 0x20,
            ["backspace"] = 0x08, ["delete"] = 0x2E, ["del"] = 0x2E, ["forwarddelete"] = 0x2E, ["insert"] = 0x2D,
            ["escape"] = 0x1B, ["esc"] = 0x1B,
            ["left"] = 0x25, ["up"] = 0x26, ["right"] = 0x27, ["down"] = 0x28,
            ["home"] = 0x24, ["end"] = 0x23, ["pageup"] = 0x21, ["pagedown"] = 0x22,
            ["-"] = 0xBD, ["minus"] = 0xBD, ["="] = 0xBB, ["equal"] = 0xBB, ["plus"] = 0xBB,
            ["["] = 0xDB, ["]"] = 0xDD, [";"] = 0xBA, ["'"] = 0xDE, [","] = 0xBC, ["comma"] = 0xBC,
            ["."] = 0xBE, ["period"] = 0xBE, ["/"] = 0xBF, ["slash"] = 0xBF, ["\\"] = 0xDC, ["`"] = 0xC0,
            ["printscreen"] = 0x2C,
        };
        for (char c = 'a'; c <= 'z'; c++) map[c.ToString()] = (ushort)char.ToUpperInvariant(c);
        for (char c = '0'; c <= '9'; c++) map[c.ToString()] = c;
        for (int i = 1; i <= 12; i++) map["f" + i] = (ushort)(0x70 + i - 1);
        return map;
    }

    private static readonly Dictionary<string, string> KeyLabels = new()
    {
        ["return"] = "↵", ["enter"] = "↵", ["tab"] = "Tab", ["space"] = "Space", ["spacebar"] = "Space",
        ["backspace"] = "⌫", ["delete"] = "Del", ["del"] = "Del", ["escape"] = "Esc", ["esc"] = "Esc",
        ["left"] = "←", ["right"] = "→", ["up"] = "↑", ["down"] = "↓", ["pageup"] = "PgUp", ["pagedown"] = "PgDn",
    };

    /// Keys that need the "extended" flag to be told apart from the number pad.
    private static readonly HashSet<ushort> ExtendedKeys = new() { 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, VK_LWIN };

    // MARK: Apps and links

    /// Opens (or brings forward) an app by name, like "Chrome", "Kladblok" or "Word".
    public static async Task<string> OpenApp(string name)
    {
        var wanted = name.Trim().ToLowerInvariant().Replace(".exe", "");

        // Already running: bring its window forward.
        foreach (var process in Process.GetProcesses())
        {
            try
            {
                if (process.MainWindowHandle == IntPtr.Zero) continue;
                var title = process.MainWindowTitle.ToLowerInvariant();
                if (process.ProcessName.ToLowerInvariant() == wanted || title.EndsWith(" - " + wanted) || title == wanted)
                {
                    BringForward(process.MainWindowHandle);
                    return $"Switched to {name}.";
                }
            }
            catch (Exception) { }
        }

        // A Start menu shortcut with that name.
        if (FindShortcut(wanted) is { } shortcut)
        {
            try
            {
                Process.Start(new ProcessStartInfo(shortcut) { UseShellExecute = true });
                return $"Opened {Path.GetFileNameWithoutExtension(shortcut)}.";
            }
            catch (Exception) { }
        }

        // Anything else (Store apps like Calculator or Settings): search for it in the Start menu, like a person would.
        PressKey(VK_LWIN, Array.Empty<ushort>());
        await Task.Delay(700);
        TypeUnicode(name);
        await Task.Delay(900);
        PressKey(VK_RETURN, Array.Empty<ushort>());
        return $"Searched the Start menu for {name} and pressed Enter.";
    }

    private static string? FindShortcut(string wanted)
    {
        var folders = new[]
        {
            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
            Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
        };
        var shortcuts = new List<string>();
        foreach (var folder in folders.Where(Directory.Exists))
        {
            try { shortcuts.AddRange(Directory.EnumerateFiles(folder, "*.lnk", SearchOption.AllDirectories)); }
            catch (Exception) { }
        }
        string Name(string path) => Path.GetFileNameWithoutExtension(path).ToLowerInvariant();
        return shortcuts.FirstOrDefault(s => Name(s) == wanted)
            ?? shortcuts.FirstOrDefault(s => Name(s).StartsWith(wanted))
            ?? shortcuts.FirstOrDefault(s => Name(s).Contains(wanted) && !Name(s).Contains("uninstall") && !Name(s).Contains("verwijder"));
    }

    private static void BringForward(IntPtr window)
    {
        if (IsIconic(window)) ShowWindow(window, SW_RESTORE);
        // Windows only lets the app in front hand over focus; a tap on Alt counts as user input and allows it.
        PressKey(VK_MENU, Array.Empty<ushort>());
        SetForegroundWindow(window);
    }

    /// Opens a website or link in the default browser.
    public static string OpenUrl(string text)
    {
        var address = text.Trim();
        if (!address.Contains("://")) address = "https://" + address;
        if (!Uri.TryCreate(address, UriKind.Absolute, out var url) || (url.Scheme != "http" && url.Scheme != "https"))
            return "That doesn't look like a web address.";
        Process.Start(new ProcessStartInfo(url.ToString()) { UseShellExecute = true });
        return $"Opened {url.Host}.";
    }

    // MARK: Native

    private const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    private const uint MOUSEEVENTF_MOVE = 0x1, MOUSEEVENTF_LEFTDOWN = 0x2, MOUSEEVENTF_LEFTUP = 0x4,
                       MOUSEEVENTF_RIGHTDOWN = 0x8, MOUSEEVENTF_RIGHTUP = 0x10, MOUSEEVENTF_WHEEL = 0x800,
                       MOUSEEVENTF_HWHEEL = 0x1000, MOUSEEVENTF_VIRTUALDESK = 0x4000, MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x1, KEYEVENTF_KEYUP = 0x2, KEYEVENTF_UNICODE = 0x4;
    private const ushort VK_RETURN = 0x0D, VK_TAB = 0x09, VK_SHIFT = 0x10, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_LWIN = 0x5B;
    private const int SM_XVIRTUALSCREEN = 76, SM_YVIRTUALSCREEN = 77, SM_CXVIRTUALSCREEN = 78, SM_CYVIRTUALSCREEN = 79;
    private const int SW_RESTORE = 9;

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT { public uint uMsg; public ushort wParamL, wParamH; }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT { public uint type; public InputUnion u; }

    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
}
