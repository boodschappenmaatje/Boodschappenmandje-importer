using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;

namespace Bluey;

/// Blueberry colors from the design canvas. Mirrors Shared/Palette.swift.
public static class Palette
{
    public static readonly Color Berry1 = Color.FromArgb(0xA9, 0xBC, 0xFF);  // light periwinkle
    public static readonly Color Berry2 = Color.FromArgb(0x6C, 0x86, 0xF5);
    public static readonly Color Berry3 = Color.FromArgb(0x42, 0x54, 0xD6);
    public static readonly Color Berry4 = Color.FromArgb(0x2B, 0x2F, 0x8F);  // deep indigo
    public static readonly Color Ink = Color.FromArgb(0x17, 0x15, 0x1F);
    public static readonly Color[] Gradient = { Berry1, Berry2, Berry3, Berry4 };
    public static readonly float[] GradientStops = { 0, 0.34f, 0.68f, 1 };

    public static Color WithAlpha(this Color c, double alpha) => Color.FromArgb((int)Math.Clamp(alpha * 255, 0, 255), c);
}

/// The bundled Fredoka font for his speech bubble (falls back to Segoe UI).
public static class Fonts
{
    private static readonly PrivateFontCollection collection = new();
    private static FontFamily? family;

    public static void RegisterBundled()
    {
        try
        {
            using var stream = typeof(Fonts).Assembly.GetManifestResourceStream("Fredoka.ttf");
            if (stream == null) return;
            var data = new byte[stream.Length];
            stream.ReadExactly(data);
            var ptr = Marshal.AllocCoTaskMem(data.Length);
            Marshal.Copy(data, 0, ptr, data.Length);
            collection.AddMemoryFont(ptr, data.Length);  // the collection keeps using this memory
            family = collection.Families.FirstOrDefault();
        }
        catch (Exception) { }
    }

    public static Font Display(float pixels) =>
        new(family ?? new FontFamily("Segoe UI"), pixels, family != null ? FontStyle.Regular : FontStyle.Bold, GraphicsUnit.Pixel);
}

/// The cursor's teardrop: a square with three fully rounded corners and one sharp one (the tip) at the origin. y down.
public static class Teardrop
{
    public static GraphicsPath Path(float s, float tipRadius)
    {
        var path = new GraphicsPath();
        float big = s / 2, r = tipRadius;
        path.AddLine(r, 0, big, 0);
        path.AddArc(0, 0, s, s, 270, 90);    // top right
        path.AddArc(0, 0, s, s, 0, 90);      // bottom right
        path.AddArc(0, 0, s, s, 90, 90);     // bottom left
        path.AddLine(0, big, 0, r);
        path.AddArc(0, 0, r * 2, r * 2, 180, 90);  // the tip
        path.CloseFigure();
        return path;
    }

    /// Draws the cursor body with its tip at (0, 0): gradient, shine, white rim and a soft glow.
    public static void Draw(Graphics g, float s, bool glow)
    {
        float k = s / 96;
        using var path = Path(s, 6 * k);

        // A soft glow or shadow: the outline drawn a few times, wider and fainter each time.
        var glowColor = glow ? Palette.Berry2 : Palette.Berry4;
        int rings = glow ? 10 : 6;
        double strength = glow ? 0.07 : 0.05;
        for (int i = rings; i >= 1; i--)
        {
            using var pen = new Pen(glowColor.WithAlpha(strength), i * 3.2f * k) { LineJoin = LineJoin.Round };
            g.DrawPath(pen, path);
        }

        using (var fill = new LinearGradientBrush(new PointF(0.25f * s, 0.067f * s), new PointF(0.75f * s, 0.933f * s), Palette.Berry1, Palette.Berry4))
        {
            fill.InterpolationColors = new ColorBlend { Colors = Palette.Gradient, Positions = Palette.GradientStops };
            fill.WrapMode = WrapMode.TileFlipXY;
            g.FillPath(fill, path);
        }

        var state = g.Save();
        g.SetClip(path);
        using (var shinePath = new GraphicsPath())
        {
            float cx = 0.3f * s, cy = 0.24f * s, rr = 0.38f * s;
            shinePath.AddEllipse(cx - rr, cy - rr, rr * 2, rr * 2);
            using var shine = new PathGradientBrush(shinePath)
            {
                CenterColor = Color.White.WithAlpha(0.55),
                SurroundColors = new[] { Color.FromArgb(0, Color.White) },
                CenterPoint = new PointF(cx, cy),
            };
            g.FillPath(shine, shinePath);
        }
        using (var rim = new Pen(Color.White, 8 * k))  // half is clipped away, leaving a 4 pt rim
            g.DrawPath(rim, path);
        g.Restore(state);
    }

    /// The little blueberry with eyes, for the tray icon.
    public static Icon TrayIcon()
    {
        using var bmp = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            var body = new RectangleF(1, 3, 30, 26);
            using (var brush = new LinearGradientBrush(body, Palette.Berry1, Palette.Berry4, 60f))
            {
                brush.InterpolationColors = new ColorBlend { Colors = Palette.Gradient, Positions = Palette.GradientStops };
                g.FillEllipse(brush, body);
            }
            g.FillEllipse(Brushes.White, 7, 10, 8.5f, 8.5f);
            g.FillEllipse(Brushes.White, 17, 10, 8.5f, 8.5f);
            using var ink = new SolidBrush(Palette.Ink);
            g.FillEllipse(ink, 9, 11.5f, 4.5f, 4.5f);
            g.FillEllipse(ink, 19, 11.5f, 4.5f, 4.5f);
        }
        return Icon.FromHandle(bmp.GetHicon());
    }
}
