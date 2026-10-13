using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Bluey;

/// The PC's half of live voice. The phone runs the voice session (its mic) with OpenAI or Gemini;
/// the PC hands it a short-lived key, runs its tools (look at the screen, point, research) and shows captions.
/// Everything runs on the UI thread, alongside the cursor it drives. Mirrors RealtimeHost.swift
/// (using the computer comes in a later step).
public sealed class RealtimeHost
{
    public const string Model = "gpt-realtime-2.1";

    private static readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private readonly CursorOverlay overlay;
    private readonly ReportPanel reports = new();
    private ScreenSnapshot? snapshot;
    private readonly System.Windows.Forms.Timer captionTimer = new();
    private Action? captionTimerAction;
    /// Tools run one at a time, in the order he asked for them.
    private Task toolChain = Task.CompletedTask;

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
        overlay.OnFrame = _ => Choreograph();
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
                // No meeting notes: the audio is not kept or transcribed. An empty transcript lets an older
                // phone app drop chunks it recorded earlier instead of retrying them forever.
                reply(new Packet { Command = "transcribed", CallID = packet.CallID, Text = "{\"segments\":[]}" });
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
                // His reply, streaming in. It shows as a speech bubble by his cursor (or above the phone).
                var text = packet.Text?.Trim() ?? "";
                ShowCaption(text.Length == 0 ? null : text, 0);
                if (text.Length > 0) SetSpeaking(true);
                break;
            }
            case "captionDone":
            {
                // Keep the bubble (and his pointing) up long enough to read, then tidy away.
                var text = packet.Text ?? "";
                if (text.Length > 0) ShowCaption(text, 0);
                double words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
                double readTime = Math.Min(Math.Max(2.8, 1.2 + words * 0.32), 12) + 3;
                After(readTime, () =>
                {
                    SetSpeaking(false);
                    ShowCaption(null, 0);
                });
                break;
            }
            case "tool":
            {
                var previous = toolChain;
                var run = RunAfter(previous, packet.Tool ?? "", packet.Text ?? "{}");
                toolChain = run;
                var (text, image) = await run;
                reply(new Packet { Command = "toolResult", CallID = packet.CallID, Text = text, Image = image });
                break;
            }
        }
    }

    private async Task<(string, string?)> RunAfter(Task previous, string name, string arguments)
    {
        try { await previous; } catch (Exception) { }
        try { return await RunTool(name, arguments); }
        catch (Exception error) { return ($"That didn't work: {error.Message}", null); }
    }

    public void SetAwake(bool on)
    {
        Awake = on;
        Engine.Awake = on;
        Engine.BrainMood = null;
        Engine.GazeOverride = null;  // his eyes follow your mouse while he listens
        if (!on)
        {
            queue.Clear();
            choreographing = false;
            overlay.GoHome();
            overlay.SpeechTarget = null;
            ShowCaption(null, 0);
        }
        OnChange?.Invoke();
    }

    // MARK: Tools

    private static readonly JsonObject GridX = new() { ["type"] = "number", ["description"] = "0 = left edge, 1000 = right edge of the screen" };
    private static readonly JsonObject GridY = new() { ["type"] = "number", ["description"] = "0 = top edge, 1000 = bottom edge of the screen" };

    private sealed record ToolSpec(string Name, string Description, JsonObject Properties, string[] Required);

    private static ToolSpec Tool(string name, string description, JsonObject? properties = null, params string[] required) =>
        new(name, description, properties ?? new JsonObject(), required);

    /// Tool definitions for the session (kept here so they sit next to their code).
    private static List<ToolSpec> ToolList => new()
    {
        Tool("look_at_screen",
             "Take a fresh look at the user's screen. Returns the front window's title, every piece of text (lines L#, words W#) with positions on a 0-1000 grid, and a screenshot. Call this before pointing, and again whenever the screen may have changed."),
        Tool("point_at",
             "Fly your cursor to something on screen and keep pointing there while you talk about it. Use the most specific id (a single word or number over a whole line). Call it right before you mention the thing.",
             new JsonObject { ["target_id"] = new JsonObject { ["type"] = "string", ["description"] = "An id from look_at_screen, like W12 or L3." } },
             "target_id"),
        Tool("point_at_spot",
             "Point at something that isn't text (a shape, arrow, chart bar, image) using its position on the 0-1000 grid of the last screenshot.",
             new JsonObject { ["x"] = GridX.DeepClone(), ["y"] = GridY.DeepClone() }, "x", "y"),
        Tool("web_research",
             "Look something up on the web and put a short report (title plus up to four paragraphs, with sources) on the user's screen. Use for anything you're not sure of, anything recent, or anything that needs facts, prices, news or details. Before calling it, point at the relevant thing if there is one and reply with one short line that ends with \"doing some research…\" (in the user's language).",
             new JsonObject { ["question"] = new JsonObject { ["type"] = "string", ["description"] = "What to research, as a clear, self-contained question." } },
             "question"),
        Tool("stop_pointing", "Bring your cursor back home when you're done pointing."),
        Tool("go_to_sleep",
             "Go back to quietly following the user's mouse with your eyes. Use when the user says bye, thanks that's all, or asks you to sleep."),
    };

    private static JsonObject Parameters(ToolSpec t) => new()
    {
        ["type"] = "object",
        ["properties"] = t.Properties.DeepClone(),
        ["required"] = new JsonArray(t.Required.Select(r => (JsonNode)JsonValue.Create(r)!).ToArray()),
    };

    /// OpenAI Realtime's tool format.
    private static JsonArray OpenAITools => new(ToolList.Select(t => (JsonNode)new JsonObject
    {
        ["type"] = "function",
        ["name"] = t.Name,
        ["description"] = t.Description,
        ["parameters"] = Parameters(t),
    }).ToArray());

    /// Gemini Live's tool format.
    private static JsonArray GeminiTools => new(new JsonObject
    {
        ["functionDeclarations"] = new JsonArray(ToolList.Select(t =>
        {
            var declaration = new JsonObject { ["name"] = t.Name, ["description"] = t.Description };
            if (t.Properties.Count > 0) declaration["parameters"] = Parameters(t);
            return (JsonNode)declaration;
        }).ToArray()),
    });

    /// Separates his instructions from the report text, so the phone can save the report in the transcript.
    private const string ReportMarker = "\n---REPORT---\n";

    private async Task<(string Text, string? Image)> RunTool(string name, string arguments)
    {
        JsonObject args;
        try { args = JsonNode.Parse(arguments) as JsonObject ?? new JsonObject(); }
        catch (JsonException) { args = new JsonObject(); }

        switch (name)
        {
            case "look_at_screen":
                return await Look();
            case "point_at":
            {
                var id = (Str(args["target_id"]) ?? "").Trim();
                if (snapshot == null) return ("Call look_at_screen first.", null);
                if (snapshot.FindTarget(id) is not { } target) return ($"No target {id}. Use an id from the last look_at_screen.", null);
                Point(new Pt(target.Rect.MidX, target.Rect.MaxY + 3), target.Rect);
                return (queue.Count > 1 ? $"Queued: your cursor will point at \"{target.Text}\" after the earlier spots." : $"Pointing at \"{target.Text}\".", null);
            }
            case "point_at_spot":
            {
                if (Num(args["x"]) is not { } x || Num(args["y"]) is not { } y) return ("Give x and y.", null);
                var spot = GridPoint(x, y);
                Point(spot, new Box(spot.X - 16, spot.Y - 16, 32, 32));
                return ("Pointing there.", null);
            }
            case "stop_pointing":
                RequestHome();
                return ("Your cursor will head home once you finish talking.", null);
            case "web_research":
            {
                var question = (Str(args["question"]) ?? "").Trim();
                if (question.Length == 0) return ("What should I research?", null);
                reports.ShowLoading(question);
                try
                {
                    var screenText = snapshot == null ? null : string.Join(" / ", snapshot.Lines.Take(40).Select(l => l.Line.Text));
                    var report = await WebResearch.Research(question, screenText);
                    reports.ShowReport(report);
                    return ("The full report is now in a card on the user's screen. Reply with ONE short line: the key takeaway in your own words. Don't repeat the report." + ReportMarker + report.PlainText, null);
                }
                catch (Exception error)
                {
                    reports.ShowError(error.Message);
                    return ($"Research failed: {error.Message}. Tell the user in a few words.", null);
                }
            }
            case "go_to_sleep":
                // The phone closes the session after this call; the PC just tidies up.
                return ("Going to sleep. Say a very short goodbye.", null);
            default:
                return ($"{name} isn't available on this Windows PC yet. Tell the user in a few words.", null);
        }
    }

    private async Task<(string, string?)> Look()
    {
        try
        {
            var shot = await ScreenReader.Snapshot();
            snapshot = shot;
            var text = shot.TargetList;
            var mouse = CursorOverlay.MouseLocation;
            int mx = (int)(Math.Clamp(mouse.X / shot.Size.Width, 0, 1) * 1000), my = (int)(Math.Clamp(mouse.Y / shot.Size.Height, 0, 1) * 1000);
            text += $"\nThe user's mouse pointer is at @{mx},{my}";
            if (shot.TargetNear(mouse) is { } under) text += $", on {under.Id} \"{under.Text}\"";
            text += ". When they say \"this\", \"that\" or \"here\", they mean what's at their mouse pointer.";
            return (text, Convert.ToBase64String(shot.Jpeg));
        }
        catch (Exception error)
        {
            return ($"I can't see the screen: {error.Message}", null);
        }
    }

    private static string? Str(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

    private static double? Num(JsonNode? node)
    {
        if (node is not JsonValue v) return null;
        if (v.TryGetValue<double>(out var d)) return d;
        if (v.TryGetValue<int>(out var i)) return i;
        if (v.TryGetValue<long>(out var l)) return l;
        if (v.TryGetValue<string>(out var s) && double.TryParse(s, System.Globalization.CultureInfo.InvariantCulture, out var p)) return p;
        return null;
    }

    private (double Width, double Height) ScreenSize => snapshot?.Size ?? CursorOverlay.ScreenSize;

    private Pt GridPoint(double x, double y) =>
        new(Math.Clamp(x, 0, 1000) / 1000 * ScreenSize.Width, Math.Clamp(y, 0, 1000) / 1000 * ScreenSize.Height);

    // MARK: Pointing choreography
    //
    // He often asks to point at several things at once. Each spot gets its own flight and a hold long
    // enough to talk about it, and the cursor only goes home once he's finished talking.

    /// Spots to point at, with the thing being shown (so his speech bubble can sit above it, not on it).
    private readonly Queue<(Pt Spot, Box Thing)> queue = new();
    private double holdUntil, quietSince;
    private bool homeRequested, speaking, choreographing;

    /// How long a spot stays pointed at before the next one (after the flight lands).
    private const double MinimumHold = 2.2;
    /// Out and about with nothing more to say: go home after this much quiet.
    private const double IdleHome = 5.0;

    private void Point(Pt spot, Box thing)
    {
        queue.Enqueue((spot, thing));
        homeRequested = false;
        choreographing = true;
    }

    private void RequestHome()
    {
        homeRequested = true;
        choreographing = true;
    }

    /// Runs every frame while he's pointing.
    private void Choreograph()
    {
        if (!choreographing) return;
        double now = Clock.Now;
        if (now >= holdUntil && queue.Count > 0)
        {
            var (spot, thing) = queue.Dequeue();
            overlay.SpeechTarget = thing;
            if (!speaking) quietSince = now;  // give him time to start talking about it
            Engine.GazeOverride = null;  // his eyes follow the cursor while pointing
            overlay.Mode = new CursorMode.Pinned(spot);
            // Flight time plus a comfortable hold; a lone point just holds while he talks.
            holdUntil = now + 1.0 + MinimumHold;
            return;
        }
        if (queue.Count > 0 || now < holdUntil) return;
        if (overlay.Mode == overlay.IdleMode) { choreographing = false; return; }
        // Go home once he's done talking: soon after he says so, or after a longer quiet spell.
        double quietFor = speaking ? 0 : now - quietSince;
        if ((homeRequested && quietFor > 1.2) || quietFor > IdleHome) GoHome();
    }

    private void GoHome()
    {
        overlay.GoHome();
        Engine.GazeOverride = null;
        overlay.SpeechTarget = null;
        homeRequested = false;
        choreographing = false;
    }

    private void SetSpeaking(bool on)
    {
        if (speaking && !on) quietSince = Clock.Now;
        speaking = on;
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

    /// Who he is, in English. Editable from the tray menu (Personality…).
    public const string DefaultPersonality =
        "You are a small blueberry with big googly eyes who lives on an iPhone under the user's screen and has your own " +
        "cursor. You're a young British guy: dry, quick-witted, a bit cheeky, British phrasing. You never speak out loud: " +
        "your replies pop up as a tiny speech bubble, so keep them to one short line, under fifteen words. Answer " +
        "immediately with the actual answer. Never announce what you're going to do, never recap, never offer more help.";

    /// Who he is, in Dutch: the same character, as a young Dutch guy.
    public const string DefaultPersonalityDutch =
        "Je bent een kleine blauwe bes met grote wiebelogen die op een iPhone onder het scherm van de gebruiker woont en " +
        "een eigen cursor heeft. Je bent een jonge Nederlandse gast: droog, gevat, een beetje brutaal, met gewone " +
        "spreektaal. Je praat nooit hardop: je antwoorden verschijnen als een klein tekstballonnetje, dus houd ze kort, " +
        "één zin van minder dan vijftien woorden. Geef meteen het echte antwoord. Kondig nooit aan wat je gaat doen, " +
        "vat niets samen en bied geen extra hulp aan.";

    private static bool Dutch => AppSettings.Shared.Language == "nl";

    public static string Personality
    {
        get
        {
            var saved = AppSettings.Shared.Personality.Trim();
            return saved.Length > 0 ? saved : Dutch ? DefaultPersonalityDutch : DefaultPersonality;
        }
        set => AppSettings.Shared.Personality = value;
    }

    /// Which language he talks in. The model hears any language; this decides what he answers in.
    private static string LanguageRule => Dutch
        ? "Language: the user speaks Dutch (Nederlands). Always reply in natural, informal Dutch (je/jij), " +
          "even though these instructions are in English. Only switch language if the user clearly asks you to."
        : "Language: always reply in English, even when the user speaks another language, unless they ask you to switch.";

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

    /// How he uses his tools. Always included, whatever the personality says.
    private const string ToolGuide =
        "Most important rule: when a request needs a tool, call the tool FIRST with no words before it (the one " +
        "exception is web_research, described below). Never write things like \"one moment\", \"sure\", \"okay\" or " +
        "\"let me\". Reply only after, in one short line. No lists, no markdown, never mention ids or coordinates.\n\n" +
        "Point whenever you can. If the question is about anything on the screen (\"what's this?\", \"what does this " +
        "mean?\"), call look_at_screen, then point_at (or point_at_spot) the thing you're talking about, then give your " +
        "one-line answer; your bubble appears right by your cursor. \"This\", \"that\" and \"here\" mean what's at the user's " +
        "mouse pointer, which look_at_screen tells you. Point at the most specific thing (a word or number rather than a " +
        "whole line). For shapes, arrows or charts with no text, use point_at_spot. If the screen may have changed, look " +
        "again. When the user says goodbye or asks you to sleep, reply with a very short goodbye and call go_to_sleep.\n\n" +
        "Research: when answering well needs facts you're not sure of, anything recent, or details from the web, use " +
        "web_research. In that one response: point at the relevant thing on screen if there is one, write one short " +
        "line that ends with \"doing some research…\" (in the user's language), then call web_research. The report " +
        "appears in a card on the screen; afterwards reply with just one short takeaway line.\n\n" +
        "You live next to a Windows PC. You can look at its screen and point, but you can't click or type on it yet; " +
        "if the user asks, say so in a few words.";

    private static string Instructions(bool gemini) =>
        Personality + "\n\n" + (gemini ? GeminiGuide : OpenAIGuide) + "\n\n" + ToolGuide + "\n\n" + LanguageRule;

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
                ["transcription"] = new JsonObject
                {
                    ["model"] = "gpt-4o-mini-transcribe",
                    ["language"] = Dutch ? "nl" : "en",
                },
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
                            ["parts"] = new JsonArray(new JsonObject { ["text"] = Dutch ? "Zeg kort en vrolijk hoi, in minder dan acht woorden." : "Say a quick, cheerful hi in under eight words." }),
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
