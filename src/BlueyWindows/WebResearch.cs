using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Bluey;

/// A short researched answer: a title, up to four paragraphs, and where it came from.
public sealed class ResearchReport
{
    public required string Question;
    public required string Title;
    public required List<string> Paragraphs;
    public required List<(string Title, string Url)> Sources;

    /// Plain text, for him (and the phone's saved transcript).
    public string PlainText => string.Join("\n\n", Paragraphs.Prepend(Title));
}

/// Looks things up on the web: Gemini with Google Search, or OpenAI with its web search tool,
/// whichever runs his brain. Mirrors WebResearch.swift.
public static class WebResearch
{
    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(90) };

    private static string Instructions => AppSettings.Shared.Language == "nl"
        ? "Zoek de vraag op internet uit en schrijf een kort, vriendelijk verslag in het Nederlands voor iemand die het druk heeft. " +
          "Eerste regel: een gewone titel van minder dan acht woorden. Daarna één tot vier korte alinea's (hooguit vier), " +
          "met eerst het directe antwoord en dan de nuttigste details. Alleen platte tekst: geen markdown, geen kopjes, " +
          "geen opsommingen en geen links of bronvermeldingen in de tekst."
        : "Research the question on the web and write a short, friendly report for a busy person. " +
          "First line: a plain title of under eight words. Then one to four short paragraphs (four at most), " +
          "leading with the direct answer, then the most useful details. Plain text only: no markdown, " +
          "no headings, no bullet lists, and no links or citations in the text.";

    public static async Task<ResearchReport> Research(string question, string? context)
    {
        var input = question;
        if (!string.IsNullOrEmpty(context)) input += "\n\nWhat's on the user's screen, for context: " + context;
        var (text, sources) = AppSettings.Shared.Provider == "openai" ? await OpenAI(input) : await Gemini(input);

        // Drop inline citations like "([site.com](https://…))" and any stray markdown.
        text = Regex.Replace(text, @"\s*\(\[[^\]]*\]\([^)]*\)\)", "");
        text = Regex.Replace(text, @"\[([^\]]*)\]\([^)]*\)", "$1");
        text = Regex.Replace(text, @"\s*\[https?://[^\]]*\]", "");
        text = text.Replace("**", "").Replace("#", "");
        var blocks = text.Split('\n').Select(b => b.Trim()).Where(b => b.Length > 0).ToList();
        if (blocks.Count == 0) throw new InvalidOperationException("The research came back empty.");
        return new ResearchReport
        {
            Question = question,
            Title = blocks[0],
            Paragraphs = blocks.Skip(1).Take(4).ToList(),
            Sources = sources.Take(5).ToList(),
        };
    }

    /// Gemini with Grounding with Google Search (5,000 free searches a month at the time of writing).
    private static async Task<(string, List<(string, string)>)> Gemini(string input)
    {
        var key = ApiKeys.Get(ApiKeys.Gemini)
            ?? throw new InvalidOperationException("I need a Gemini API key for research. Add one under AI → Gemini Key.");
        var body = new JsonObject
        {
            ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = Instructions }) },
            ["contents"] = new JsonArray(new JsonObject
            {
                ["role"] = "user",
                ["parts"] = new JsonArray(new JsonObject { ["text"] = input }),
            }),
            ["tools"] = new JsonArray(new JsonObject { ["google_search"] = new JsonObject() }),
        };
        var model = AppSettings.Shared.ResearchModel;
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-goog-api-key", key);
        var json = await Post(request);

        var text = new StringBuilder();
        var sources = new List<(string, string)>();
        var candidate = json["candidates"]?[0];
        foreach (var part in candidate?["content"]?["parts"]?.AsArray() ?? new JsonArray())
        {
            if (part?["thought"]?.GetValue<bool>() == true) continue;
            text.Append(part?["text"]?.GetValue<string>() ?? "");
        }
        foreach (var chunk in candidate?["groundingMetadata"]?["groundingChunks"]?.AsArray() ?? new JsonArray())
        {
            var url = chunk?["web"]?["uri"]?.GetValue<string>();
            if (url == null || sources.Any(s => s.Item2 == url)) continue;
            sources.Add((chunk?["web"]?["title"]?.GetValue<string>() ?? url, url));
        }
        return (text.ToString(), sources);
    }

    /// OpenAI's Responses API with its web search tool, like the Mac.
    private static async Task<(string, List<(string, string)>)> OpenAI(string input)
    {
        var key = ApiKeys.Get(ApiKeys.OpenAI)
            ?? throw new InvalidOperationException("I need an OpenAI API key for research. Add one under AI → OpenAI Key.");
        var body = new JsonObject
        {
            ["model"] = "gpt-5.5",
            ["reasoning"] = new JsonObject { ["effort"] = "low" },
            ["tools"] = new JsonArray(new JsonObject { ["type"] = "web_search" }),
            ["instructions"] = Instructions,
            ["input"] = input,
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        var json = await Post(request);

        var text = new StringBuilder();
        var sources = new List<(string, string)>();
        foreach (var item in json["output"]?.AsArray() ?? new JsonArray())
        {
            if (item?["type"]?.GetValue<string>() != "message") continue;
            foreach (var part in item["content"]?.AsArray() ?? new JsonArray())
            {
                text.Append(part?["text"]?.GetValue<string>() ?? "");
                foreach (var note in part?["annotations"]?.AsArray() ?? new JsonArray())
                {
                    var url = note?["url"]?.GetValue<string>();
                    if (url == null) continue;
                    url = Regex.Replace(url, @"[?&]utm_source=[^&]*$", "");
                    if (sources.Any(s => s.Item2 == url)) continue;
                    sources.Add((note?["title"]?.GetValue<string>() ?? url, url));
                }
            }
        }
        return (text.ToString(), sources);
    }

    private static async Task<JsonNode> Post(HttpRequestMessage request)
    {
        using var response = await http.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        if (response.IsSuccessStatusCode)
        {
            try
            {
                if (JsonNode.Parse(text) is { } json) return json;
            }
            catch (JsonException) { }
        }
        var why = $"{(int)response.StatusCode} {text}";
        throw new InvalidOperationException("The research didn't come back: " + why[..Math.Min(200, why.Length)]);
    }
}
