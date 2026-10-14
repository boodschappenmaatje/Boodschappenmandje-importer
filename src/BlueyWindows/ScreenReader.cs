using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices.WindowsRuntime;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;

namespace Bluey;

/// One thing on screen he can point at: a line of text or a single word.
public sealed record Target(string Id, string Text, Box Rect);

/// What he saw on his last look. Mirrors ScreenSnapshot in ScreenReader.swift.
public sealed class ScreenSnapshot
{
    public required byte[] Jpeg;
    /// The front window's clickable controls.
    public List<ScreenControl> Controls = new();
    public required List<(Target Line, List<Target> Words)> Lines;
    /// The primary screen's size in points.
    public required (double Width, double Height) Size;

    public Target? FindTarget(string id)
    {
        id = id.Trim().ToUpperInvariant();
        if (Controls.FirstOrDefault(c => c.Id == id) is { } control) return AsTarget(control);
        foreach (var (line, words) in Lines)
        {
            if (line.Id == id) return line;
            if (words.FirstOrDefault(w => w.Id == id) is { } word) return word;
        }
        return null;
    }

    /// What's under (or right next to) a point: the smallest word or line there.
    public Target? TargetNear(Pt point)
    {
        var candidates = Controls.Select(AsTarget).Concat(Lines.SelectMany(e => e.Words.Prepend(e.Line))).ToList();
        var hit = candidates
            .Where(t => point.X >= t.Rect.X - 6 && point.X <= t.Rect.X + t.Rect.Width + 6
                     && point.Y >= t.Rect.Y - 6 && point.Y <= t.Rect.MaxY + 6)
            .MinBy(t => t.Rect.Width * t.Rect.Height);
        if (hit != null) return hit;
        double Distance(Box r) => Math.Sqrt(
            Math.Pow(Math.Max(Math.Max(r.X - point.X, 0), point.X - (r.X + r.Width)), 2) +
            Math.Pow(Math.Max(Math.Max(r.Y - point.Y, 0), point.Y - r.MaxY), 2));
        return candidates.Where(t => Distance(t.Rect) < 60).MinBy(t => Distance(t.Rect));
    }

    private static Target AsTarget(ScreenControl c) => new(c.Id, c.Label.Length == 0 ? c.Kind : c.Label, c.Rect);

    /// The list he picks from. Coordinates are on a 0–1000 grid so he can relate them to the image.
    public string TargetList
    {
        get
        {
            string Grid(Box r) => $"@{(int)(r.MidX / Size.Width * 1000)},{(int)(r.MidY / Size.Height * 1000)}";
            var output = new List<string>();
            if (ScreenReader.FrontmostApp() is { } app) output.Add("Frontmost window: " + app);
            if (Controls.Count > 0)
            {
                output.Add("Controls (click these by id):");
                output.AddRange(Controls.Select(c => $"{c.Id} {c.Kind} {Grid(c.Rect)}" + (c.Label.Length == 0 ? "" : $" \"{c.Label}\"")));
            }
            output.Add("Text on screen (L = line, W = word, @x,y on a 0-1000 grid):");
            if (Lines.Count == 0) output.Add("(no text found)");
            foreach (var (line, words) in Lines)
            {
                var wordList = words.Count > 1 ? " | " + string.Join(" ", words.Select(w => $"{w.Id}={w.Text}")) : "";
                output.Add($"{line.Id} {Grid(line.Rect)} \"{line.Text}\"{wordList}");
            }
            return string.Join("\n", output);
        }
    }
}

/// Captures the primary screen (without Bluey's own cursor and bubbles) and reads every word with its box,
/// using the OCR built into Windows. Takes the place of ScreenReader.swift (ScreenCaptureKit + Vision).
public static class ScreenReader
{
    public static async Task<ScreenSnapshot> Snapshot()
    {
        var bounds = System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? throw new InvalidOperationException("No screen found.");
        double scale = Native.ScaleFor(bounds);
        using var shot = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(shot))
            // A plain copy leaves out layered windows, so his own cursor and bubbles don't show up in it.
            g.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);

        var size = (bounds.Width / scale, bounds.Height / scale);
        // Read the front window's controls at the same time as the text.
        var controls = ControlsReader.Read();
        var lines = await Recognize(shot, scale);
        return new ScreenSnapshot { Jpeg = Jpeg(shot, 1100), Lines = lines, Size = size, Controls = await controls };
    }

    private static async Task<List<(Target, List<Target>)>> Recognize(Bitmap shot, double scale)
    {
        var engine = OcrEngine.TryCreateFromUserProfileLanguages()
                     ?? OcrEngine.TryCreateFromLanguage(new Windows.Globalization.Language("en-US"))
                     ?? throw new InvalidOperationException("Windows has no text recognition (OCR) language installed.");

        // OCR has a size limit; shrink big screens and scale the boxes back up.
        double shrink = Math.Min(1, (double)OcrEngine.MaxImageDimension / Math.Max(shot.Width, shot.Height));
        using var input = shrink < 1 ? Resize(shot, shrink) : new Bitmap(shot);
        var software = await ToSoftwareBitmap(input);
        var result = await engine.RecognizeAsync(software);

        // From OCR pixels to points on the screen.
        double toPoints = 1 / (shrink * scale);
        Box ToBox(Windows.Foundation.Rect r) => new(r.X * toPoints, r.Y * toPoints, r.Width * toPoints, r.Height * toPoints);

        var ocrLines = result.Lines
            .Where(l => l.Words.Count > 0)
            .Select(l => (Line: l, Box: Union(l.Words.Select(w => ToBox(w.BoundingRect)))))
            // Reading order: top to bottom, then left to right.
            .OrderBy(l => Math.Round(l.Box.Y / 8))
            .ThenBy(l => l.Box.X)
            .Take(400)
            .ToList();

        var lines = new List<(Target, List<Target>)>();
        int wordCount = 0;
        for (int i = 0; i < ocrLines.Count; i++)
        {
            var (ocrLine, box) = ocrLines[i];
            var line = new Target($"L{i + 1}", ocrLine.Text, box);
            var words = new List<Target>();
            if (wordCount < 600)
            {
                foreach (var word in ocrLine.Words)
                {
                    wordCount++;
                    words.Add(new Target($"W{wordCount}", word.Text, ToBox(word.BoundingRect)));
                }
            }
            lines.Add((line, words));
        }
        return lines;
    }

    private static Box Union(IEnumerable<Box> boxes)
    {
        double minX = double.MaxValue, minY = double.MaxValue, maxX = double.MinValue, maxY = double.MinValue;
        foreach (var b in boxes)
        {
            minX = Math.Min(minX, b.X); minY = Math.Min(minY, b.Y);
            maxX = Math.Max(maxX, b.X + b.Width); maxY = Math.Max(maxY, b.MaxY);
        }
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }

    private static async Task<SoftwareBitmap> ToSoftwareBitmap(Bitmap bitmap)
    {
        using var stream = new MemoryStream();
        bitmap.Save(stream, ImageFormat.Bmp);
        stream.Position = 0;
        var decoder = await BitmapDecoder.CreateAsync(stream.AsRandomAccessStream());
        return await decoder.GetSoftwareBitmapAsync(BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
    }

    private static Bitmap Resize(Bitmap source, double factor)
    {
        var resized = new Bitmap(Math.Max(1, (int)(source.Width * factor)), Math.Max(1, (int)(source.Height * factor)), PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(resized);
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.DrawImage(source, 0, 0, resized.Width, resized.Height);
        return resized;
    }

    private static byte[] Jpeg(Bitmap shot, int maxEdge)
    {
        double factor = Math.Min(1, (double)maxEdge / Math.Max(shot.Width, shot.Height));
        using var small = Resize(shot, factor);
        var codec = ImageCodecInfo.GetImageEncoders().First(c => c.FormatID == ImageFormat.Jpeg.Guid);
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 72L);
        using var stream = new MemoryStream();
        small.Save(stream, codec, parameters);
        return stream.ToArray();
    }

    /// The title of the window in front (the closest Windows has to the Mac's frontmost app).
    public static string? FrontmostApp()
    {
        var hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;
        var text = new System.Text.StringBuilder(256);
        return GetWindowText(hwnd, text, text.Capacity) > 0 ? text.ToString() : null;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
