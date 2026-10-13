using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Bluey;

/// Where Bluey keeps its files: %APPDATA%\Bluey.
public static class AppFolder
{
    public static string Path
    {
        get
        {
            var dir = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Bluey");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }
}

/// API keys live in %APPDATA%\Bluey\keys.json, encrypted with Windows (DPAPI) so only your
/// Windows account can read them. Never in the project folder or git.
public static class ApiKeys
{
    public const string OpenAI = "openai";
    public const string Gemini = "gemini";

    private static Dictionary<string, string>? cache;
    private static string FilePath => System.IO.Path.Combine(AppFolder.Path, "keys.json");

    private static Dictionary<string, string> Load()
    {
        if (cache != null) return cache;
        try { cache = JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(FilePath)); }
        catch (Exception) { }
        return cache ??= new();
    }

    public static string? Get(string key)
    {
        if (!Load().TryGetValue(key, out var stored)) return null;
        try
        {
            var plain = ProtectedData.Unprotect(Convert.FromBase64String(stored), null, DataProtectionScope.CurrentUser);
            var value = Encoding.UTF8.GetString(plain);
            return value.Length == 0 ? null : value;
        }
        catch (Exception) { return null; }
    }

    public static void Set(string key, string? value)
    {
        var all = Load();
        if (string.IsNullOrEmpty(value)) all.Remove(key);
        else all[key] = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(value), null, DataProtectionScope.CurrentUser));
        File.WriteAllText(FilePath, JsonSerializer.Serialize(all, new JsonSerializerOptions { WriteIndented = true }));
    }
}

/// Choices from the tray menu, kept between launches in %APPDATA%\Bluey\settings.json.
public sealed class AppSettings
{
    public static readonly AppSettings Shared = new();

    private readonly JsonObject values;
    private static string FilePath => System.IO.Path.Combine(AppFolder.Path, "settings.json");

    public event Action? Changed;

    private AppSettings()
    {
        try { values = JsonNode.Parse(File.ReadAllText(FilePath)) as JsonObject ?? new(); }
        catch (Exception) { values = new(); }
    }

    private T Get<T>(string key, T fallback)
    {
        try { return values[key] is { } node ? node.GetValue<T>() : fallback; }
        catch (Exception) { return fallback; }
    }

    private void Set<T>(string key, T value)
    {
        values[key] = JsonValue.Create(value);
        try { File.WriteAllText(FilePath, values.ToJsonString(new JsonSerializerOptions { WriteIndented = true })); }
        catch (Exception) { }
        Changed?.Invoke();
    }

    /// Cursor size in points (the design's default is 72).
    public double CursorSize { get => Get("cursorSize", 72.0); set => Set("cursorSize", value); }
    public bool Glow { get => Get("glow", false); set => Set("glow", value); }
    public bool ShowCursor { get => Get("showCursor", true); set => Set("showCursor", value); }
    /// Where the phone sits under the screen, 0 = left edge, 1 = right edge.
    public double PhonePosition { get => Get("phonePosition", 0.5); set => Set("phonePosition", value); }
    /// When idle, hide the big cursor and let the phone's eyes follow your own mouse.
    public bool FollowMouse { get => Get("followMouse", true); set => Set("followMouse", value); }
    /// The mood picked by hand in the menu.
    public Mood Mood
    {
        get => Enum.TryParse<Mood>(Get("mood", "Listening"), true, out var m) ? m : Mood.Listening;
        set => Set("mood", value.ToString());
    }
    /// Which AI runs his brain: "gemini" (free tier) or "openai".
    public string Provider
    {
        get => Get("provider", "gemini") == "openai" ? "openai" : "gemini";
        set => Set("provider", value);
    }
    /// The Gemini Live model. Kept as a setting so a renamed model needs no new app.
    public string GeminiModel { get => Get("geminiModel", "gemini-3.8-live"); set => Set("geminiModel", value); }
    /// The language he talks in: "nl" (Dutch, default) or "en".
    public string Language
    {
        get => Get("language", "nl") == "en" ? "en" : "nl";
        set => Set("language", value);
    }
    /// Who he is (empty = the built-in default).
    public string Personality { get => Get("personality", ""); set => Set("personality", value); }
}
