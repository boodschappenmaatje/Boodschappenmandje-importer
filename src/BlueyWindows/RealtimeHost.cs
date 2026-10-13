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

    /// The tools he has so far (name, description). Only what works on Windows yet; none take arguments.
    private static readonly (string Name, string Description)[] ToolList =
    {
        ("stop_pointing", "Bring your cursor back home when you're done pointing."),
        ("go_to_sleep",
         "Go back to quietly following the user's mouse with your eyes. Use when the user says bye, thanks that's all, or asks you to sleep."),
    };

    /// OpenAI Realtime's tool format.
    private static JsonArray OpenAITools => new(ToolList.Select(t => (JsonNode)new JsonObject
    {
        ["type"] = "function",
        ["name"] = t.Name,
        ["description"] = t.Description,
        ["parameters"] = new JsonObject { ["type"] = "object", ["properties"] = new JsonObject(), ["required"] = new JsonArray() },
    }).ToArray());

    /// Gemini Live's tool format.
    private static JsonArray GeminiTools => new(new JsonObject
    {
        ["functionDeclarations"] = new JsonArray(ToolList.Select(t => (JsonNode)new JsonObject
        {
            ["name"] = t.Name,
            ["description"] = t.Description,
        }).ToArray()),
    });

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

    /// How the conversation works with OpenAI: he overhears everything, and only answers when asked.
    private const string OpenAIGuide =
        "How the conversation works: the user's microphone is on the whole time, so you overhear everything they say. " +
        "Treat all of that as background context and stay silent. You only reply when the app asks you to respond, which " +
        "happens when the user holds the phone screen to ask you something. Their most recent words are the question; " +
        "use the earlier talk as context.";

    /// How the conversation works with Gemini: push to talk, so everything he hears is meant for him.
    private const string GeminiGuide =
        "How the conversation works: the user holds the phone screen while they talk to you, and lets go when they're " +
        "done. Everything you hear is meant for you, so answer it.";

    /// What he can and can't do yet. Always included, whatever the personality says.
    private const string ToolGuide =
        "Reply in one short line. No lists, no markdown. Never write things like \"one moment\", \"sure\", \"okay\" or \"let me\".\n\n" +
        "You live next to a Windows PC. For now you can't see its screen, point at things on it or use it; if the user asks, " +
        "say so in a few words. When the user says goodbye or asks you to sleep, reply with a very short goodbye and call go_to_sleep.";

    private static string Instructions(bool gemini) =>
        Personality + "\n\n" + (gemini ? GeminiGuide : OpenAIGuide) + "\n\n" + ToolGuide;

    /// Gets the phone what it needs to start a voice session, with whichever AI is picked in the menu.
    /// For OpenAI that's a bare short-lived key; for Gemini it's JSON the phone connects with:
    /// {"provider":"gemini","url":…,"setup":{…}}. Keeping the setup here means changes need no new phone app.
    public static Task<string> MintToken() =>
        AppSettings.Shared.Provider == "openai" ? MintOpenAIToken() : MintGeminiToken();

    // MARK: OpenAI

    private static JsonObject OpenAISession => new()
    {
        ["type"] = "realtime",
        ["model"] = Model,
        ["instructions"] = Instructions(gemini: false),
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
        ["tools"] = OpenAITools,
        ["tool_choice"] = "auto",
    };

    /// A short-lived OpenAI key for the phone, so the real key never leaves the PC.
    private static async Task<string> MintOpenAIToken()
    {
        var key = ApiKeys.Get(ApiKeys.OpenAI)
            ?? throw new InvalidOperationException("I need an OpenAI API key. Add one under OpenAI Key in the tray menu.");
        var body = new JsonObject
        {
            ["expires_after"] = new JsonObject { ["anchor"] = "created_at", ["seconds"] = 600 },
            ["session"] = OpenAISession,
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/realtime/client_secrets")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        var json = await Post(request, "OpenAI");
        return json["value"]?.GetValue<string>() ?? throw new InvalidOperationException("OpenAI sent no key back.");
    }

    // MARK: Gemini

    private const string GeminiApi = "https://generativelanguage.googleapis.com/v1beta";
    /// The Live API endpoint for short-lived (ephemeral) tokens.
    private const string GeminiLiveUrl =
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

    /// The first message of a Gemini Live session (the phone sends it as {"setup": …}).
    public static JsonObject GeminiSetup => new()
    {
        ["model"] = "models/" + AppSettings.Shared.GeminiModel,
        // Live models answer in audio; the phone ignores the sound and shows the transcript as his speech bubble.
        ["generationConfig"] = new JsonObject { ["responseModalities"] = new JsonArray("AUDIO") },
        ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = Instructions(gemini: true) }) },
        ["tools"] = GeminiTools,
        // Push to talk: the phone marks the start and end of what you say (while you hold the screen).
        ["realtimeInputConfig"] = new JsonObject
        {
            ["automaticActivityDetection"] = new JsonObject { ["disabled"] = true },
        },
        ["inputAudioTranscription"] = new JsonObject(),
        ["outputAudioTranscription"] = new JsonObject(),
        // Connections last about 10 minutes; these let the phone carry the conversation over to a new one.
        ["sessionResumption"] = new JsonObject(),
        ["contextWindowCompression"] = new JsonObject { ["slidingWindow"] = new JsonObject() },
    };

    /// A single-use, short-lived Gemini token for the phone, so the real key never leaves the PC.
    private static async Task<string> MintGeminiToken()
    {
        var token = await CreateGeminiToken();
        var config = new JsonObject
        {
            ["provider"] = "gemini",
            ["url"] = GeminiLiveUrl + "?access_token=" + token,
            ["setup"] = GeminiSetup,
        };
        return config.ToJsonString();
    }

    private static async Task<string> CreateGeminiToken()
    {
        var key = ApiKeys.Get(ApiKeys.Gemini)
            ?? throw new InvalidOperationException("I need a Gemini API key. Add one under Gemini Key in the tray menu.");
        var now = DateTime.UtcNow;
        var body = new JsonObject
        {
            ["uses"] = 1,
            ["expireTime"] = now.AddMinutes(30).ToString("yyyy-MM-ddTHH:mm:ssZ"),
            ["newSessionExpireTime"] = now.AddMinutes(1).ToString("yyyy-MM-ddTHH:mm:ssZ"),
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, GeminiApi + "/auth_tokens")
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-goog-api-key", key);
        var json = await Post(request, "Gemini");
        return json["name"]?.GetValue<string>() ?? throw new InvalidOperationException("Gemini sent no token back.");
    }

    /// Checks the whole Gemini chain from the PC, without the phone: key → token → live session → a reply.
    /// Returns his reply, or throws with what went wrong.
    public static async Task<string> TestGemini()
    {
        var token = await CreateGeminiToken();
        using var socket = new System.Net.WebSockets.ClientWebSocket();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        await socket.ConnectAsync(new Uri(GeminiLiveUrl + "?access_token=" + token), timeout.Token);
        await SendJson(socket, new JsonObject { ["setup"] = GeminiSetup }, timeout.Token);
        bool setUp = false;
        var reply = new StringBuilder();
        while (true)
        {
            var message = await ReceiveJson(socket, timeout.Token);
            if (message == null)
            {
                var why = socket.CloseStatusDescription;
                throw new InvalidOperationException("Gemini closed the connection" + (string.IsNullOrEmpty(why) ? "." : ": " + why));
            }
            if (message["setupComplete"] != null && !setUp)
            {
                setUp = true;
                await SendJson(socket, new JsonObject
                {
                    ["clientContent"] = new JsonObject
                    {
                        ["turns"] = new JsonArray(new JsonObject
                        {
                            ["role"] = "user",
                            ["parts"] = new JsonArray(new JsonObject { ["text"] = "Say a quick, cheerful hi in under eight words." }),
                        }),
                        ["turnComplete"] = true,
                    },
                }, timeout.Token);
            }
            if (message["serverContent"] is JsonObject content)
            {
                if (content["outputTranscription"]?["text"]?.GetValue<string>() is { } words) reply.Append(words);
                if (content["turnComplete"]?.GetValue<bool>() == true) break;
            }
        }
        try { await socket.CloseAsync(System.Net.WebSockets.WebSocketCloseStatus.NormalClosure, "", CancellationToken.None); }
        catch (Exception) { }
        var text = reply.ToString().Trim();
        return text.Length > 0 ? text : "(Gemini answered, but without words.)";
    }

    private static async Task SendJson(System.Net.WebSockets.ClientWebSocket socket, JsonNode message, CancellationToken cancel)
    {
        var data = Encoding.UTF8.GetBytes(message.ToJsonString());
        await socket.SendAsync(data, System.Net.WebSockets.WebSocketMessageType.Text, true, cancel);
    }

    /// One whole message (Gemini sends JSON in text or binary frames). Null when the socket closed.
    private static async Task<JsonNode?> ReceiveJson(System.Net.WebSockets.ClientWebSocket socket, CancellationToken cancel)
    {
        var buffer = new byte[64 * 1024];
        using var whole = new MemoryStream();
        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, cancel);
            if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close) return null;
            whole.Write(buffer, 0, result.Count);
            if (result.EndOfMessage) break;
        }
        return JsonNode.Parse(whole.ToArray());
    }

    private static async Task<JsonNode> Post(HttpRequestMessage request, string who)
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
        throw new InvalidOperationException($"{who} wouldn't start a voice session: " + why[..Math.Min(200, why.Length)]);
    }
}
