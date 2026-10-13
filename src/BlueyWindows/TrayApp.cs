namespace Bluey;

/// The tray icon and its menu, and the glue between the phone, the cursor and the brain.
/// Takes the place of AppDelegate.swift (the Mac's menu bar app).
public sealed class TrayApp : ApplicationContext
{
    private readonly AppSettings settings = AppSettings.Shared;
    private readonly CursorOverlay overlay = new();
    private readonly PhoneServer server = new();
    private readonly RealtimeHost host;
    private readonly HotKeys hotKeys = new();
    private readonly NotifyIcon tray;
    private readonly ContextMenuStrip menu = new();
    private string? serverProblem;

    public TrayApp()
    {
        Fonts.RegisterBundled();
        host = new RealtimeHost(overlay);

        tray = new NotifyIcon { Icon = Teardrop.TrayIcon(), Text = "Bluey", ContextMenuStrip = menu, Visible = true };
        // Rebuilt each time it opens. An empty strip cancels its own opening, so it starts filled and un-cancels.
        BuildMenu();
        menu.Opening += (_, e) =>
        {
            BuildMenu();
            e.Cancel = false;
        };
        tray.MouseClick += (_, e) =>
        {
            if (e.Button == MouseButtons.Left) ShowMenu();
        };

        overlay.OnFace = face => server.Send(face);
        overlay.Start();

        server.OnPhonesChanged = names =>
        {
            RefreshIcon();
            if (names.Count == 0 && host.Awake) host.SetAwake(false);
        };
        server.OnRequest = (packet, reply) => host.Handle(packet, reply);
        try { server.Start(); }
        catch (Exception error) { serverProblem = error.Message; }
        host.OnChange = RefreshIcon;

        // Ctrl+Alt+Space wakes him up or puts him back to sleep (same as double tapping him on the phone).
        hotKeys.Register(Keys.Space, ToggleAwake, "Ctrl+Alt+Space");
        // Ctrl+Alt+P point here, F follow mouse, D stop pointing, H hide, T talk test.
        hotKeys.Register(Keys.P, PointHere, "Ctrl+Alt+P");
        hotKeys.Register(Keys.F, ToggleFollow, "Ctrl+Alt+F");
        hotKeys.Register(Keys.D, overlay.GoHome, "Ctrl+Alt+D");
        hotKeys.Register(Keys.H, () => settings.ShowCursor = !settings.ShowCursor, "Ctrl+Alt+H");
        hotKeys.Register(Keys.T, () => overlay.TalkTest(), "Ctrl+Alt+T");

        if (ApiKeys.Get(settings.Provider == "openai" ? ApiKeys.OpenAI : ApiKeys.Gemini) == null)
        {
            var later = new System.Windows.Forms.Timer { Interval = 500 };
            later.Tick += (_, _) => { later.Dispose(); if (settings.Provider == "openai") EditOpenAIKey(); else EditGeminiKey(); };
            later.Start();
        }
        RefreshIcon();
    }

    private void RefreshIcon()
    {
        var phones = server.PhoneNames;
        var text = phones.Count == 0 ? "Bluey – waiting for the phone" : "Bluey – " + string.Join(", ", phones);
        tray.Text = text.Length > 63 ? text[..63] : text;
    }

    private void ShowMenu()
    {
        // NotifyIcon only opens its menu on right-click; this opens it on left-click too.
        typeof(NotifyIcon).GetMethod("ShowContextMenu", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
            ?.Invoke(tray, null);
    }

    // MARK: Actions

    private void PointHere() => overlay.Mode = new CursorMode.Pinned(CursorOverlay.MouseLocation);

    private void ToggleFollow()
    {
        settings.FollowMouse = !settings.FollowMouse;
        overlay.GoHome();
    }

    private void ToggleAwake() => server.Broadcast(new Packet { Command = host.Awake ? "sleep" : "wake" });

    /// Wakes him again so a new personality takes effect right away.
    private void RestartIfAwake()
    {
        if (!host.Awake) return;
        server.Broadcast(new Packet { Command = "sleep" });
        var later = new System.Windows.Forms.Timer { Interval = 1000 };
        later.Tick += (_, _) => { later.Dispose(); server.Broadcast(new Packet { Command = "wake" }); };
        later.Start();
    }

    private void EditOpenAIKey()
    {
        var key = Dialogs.AskForKey("OpenAI API Key", "From platform.openai.com/api-keys (paid per use).", "sk-…",
                                    ApiKeys.Get(ApiKeys.OpenAI) != null);
        if (!string.IsNullOrEmpty(key)) ApiKeys.Set(ApiKeys.OpenAI, key);
    }

    private void EditGeminiKey()
    {
        var key = Dialogs.AskForKey("Gemini API Key", "From aistudio.google.com/apikey (free tier).", "AIza…",
                                    ApiKeys.Get(ApiKeys.Gemini) != null);
        if (!string.IsNullOrEmpty(key)) ApiKeys.Set(ApiKeys.Gemini, key);
    }

    private void SetProvider(string provider)
    {
        if (settings.Provider == provider) return;
        settings.Provider = provider;
        if (ApiKeys.Get(provider == "openai" ? ApiKeys.OpenAI : ApiKeys.Gemini) == null)
        {
            if (provider == "openai") EditOpenAIKey(); else EditGeminiKey();
        }
        RestartIfAwake();
    }

    /// Talks to Gemini straight from the PC, so the key and model can be checked without the phone.
    private async void TestGemini()
    {
        overlay.Caption = "Testing Gemini…";
        string result;
        try { result = "Gemini works! He says: " + await RealtimeHost.TestGemini(); }
        catch (Exception error) { result = "Gemini test failed: " + error.Message; }
        overlay.Caption = null;
        MessageBox.Show(result, "Bluey – Gemini test", MessageBoxButtons.OK,
                        result.StartsWith("Gemini works") ? MessageBoxIcon.Information : MessageBoxIcon.Warning);
    }

    private void EditPersonality()
    {
        var (choice, text) = Dialogs.EditPersonality(RealtimeHost.Personality);
        switch (choice)
        {
            case Dialogs.PersonalityChoice.Save: RealtimeHost.Personality = text; break;
            case Dialogs.PersonalityChoice.Reset: RealtimeHost.Personality = ""; break;
            default: return;
        }
        RestartIfAwake();
    }

    // MARK: Menu

    private void BuildMenu()
    {
        menu.Items.Clear();
        var phones = server.PhoneNames;
        var status = serverProblem != null
            ? "Can't reach the network: " + serverProblem
            : phones.Count == 0 ? "Waiting for the phone app…" : "Phone connected: " + string.Join(", ", phones);
        menu.Items.Add(new ToolStripMenuItem(status) { Enabled = false });
        var wake = Item(host.Awake ? "Go to Sleep (Follow Mode)" : "Wake Up and Talk", ToggleAwake, "Ctrl+Alt+Space");
        wake.Enabled = phones.Count > 0;
        menu.Items.Add(wake);
        menu.Items.Add(new ToolStripSeparator());

        menu.Items.Add(Item("Point Here", PointHere, "Ctrl+Alt+P"));
        menu.Items.Add(Item("Eyes Follow My Mouse", ToggleFollow, "Ctrl+Alt+F", settings.FollowMouse));
        menu.Items.Add(Item("Stop Pointing", overlay.GoHome, "Ctrl+Alt+D"));
        menu.Items.Add(Item("Talk Test", () => overlay.TalkTest(), "Ctrl+Alt+T"));
        menu.Items.Add(new ToolStripSeparator());

        var mood = new ToolStripMenuItem("Mood");
        foreach (var m in new[] { Mood.Listening, Mood.Resting, Mood.Thinking, Mood.Happy })
            mood.DropDownItems.Add(Item(m.ToString(), () => settings.Mood = m, null, settings.Mood == m));
        menu.Items.Add(mood);

        var size = new ToolStripMenuItem("Cursor Size");
        foreach (var (name, pt) in new[] { ("Small", 48), ("Medium", 72), ("Large", 96), ("Huge", 120) })
            size.DropDownItems.Add(Item($"{name} ({pt} pt)", () => settings.CursorSize = pt, null, (int)settings.CursorSize == pt));
        menu.Items.Add(size);

        var phone = new ToolStripMenuItem("Phone Sits Under");
        foreach (var (name, pos) in new[] { ("Left", 20), ("Center", 50), ("Right", 80) })
            phone.DropDownItems.Add(Item(name, () => settings.PhonePosition = pos / 100.0, null,
                                         (int)Math.Round(settings.PhonePosition * 100) == pos));
        menu.Items.Add(phone);

        menu.Items.Add(Item("Personality…", EditPersonality));
        var brain = new ToolStripMenuItem("AI");
        brain.DropDownItems.Add(Item("Gemini (free tier)", () => SetProvider("gemini"), null, settings.Provider == "gemini"));
        brain.DropDownItems.Add(Item("OpenAI (paid)", () => SetProvider("openai"), null, settings.Provider == "openai"));
        brain.DropDownItems.Add(new ToolStripSeparator());
        brain.DropDownItems.Add(Item("Gemini Key…", EditGeminiKey));
        brain.DropDownItems.Add(Item("Test Gemini Connection", TestGemini));
        brain.DropDownItems.Add(Item("OpenAI Key…", EditOpenAIKey));
        menu.Items.Add(brain);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(Item("Cursor Glow", () => settings.Glow = !settings.Glow, null, settings.Glow));
        menu.Items.Add(Item("Show Cursor", () => settings.ShowCursor = !settings.ShowCursor, "Ctrl+Alt+H", settings.ShowCursor));
        if (hotKeys.Failed.Count > 0)
            menu.Items.Add(new ToolStripMenuItem("In use by another app: " + string.Join(", ", hotKeys.Failed)) { Enabled = false });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(Item("Quit Bluey", ExitThread));
    }

    private static ToolStripMenuItem Item(string title, Action action, string? shortcut = null, bool? check = null)
    {
        var item = new ToolStripMenuItem(title) { ShortcutKeyDisplayString = shortcut };
        item.Click += (_, _) => action();
        if (check is { } on) item.Checked = on;
        return item;
    }

    protected override void ExitThreadCore()
    {
        tray.Visible = false;
        tray.Dispose();
        hotKeys.Dispose();
        server.Dispose();
        overlay.Dispose();
        base.ExitThreadCore();
    }
}
