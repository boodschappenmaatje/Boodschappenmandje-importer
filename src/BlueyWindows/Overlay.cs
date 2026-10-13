using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Runtime.InteropServices;

namespace Bluey;

/// A borderless, click-through, always-on-top window that shows a picture with per-pixel transparency.
public sealed class LayeredWindow : Form
{
    public LayeredWindow()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        StartPosition = FormStartPosition.Manual;
        TopMost = true;
    }

    protected override bool ShowWithoutActivation => true;

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        // Keep his own cursor and bubbles out of screenshots, so he never "sees" himself.
        try { Native.SetWindowDisplayAffinity(Handle, Native.WDA_EXCLUDEFROMCAPTURE); } catch (Exception) { }
    }

    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            cp.ExStyle |= Native.WS_EX_LAYERED | Native.WS_EX_TRANSPARENT | Native.WS_EX_TOPMOST
                        | Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE;
            return cp;
        }
    }

    /// Shows `bitmap` (32-bit ARGB) with its top-left at `location` (physical pixels).
    public void Present(Bitmap bitmap, Point location, double opacity)
    {
        if (!IsHandleCreated) CreateHandle();
        IntPtr screenDc = Native.GetDC(IntPtr.Zero);
        IntPtr memDc = Native.CreateCompatibleDC(screenDc);
        IntPtr hBitmap = bitmap.GetHbitmap(Color.FromArgb(0));
        IntPtr old = Native.SelectObject(memDc, hBitmap);
        try
        {
            var size = new Native.SIZE(bitmap.Width, bitmap.Height);
            var source = new Native.POINT(0, 0);
            var topLeft = new Native.POINT(location.X, location.Y);
            var blend = new Native.BLENDFUNCTION
            {
                BlendOp = Native.AC_SRC_OVER,
                SourceConstantAlpha = (byte)Math.Clamp(opacity * 255, 0, 255),
                AlphaFormat = Native.AC_SRC_ALPHA,
            };
            Native.UpdateLayeredWindow(Handle, screenDc, ref topLeft, ref size, memDc, ref source, 0, ref blend, Native.ULW_ALPHA);
        }
        finally
        {
            Native.SelectObject(memDc, old);
            Native.DeleteObject(hBitmap);
            Native.DeleteDC(memDc);
            Native.ReleaseDC(IntPtr.Zero, screenDc);
        }
        if (!Native.IsWindowVisible(Handle)) Native.ShowWindow(Handle, Native.SW_SHOWNOACTIVATE);
        // Stay above other always-on-top windows that came along later.
        Native.SetWindowPos(Handle, Native.HWND_TOPMOST, 0, 0, 0, 0, Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
    }

    public void Conceal()
    {
        if (IsHandleCreated && Native.IsWindowVisible(Handle)) Native.ShowWindow(Handle, Native.SW_HIDE);
    }
}

/// The big character cursor and his speech bubble, drawn on top of everything on the primary screen.
/// Takes the place of CursorView + CursorOverlay in CursorOverlay.swift.
public sealed class CursorOverlay : IDisposable
{
    public readonly CursorEngine Engine = new();
    private readonly LayeredWindow cursorWindow = new();
    private readonly LayeredWindow speechWindow = new();
    private readonly System.Windows.Forms.Timer timer = new() { Interval = 15 };
    private double lastTime;
    private Pt look = new(-0.7, -0.7);

    /// Called every frame with the face the phone should show.
    public Action<FaceState>? OnFace;
    /// Called every frame after the cursor moved (for the pointing choreography).
    public Action<double>? OnFrame;

    /// The thing he's pointing at (screen points), so his bubble sits above it instead of covering it.
    public Box? SpeechTarget;

    private string? caption;
    private double captionBorn, captionGone = -10;
    private Bitmap? speechArt;
    private (float Width, float Height) speechSize;

    /// What he's saying, shown in his speech bubble.
    public string? Caption
    {
        get => caption;
        set
        {
            if (value == caption) return;
            bool appearing = string.IsNullOrEmpty(caption);
            caption = value;
            if (string.IsNullOrEmpty(value)) { captionGone = Clock.Now; return; }
            if (appearing) captionBorn = Clock.Now;
            LayoutCaption();
        }
    }

    public CursorMode Mode
    {
        get => Engine.Mode;
        set => Engine.SetMode(value);
    }

    /// Where the cursor rests when nobody is pointing: tucked away with eyes on your mouse, or parked above the phone.
    public CursorMode IdleMode => AppSettings.Shared.FollowMouse ? CursorMode.Follow : CursorMode.Dock;

    public void GoHome() => Mode = IdleMode;

    public void Start()
    {
        Mode = IdleMode;
        timer.Tick += (_, _) => Tick();
        timer.Start();
    }

    public void TalkTest(double seconds = 3) => Engine.TalkUntil = Clock.Now + seconds;

    // MARK: Screen geometry

    /// The primary screen, in physical pixels, and how many pixels make one point there.
    private static (Rectangle Pixels, double Scale) Screen()
    {
        var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1440, 900);
        return (bounds, Native.ScaleFor(bounds));
    }

    /// The primary screen's size in points (what the engine works in).
    public static (double Width, double Height) ScreenSize
    {
        get
        {
            var (px, scale) = Screen();
            return (px.Width / scale, px.Height / scale);
        }
    }

    /// Your mouse, in points from the primary screen's top-left.
    public static Pt MouseLocation
    {
        get
        {
            var (px, scale) = Screen();
            var m = Cursor.Position;
            return new((m.X - px.X) / scale, (m.Y - px.Y) / scale);
        }
    }

    // MARK: Frame

    private void Tick()
    {
        double now = Clock.Now;
        double dt = lastTime == 0 ? 1.0 / 60 : Math.Clamp(now - lastTime, 1.0 / 480, 1.0 / 20);
        lastTime = now;
        var (px, scale) = Screen();
        var bounds = (px.Width / scale, px.Height / scale);
        Engine.Step(dt, now, MouseLocation, bounds);
        OnFrame?.Invoke(now);
        try
        {
            RenderCursor(now, dt, px, scale);
            RenderSpeech(now, px, scale, bounds);
        }
        catch (Exception) { }  // a frame that fails to draw (e.g. while the screen changes) is just skipped
        OnFace?.Invoke(Engine.Face(bounds, now));
    }

    private void RenderCursor(double now, double dt, Rectangle px, double scale)
    {
        double opacity = AppSettings.Shared.ShowCursor ? Engine.Opacity : 0;
        if (opacity < 0.01) { cursorWindow.Conceal(); return; }

        // Its eyes look where it's heading, and back at the tip when it stops.
        var v = Engine.Velocity;
        var wantLook = new Pt(-0.7, -0.7);
        if (v.Length > 90)
        {
            double a = -Engine.Angle;
            var local = new Pt(v.X * Math.Cos(a) - v.Y * Math.Sin(a), v.X * Math.Sin(a) + v.Y * Math.Cos(a));
            double n = Math.Max(local.Length, 1);
            wantLook = new Pt(local.X / n, local.Y / n);
        }
        double follow = Math.Min(1, dt * 12);
        look = look + (wantLook - look) * follow;
        bool blinking = now < Engine.BlinkUntil;

        float s = (float)(Engine.Size * scale);
        float k = s / 96;
        // The tip sits in the middle of a square big enough for the body at any angle, plus its glow.
        int half = (int)Math.Ceiling(s * 1.45 + 34 * k);
        using var bmp = new Bitmap(half * 2, half * 2, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.TranslateTransform(half, half);
            float squish = (float)Engine.PressScale(now);
            g.ScaleTransform(squish, squish);
            g.RotateTransform((float)(Engine.Angle * 180 / Math.PI));
            Teardrop.Draw(g, s, AppSettings.Shared.Glow);

            using var ink = new SolidBrush(Palette.Ink);
            for (int i = 0; i < 2; i++)
            {
                float d = 18 * k;
                float x = (34 + i * 24) * k, y = 40 * k;
                float cy = y + d / 2, h = blinking ? d * 0.12f : d;
                g.FillEllipse(Brushes.White, x, cy - h / 2, d, h);
                if (blinking) continue;
                float p = 9 * k;
                float pcx = x + d / 2 + (float)look.X * 3.4f * k, pcy = cy + (float)look.Y * 3.4f * k;
                g.FillEllipse(ink, pcx - p / 2, pcy - p / 2, p, p);
            }
        }
        var tip = new Point(px.X + (int)Math.Round(Engine.Tip.X * scale), px.Y + (int)Math.Round((Engine.Tip.Y + Engine.Hover(now)) * scale));
        cursorWindow.Present(bmp, new Point(tip.X - half, tip.Y - half), opacity);
    }

    // MARK: Speech bubble

    private const float PadX = 24, PadY = 15, TailLength = 18;

    private void LayoutCaption()
    {
        if (string.IsNullOrEmpty(caption)) return;
        // Longer replies get a slightly smaller font and a wider bubble, so it never turns into a tower.
        int length = caption.Length;
        float fontSize = length <= 50 ? 21 : length <= 110 ? 19 : 17;
        var screen = ScreenSize;
        float maxWidth = (float)Math.Min(Math.Min(screen.Width * 0.5, 580), Math.Max(240, Math.Sqrt(length) * 50));
        using var font = Fonts.Display(fontSize);
        using var probe = new Bitmap(1, 1);
        using var g = Graphics.FromImage(probe);
        var size = g.MeasureString(caption, font, (int)maxWidth, CenteredText);
        speechSize = (Math.Max((float)Math.Ceiling(size.Width) + PadX * 2, 70), (float)Math.Ceiling(size.Height) + PadY * 2);
    }

    private static readonly StringFormat CenteredText = new() { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };

    /// Follows his cursor every frame: above the thing he's pointing at (or below his cursor when there's
    /// no room up there), otherwise just above the phone.
    private void RenderSpeech(double now, Rectangle px, double scale, (double Width, double Height) bounds)
    {
        double fadeOut = string.IsNullOrEmpty(caption) ? Math.Max(0, 1 - (now - captionGone) / 0.22) : 1;
        if (fadeOut <= 0 || speechSize.Width == 0) { speechWindow.Conceal(); return; }

        var (w, h) = speechSize;
        const double margin = 14;
        bool pointing = Engine.Opacity > 0.1 && !Engine.IsHome;
        Pt target, origin;  // where the tail points, and the bubble's top-left (points, y down)
        bool tailUp = false;
        var belowCursor = new Pt(Engine.Tip.X + Engine.Size * 0.5, Engine.Tip.Y + Engine.Size * 1.35);
        if (pointing)
        {
            var thing = SpeechTarget ?? new Box(Engine.Tip.X - 12, Engine.Tip.Y - 30, 24, 24);
            target = new Pt(thing.MidX, thing.MinY - 10);
            origin = new Pt(target.X - w / 2, target.Y - TailLength - h);
            if (origin.Y < margin)
            {
                target = belowCursor;
                origin = new Pt(target.X - w / 2, target.Y + TailLength);
                tailUp = true;
            }
        }
        else
        {
            target = new Pt(bounds.Width * AppSettings.Shared.PhonePosition, bounds.Height - Engine.Size * 0.9);
            origin = new Pt(target.X - w / 2, target.Y - TailLength - h);
        }
        origin = new Pt(Math.Clamp(origin.X, margin, Math.Max(margin, bounds.Width - w - margin)),
                        Math.Clamp(origin.Y, margin, Math.Max(margin, bounds.Height - h - margin)));
        double bob = Math.Sin((now - captionBorn) * 2.2) * 2;  // a gentle bob
        origin = new Pt(origin.X, origin.Y + bob);
        target = new Pt(target.X, target.Y + bob * 0.5);

        // Pops in with a little spring, shrinks away when done.
        double age = now - captionBorn;
        double pop = string.IsNullOrEmpty(caption)
            ? 0.85 + 0.15 * fadeOut
            : 1 - 0.45 * Math.Exp(-age * 9) * Math.Cos(age * 18);
        double alpha = string.IsNullOrEmpty(caption) ? fadeOut : Math.Min(1, age / 0.12);

        // The tail starts on the bottom (or top) edge, as close under the target as the corners allow, and leans toward it.
        float r = Math.Min(24, h / 2), halfTail = 13;
        float localX = (float)(target.X - origin.X);
        float baseX = Math.Clamp(localX, r + halfTail + 2, Math.Max(r + halfTail + 2, w - r - halfTail - 2));
        float lean = Math.Clamp(localX - baseX, -TailLength * 1.4f, TailLength * 1.4f);

        float k = (float)scale;
        int pad = (int)Math.Ceiling((TailLength + 8) * k);
        int bw = (int)Math.Ceiling(w * k) + pad * 2, bh = (int)Math.Ceiling(h * k) + pad * 2;
        if (speechArt == null || speechArt.Width != bw || speechArt.Height != bh)
        {
            speechArt?.Dispose();
            speechArt = new Bitmap(bw, bh, PixelFormat.Format32bppArgb);
        }
        using (var g = Graphics.FromImage(speechArt))
        {
            g.Clear(Color.Transparent);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            g.TranslateTransform(pad + w * k / 2, pad + h * k / 2);
            g.ScaleTransform((float)(k * pop), (float)(k * pop));
            g.TranslateTransform(-w / 2, -h / 2);

            using var path = BubblePath(w, h, r, halfTail, baseX, lean, tailUp);
            using (var fill = new LinearGradientBrush(new RectangleF(0, 0, w, h + 1), Color.White, Color.FromArgb(0xEE, 0xF0, 0xFF), 90f))
                g.FillPath(fill, path);
            using (var border = new Pen(Palette.Berry2, 2.5f) { LineJoin = LineJoin.Round })
                g.DrawPath(border, path);
            if (!string.IsNullOrEmpty(caption))
            {
                float fontSize = caption.Length <= 50 ? 21 : caption.Length <= 110 ? 19 : 17;
                using var font = Fonts.Display(fontSize);
                using var ink = new SolidBrush(Palette.Ink);
                g.DrawString(caption, font, ink, new RectangleF(PadX, PadY - 1, w - PadX * 2, h - PadY * 2 + 2), CenteredText);
            }
        }
        var location = new Point(px.X + (int)Math.Round(origin.X * scale) - pad, px.Y + (int)Math.Round(origin.Y * scale) - pad);
        speechWindow.Present(speechArt, location, alpha);
    }

    private static GraphicsPath BubblePath(float w, float h, float r, float half, float baseX, float lean, bool tailUp)
    {
        // y down: the tail hangs from the bottom edge, or sticks up from the top when the bubble sits below his cursor.
        float tipY = tailUp ? -TailLength : h + TailLength;
        var tip = new PointF(baseX + lean, tipY);
        var path = new GraphicsPath();
        path.AddArc(0, 0, r * 2, r * 2, 180, 90);  // top left
        if (tailUp)
        {
            path.AddLine(r, 0, baseX - half, 0);
            path.AddBezier(baseX - half, 0, baseX - half * 0.3f, 0, tip.X - 1, -TailLength * 0.5f, tip.X, tip.Y);
            path.AddBezier(tip.X, tip.Y, tip.X + 2, -TailLength * 0.45f, baseX + half * 0.4f, 0, baseX + half, 0);
        }
        path.AddArc(w - r * 2, 0, r * 2, r * 2, 270, 90);  // top right
        path.AddArc(w - r * 2, h - r * 2, r * 2, r * 2, 0, 90);  // bottom right
        if (!tailUp)
        {
            path.AddLine(w - r, h, baseX + half, h);
            path.AddBezier(baseX + half, h, baseX + half * 0.3f, h, tip.X + 1, h + TailLength * 0.5f, tip.X, tip.Y);
            path.AddBezier(tip.X, tip.Y, tip.X - 2, h + TailLength * 0.45f, baseX - half * 0.4f, h, baseX - half, h);
        }
        path.AddArc(0, h - r * 2, r * 2, r * 2, 90, 90);  // bottom left
        path.CloseFigure();
        return path;
    }

    public void Dispose()
    {
        timer.Dispose();
        cursorWindow.Dispose();
        speechWindow.Dispose();
        speechArt?.Dispose();
    }
}

internal static class Native
{
    public const int WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20, WS_EX_TOPMOST = 0x8,
                     WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x8000000;
    public const byte AC_SRC_OVER = 0, AC_SRC_ALPHA = 1;
    public const int ULW_ALPHA = 2;
    public const int SW_HIDE = 0, SW_SHOWNOACTIVATE = 4;
    public static readonly IntPtr HWND_TOPMOST = new(-1);
    public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }

    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE { public int CX, CY; public SIZE(int cx, int cy) { CX = cx; CY = cy; } }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize,
        IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr hDC);
    [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
    [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr hObject);
    public const uint WDA_EXCLUDEFROMCAPTURE = 0x11;
    [DllImport("user32.dll")] public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint affinity);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);

    [DllImport("user32.dll")] private static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
    [DllImport("shcore.dll")] private static extern int GetDpiForMonitor(IntPtr hmonitor, int dpiType, out uint dpiX, out uint dpiY);

    /// Physical pixels per point (1/96 inch) on the monitor that holds `bounds`.
    public static double ScaleFor(Rectangle bounds)
    {
        try
        {
            var monitor = MonitorFromPoint(new POINT(bounds.X + bounds.Width / 2, bounds.Y + bounds.Height / 2), 2);
            if (GetDpiForMonitor(monitor, 0, out uint dpi, out _) == 0 && dpi > 0) return dpi / 96.0;
        }
        catch (Exception) { }
        return 1;
    }
}
