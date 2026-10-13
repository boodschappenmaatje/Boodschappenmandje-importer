using System.Drawing;

namespace Bluey;

/// Small windows for typing in a key or his personality.
public static class Dialogs
{
    /// Asks for the OpenAI API key. Returns null when cancelled.
    public static string? AskForKey(bool hasKey)
    {
        using var form = Window("OpenAI API Key", 460, 190);
        var label = new Label
        {
            Text = "Saved privately on this PC, encrypted for your Windows account (not in the project files). " +
                   "The phone only ever gets short-lived keys.",
            Location = new Point(14, 12), Size = new Size(420, 40),
        };
        var field = new TextBox
        {
            Location = new Point(14, 60), Size = new Size(420, 24), UseSystemPasswordChar = true,
            PlaceholderText = hasKey ? "Key saved. Paste a new one to replace it." : "sk-…",
        };
        var (ok, cancel) = Buttons(form, 110);
        form.Controls.AddRange(new Control[] { label, field, ok, cancel });
        form.ActiveControl = field;
        return form.ShowDialog() == DialogResult.OK ? field.Text.Trim() : null;
    }

    public enum PersonalityChoice { Cancel, Save, Reset }

    /// Edits who he is. Returns the choice and the text.
    public static (PersonalityChoice Choice, string Text) EditPersonality(string current)
    {
        using var form = Window("His Personality", 540, 380);
        var label = new Label
        {
            Text = "Describe who he is and how he talks. How he looks at and points at your screen stays built in.",
            Location = new Point(14, 12), Size = new Size(500, 36),
        };
        var text = new TextBox
        {
            Location = new Point(14, 52), Size = new Size(500, 230), Multiline = true, ScrollBars = ScrollBars.Vertical,
            Text = current, AcceptsReturn = true,
        };
        var (ok, cancel) = Buttons(form, 300);
        var reset = new Button { Text = "Reset to Default", Location = new Point(14, 300), Size = new Size(130, 30), DialogResult = DialogResult.Retry };
        form.Controls.AddRange(new Control[] { label, text, ok, cancel, reset });
        form.ActiveControl = text;
        return form.ShowDialog() switch
        {
            DialogResult.OK => (PersonalityChoice.Save, text.Text),
            DialogResult.Retry => (PersonalityChoice.Reset, ""),
            _ => (PersonalityChoice.Cancel, current),
        };
    }

    private static Form Window(string title, int width, int height) => new()
    {
        Text = "Bluey – " + title,
        ClientSize = new Size(width, height),
        FormBorderStyle = FormBorderStyle.FixedDialog,
        MaximizeBox = false, MinimizeBox = false,
        StartPosition = FormStartPosition.CenterScreen,
        TopMost = true,
        Font = SystemFonts.MessageBoxFont,
    };

    private static (Button Ok, Button Cancel) Buttons(Form form, int y)
    {
        int right = form.ClientSize.Width - 14;
        var ok = new Button { Text = "Save", Location = new Point(right - 190, y), Size = new Size(90, 30), DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Cancel", Location = new Point(right - 90, y), Size = new Size(90, 30), DialogResult = DialogResult.Cancel };
        form.AcceptButton = ok;
        form.CancelButton = cancel;
        return (ok, cancel);
    }
}
