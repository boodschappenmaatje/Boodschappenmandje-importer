using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace Bluey;

/// The research report card. It shows up while he researches, then shows the report with its sources.
/// It sits in the top-right corner and stays until you close it. Takes the place of ReportPanel.swift.
public sealed class ReportPanel : Form
{
    private const int CardWidth = 440;
    private readonly Label title = new();
    private readonly Label body = new();
    private readonly FlowLayoutPanel sources = new();
    private readonly Panel scroller = new();
    private readonly Label close = new();

    public ReportPanel()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        TopMost = true;
        BackColor = Color.White;
        Font = new Font("Segoe UI", 10.5f);
        Padding = new Padding(1);

        close.Text = "×";
        close.Font = new Font("Segoe UI", 15f);
        close.ForeColor = Palette.Berry3;
        close.AutoSize = true;
        close.Cursor = Cursors.Hand;
        close.Click += (_, _) => Hide();

        title.Font = new Font("Segoe UI Semibold", 13f);
        title.ForeColor = Palette.Berry4;
        title.AutoSize = true;
        title.MaximumSize = new Size(CardWidth - 70, 0);
        title.Location = new Point(18, 14);

        body.ForeColor = Palette.Ink;
        body.AutoSize = true;
        body.MaximumSize = new Size(CardWidth - 46, 0);

        sources.FlowDirection = FlowDirection.TopDown;
        sources.WrapContents = false;
        sources.AutoSize = true;

        scroller.AutoScroll = true;
        scroller.BackColor = Color.White;
        scroller.Controls.Add(body);
        scroller.Controls.Add(sources);

        Controls.Add(close);
        Controls.Add(title);
        Controls.Add(scroller);
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE | Native.WS_EX_TOPMOST;
            cp.ClassStyle |= 0x20000;  // CS_DROPSHADOW
            return cp;
        }
    }

    public void ShowLoading(string question) =>
        Present(AppSettings.Shared.Language == "nl" ? "Even zoeken…" : "Doing some research…", question, new());

    public void ShowReport(ResearchReport report) =>
        Present(report.Title, string.Join("\n\n", report.Paragraphs), report.Sources);

    public void ShowError(string message) =>
        Present(AppSettings.Shared.Language == "nl" ? "Dat lukte niet" : "That didn't work", message, new());

    private void Present(string heading, string text, List<(string Title, string Url)> links)
    {
        title.Text = heading;
        body.Text = text;
        sources.Controls.Clear();
        if (links.Count > 0)
        {
            sources.Controls.Add(new Label
            {
                Text = AppSettings.Shared.Language == "nl" ? "Bronnen" : "Sources",
                AutoSize = true, ForeColor = Color.Gray, Margin = new Padding(0, 10, 0, 2),
            });
        }
        foreach (var (name, url) in links)
        {
            var link = new LinkLabel
            {
                Text = name.Length > 60 ? name[..57] + "…" : name,
                AutoSize = true,
                LinkColor = Palette.Berry3,
                Margin = new Padding(0, 2, 0, 2),
            };
            link.LinkClicked += (_, _) =>
            {
                try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch (Exception) { }
            };
            sources.Controls.Add(link);
        }
        LayoutCard();
        if (!Visible) Show();
        BringToFront();
    }

    private void LayoutCard()
    {
        var area = System.Windows.Forms.Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1440, 900);
        float k = DeviceDpi / 96f;
        int width = (int)(CardWidth * k);
        title.MaximumSize = new Size(width - (int)(70 * k), 0);
        body.MaximumSize = new Size(width - (int)(46 * k), 0);
        close.Location = new Point(width - close.PreferredWidth - (int)(10 * k), (int)(6 * k));

        int top = title.Bottom + (int)(10 * k);
        body.Location = new Point(0, 0);
        sources.Location = new Point(0, body.Height + (int)(4 * k));
        int content = sources.Bottom + (int)(4 * k);
        int maxScroll = (int)(area.Height * 0.6);
        scroller.Location = new Point((int)(18 * k), top);
        scroller.Size = new Size(width - (int)(28 * k), Math.Min(content, maxScroll));

        int height = scroller.Bottom + (int)(16 * k);
        Bounds = new Rectangle(area.Right - width - (int)(16 * k), area.Top + (int)(16 * k), width, height);
        using var path = Rounded(new Rectangle(0, 0, width, height), (int)(18 * k));
        Region = new Region(path);
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        float k = DeviceDpi / 96f;
        using var path = Rounded(new Rectangle(1, 1, Width - 3, Height - 3), (int)(18 * k));
        using var pen = new Pen(Palette.Berry2, 2.5f * k);
        e.Graphics.DrawPath(pen, path);
    }

    private static GraphicsPath Rounded(Rectangle r, int radius)
    {
        int d = radius * 2;
        var path = new GraphicsPath();
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }
}
