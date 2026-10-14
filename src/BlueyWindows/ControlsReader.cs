using System.Windows.Automation;

namespace Bluey;

/// A clickable control on screen (button, field, link, checkbox…).
public sealed record ScreenControl(string Id, string Kind, string Label, Box Rect);

/// Reads the clickable controls of the front window through UI Automation, so he can click things that have
/// no visible text, like icon buttons. Takes the place of ControlsReader.swift (macOS Accessibility).
/// Runs on a background thread: UI Automation calls can block while another app is busy.
public static class ControlsReader
{
    private static readonly Dictionary<int, string> Kinds = new()
    {
        [ControlType.Button.Id] = "button", [ControlType.SplitButton.Id] = "menu button", [ControlType.CheckBox.Id] = "checkbox",
        [ControlType.RadioButton.Id] = "option", [ControlType.Edit.Id] = "text field", [ControlType.Document.Id] = "text area",
        [ControlType.ComboBox.Id] = "combo box", [ControlType.Hyperlink.Id] = "link", [ControlType.Slider.Id] = "slider",
        [ControlType.Spinner.Id] = "stepper", [ControlType.TabItem.Id] = "tab", [ControlType.MenuItem.Id] = "menu",
        [ControlType.ListItem.Id] = "list item", [ControlType.TreeItem.Id] = "tree item",
    };
    private static readonly HashSet<string> FieldKinds = new() { "text field", "text area", "combo box" };

    /// The front window's visible controls, in reading order. Stays within a small time budget.
    public static Task<List<ScreenControl>> Read(int limit = 140, double budgetSeconds = 0.6) => Task.Run(() =>
    {
        var found = new List<(string Kind, string Label, Box Rect)>();
        try
        {
            var hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return new List<ScreenControl>();
            var root = AutomationElement.FromHandle(hwnd);
            var (screen, scale) = Screen();
            var deadline = DateTime.UtcNow.AddSeconds(budgetSeconds);
            var walker = TreeWalker.ControlViewWalker;
            var queue = new Queue<AutomationElement>();
            queue.Enqueue(root);
            var seen = new HashSet<string>();
            int visited = 0;
            while (queue.Count > 0 && visited < 4000 && DateTime.UtcNow < deadline)
            {
                var element = queue.Dequeue();
                visited++;
                try
                {
                    var info = element.Current;
                    if (Kinds.TryGetValue(info.ControlType.Id, out var kind) && !info.IsOffscreen)
                    {
                        var r = info.BoundingRectangle;
                        if (!r.IsEmpty && r.Width > 3 && r.Height > 3)
                        {
                            var box = new Box((r.X - screen.X) / scale, (r.Y - screen.Y) / scale, r.Width / scale, r.Height / scale);
                            var label = Describe(element, info, kind);
                            var key = $"{(int)box.X},{(int)box.Y},{(int)box.Width},{(int)box.Height}";
                            if ((label.Length > 0 || FieldKinds.Contains(kind)) && seen.Add(key)) found.Add((kind, label, box));
                        }
                    }
                    // Closed menus and long lists can hold thousands of items; don't walk into those.
                    if (info.ControlType.Id == ControlType.MenuItem.Id) continue;
                    var child = walker.GetFirstChild(element);
                    int children = 0;
                    while (child != null && children < 400)
                    {
                        queue.Enqueue(child);
                        children++;
                        child = walker.GetNextSibling(child);
                    }
                }
                catch (ElementNotAvailableException) { }
            }
        }
        catch (Exception) { }

        return found
            .OrderBy(f => Math.Round(f.Rect.Y / 6))
            .ThenBy(f => f.Rect.X)
            .Take(limit)
            .Select((f, i) => new ScreenControl($"C{i + 1}", f.Kind, f.Label, f.Rect))
            .ToList();
    });

    /// Where typing will go, and whether it's a password field.
    public static Task<(Box? Frame, bool Secure)> FocusedField() => Task.Run<(Box?, bool)>(() =>
    {
        try
        {
            var focused = AutomationElement.FocusedElement;
            if (focused == null) return (null, false);
            var info = focused.Current;
            var (screen, scale) = Screen();
            var r = info.BoundingRectangle;
            Box? frame = r.IsEmpty ? null : new Box((r.X - screen.X) / scale, (r.Y - screen.Y) / scale, r.Width / scale, r.Height / scale);
            return (frame, info.IsPassword);
        }
        catch (Exception) { return (null, false); }
    });

    private static string Describe(AutomationElement element, AutomationElement.AutomationElementInformation info, string kind)
    {
        var parts = new List<string>();
        foreach (var text in new[] { info.Name, info.HelpText })
        {
            var clean = (text ?? "").Trim();
            if (clean.Length > 0) { parts.Add(clean); break; }
        }
        if (element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern) && pattern is ValuePattern value)
        {
            var clean = (value.Current.Value ?? "").Trim();
            if (FieldKinds.Contains(kind) && clean.Length > 0 && !info.IsPassword) parts.Add("contains: " + Clip(clean, 40));
            else if (parts.Count == 0 && clean.Length > 0 && !info.IsPassword) parts.Add(Clip(clean, 40));
        }
        return Clip(string.Join(", ", parts).Replace('\n', ' '), 80);
    }

    private static string Clip(string text, int max) => text.Length > max ? text[..max] : text;

    private static (System.Drawing.Rectangle, double) Screen()
    {
        var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? new System.Drawing.Rectangle(0, 0, 1440, 900);
        return (bounds, Native.ScaleFor(bounds));
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
}
