using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Bluey;

/// The PC's half of live voice. The phone runs the OpenAI Realtime session (its mic, its speaker);
/// the PC hands it a short-lived key, runs its tools and shows captions. Everything runs on the UI thread.
/// Mirrors Mac/Sources/GooglyMac/RealtimeHost.swift. Step 1: no screen tools yet (looking, pointing at
/// things and using the computer come in later steps).
public sealed class RealtimeHost
{
    public const string Model = "gpt-realtime-2.1";

    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private readonly CursorOverlay overlay;
    private readonly System.Windows.Forms.Timer captionTimer = new();
    private Action? captionTimerAction;

    /// True while he's awake and talking with you (false = follow mode).
    public bool Awake { get; private set; }
    public Action? OnChange;

    public RealtimeHost(CursorOverlay overlay)
    {
        this.overlay = overlay;
        captionTimer.Tick += (_, _) =>
        {
            captionTimer.Stop();
            var action = captionTimerAction;
            captionTimerAction = null;
            action?.Invoke();
        };
    }

    private CursorEngine Engine => overlay.Engine;

    /// Handles a request from the phone. `reply` sends a packet back to that phone.
    public async void Handle(Packet packet, Action<Packet> reply)
    {
        switch (packet.Command)
        {
            case "realtimeToken":
                try
                {
                    var token = await MintToken();
                    reply(new Packet { Command = "realtimeToken", CallID = packet.CallID, Text = token });
                }
                catch (Exception error)
                {
                    reply(new Packet { Command = "realtimeToken", CallID = packet.CallID });
                    ShowCaption(error.Message, 6);
                }
                break;
            case "transcribe":
                // Meeting notes come in a later step; answer so the phone doesn't wait.
                reply(new Packet { Command = "transcribed", CallID = packet.CallID });
                break;
            case "notes":
                reply(new Packet { Command = "notes", CallID = packet.CallID });
                break;
            case "awake":
                SetAwake(true);
                break;
            case "asleep":
                SetAwake(false);
                break;
            case "caption":
            {
                // His reply, streaming in. It shows as a speech bubble above the phone.
                var text = packet.Text?.Trim() ?? "";
                ShowCaption(text.Length == 0 ? null : text, 0);
                break;
            }
            case "captionDone":
            {
                // Keep the bubble up long enough to read, then tidy away.
                var text = packet.Text ?? "";
                if (text.Length > 0) ShowCaption(text, 0);
                double words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
                double readTime = Math.Min(Math.Max(2.8, 1.2 + words * 0.32), 12) + 3;
                After(readTime, () => ShowCaption(null, 0));
                break;
            }
            case "tool":
            {
                var result = RunTool(packet.Tool ?? "");
                reply(new Packet { Command = "toolResult", CallID = packet.CallID, Text = result });
                break;
            }
        }
    }

    public void SetAwake(bool on)
    {
        Awake = on;
        Engine.Awake = on;
        Engine.BrainMood = null;
        Engine.GazeOverride = null;  // his eyes follow your mouse while he listens
        if (!on)
        {
            overlay.GoHome();
            overlay.SpeechTarget = null;
            ShowCaption(null, 0);
        }
        OnChange?.Invoke();
    }

    // MARK: Tools

    private static JsonObject Tool(string name, string description) => new()
    {
        ["type"] = "function",
        ["name"] = name,
        ["description"] = description,
        ["parameters"] = new JsonObject { ["type"] = "object", ["properties"] = new JsonObject(), ["required"] = new JsonArray() },
    };

    /// Tool definitions for the session. Only what works on Windows so far.
    private static JsonArray Tools => new()
    {
        Tool("stop_pointing", "Bring your cursor back home when you're done pointing."),
        Tool("go_to_sleep",
             "Go back to quietly following the user's mouse with your eyes. Use when the user says bye, thanks that's all, or asks you to sleep."),
    };

    private string RunTool(string name)
    {
        switch (name)
        {
            case "stop_pointing":
                overlay.GoHome();
                overlay.SpeechTarget = null;
                return "Your cursor is home.";
            case "go_to_sleep":
                // The phone closes the session after this call; the PC just tidies up.
                return "Going to sleep. Say a very short goodbye.";
            case "look_at_screen":
                return "You can't see the user's screen on this Windows PC yet. Tell them in a few words.";
            default:
                return $"{name} isn't available on this Windows PC yet. Tell the user in a few words.";
        }
    }

    // MARK: Captions

    private void ShowCaption(string? text, double seconds)
    {
        captionTimer.Stop();
        captionTimerAction = null;
        overlay.Caption = text;
        if (text != null && seconds > 0) After(seconds, () => overlay.Caption = null);
    }

    private void After(double seconds, Action action)
    {
        captionTimer.Stop();
        captionTimerAction = action;
        captionTimer.Interval = Math.Max(1, (int)(seconds * 1000));
        captionTimer.Start();
    }

    // MARK: Token

    /// Who he is. Editable from the tray menu (Personality…).
    public const string DefaultPersonality =
        "You are a small blueberry with big googly eyes who lives on an iPhone under the user's screen and has your own " +
        "cursor. You're a young British guy: dry, quick-witted, a bit cheeky, British phrasing. You never speak out loud: " +
        "your replies pop up as a tiny speech bubble, so keep them to one short line, under fifteen words. Answer " +
        "immediately with the actual answer. Never announce what you're going to do, never recap, never offer more help.";

    public static string Personality
    {
        get
        {
            var saved = AppSettings.Shared.Personality.Trim();
            return saved.Length == 0 ? DefaultPersonality : saved;
        }
        set => AppSettings.Shared.Personality = value;
    }

    /// How the conversation works. Always included, whatever the personality says.
    private const string ToolGuide =
        "How the conversation works: the user's microphone is on the whole time, so you overhear everything they say. " +
        "Treat all of that as background context and stay silent. You only reply when the app asks you to respond, which " +
        "happens when the user holds the phone screen to ask you something. Their most recent words are the question; " +
        "use the earlier talk as context.\n\n" +
        "Reply in one short line. No lists, no markdown. Never write things like \"one moment\", \"sure\", \"okay\" or \"let me\".\n\n" +
        "You live next to a Windows PC. For now you can't see its screen, point at things on it or use it; if the user asks, " +
        "say so in a few words. When the user says goodbye or asks you to sleep, reply with a very short goodbye and call go_to_sleep.";

    private static JsonObject Session => new()
    {
        ["type"] = "realtime",
        ["model"] = Model,
        ["instructions"] = Personality + "\n\n" + ToolGuide,
        // He never talks out loud: replies are text, shown as speech bubbles.
        ["output_modalities"] = new JsonArray("text"),
        ["audio"] = new JsonObject
        {
            ["input"] = new JsonObject
            {
                ["format"] = new JsonObject { ["type"] = "audio/pcm", ["rate"] = 24000 },
                // Everything the user says is transcribed into the conversation as context, but he only
                // answers when the phone asks for a response (while you hold the screen).
                ["turn_detection"] = new JsonObject
                {
                    ["type"] = "server_vad", ["threshold"] = 0.5, ["prefix_padding_ms"] = 300,
                    ["silence_duration_ms"] = 500, ["create_response"] = false, ["interrupt_response"] = false,
                },
                ["noise_reduction"] = new JsonObject { ["type"] = "near_field" },
                ["transcription"] = new JsonObject { ["model"] = "gpt-4o-mini-transcribe" },
            },
        },
        ["tools"] = Tools,
        ["tool_choice"] = "auto",
    };

    /// A short-lived key for the phone, so the real key never leaves the PC.
    public static async Task<string> MintToken()
    {
        var key = ApiKeys.Get(ApiKeys.OpenAI)
            ?? throw new InvalidOperationException("I need an OpenAI API key. Add one under OpenAI Key in the tray menu.");
        var body = new JsonObject
        {
            ["expires_after"] = new JsonObject { ["anchor"] = "created_at", ["seconds"] = 600 },
            ["session"] = Session,
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/realtime/client_secrets")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        using var response = await http.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        if (response.IsSuccessStatusCode)
        {
            try
            {
                if (JsonNode.Parse(text)?["value"]?.GetValue<string>() is { } value) return value;
            }
            catch (JsonException) { }
        }
        var why = $"{(int)response.StatusCode} {text}";
        throw new InvalidOperationException("OpenAI wouldn't start a voice session: " + why[..Math.Min(160, why.Length)]);
    }
}
