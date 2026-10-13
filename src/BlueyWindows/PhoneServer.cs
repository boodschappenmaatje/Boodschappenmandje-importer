using System.Net;
using System.Net.Sockets;
using Makaretu.Dns;

namespace Bluey;

/// Advertises the PC on the local network (Bonjour, like the Mac app) and streams face updates
/// to paired phones. Mirrors Mac/Sources/GooglyMac/PhoneServer.swift, plus pairing: a phone the user
/// hasn't approved on this PC gets nothing and can ask for nothing (no keys, no screenshots, no commands).
public sealed class PhoneServer : IDisposable
{
    private sealed class Phone
    {
        public required LineConnection Link;
        public string? Name;
        /// Paired: the user approved this phone (now or earlier, proven by its secret token).
        public bool Trusted;
        public bool Asking;
        /// Requests that came in while the user was still deciding; answered once they allow it.
        public readonly List<Packet> Held = new();
    }

    private readonly List<Phone> phones = new();
    private TcpListener? listener;
    private MulticastService? mdns;
    private ServiceDiscovery? discovery;
    private FaceState? lastSent;
    private DateTime lastSentAt = DateTime.MinValue;

    /// Called with the names of connected phones whenever that list changes.
    public Action<IReadOnlyList<string>>? OnPhonesChanged;
    /// Called when a paired phone asks for something. The second argument replies to that phone.
    public Action<Packet, Action<Packet>>? OnRequest;
    /// Called when an unknown phone wants to pair; the callback gets the user's answer.
    public Action<string, Action<bool>>? OnApprovalNeeded;

    /// Only paired phones count.
    public IReadOnlyList<string> PhoneNames => phones.Where(p => p.Trusted).Select(p => p.Name ?? "iPhone").ToList();

    public static string ComputerName => Environment.MachineName;

    public void Start()
    {
        // One socket for both IPv4 and IPv6 (the phone may resolve either address), or IPv4 alone when IPv6 is off.
        try
        {
            listener = new TcpListener(IPAddress.IPv6Any, 0);
            listener.Server.DualMode = true;
            listener.Start();
        }
        catch (SocketException)
        {
            listener = new TcpListener(IPAddress.Any, 0);
            listener.Start();
        }
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        AcceptLoop(listener);

        mdns = new MulticastService();
        discovery = new ServiceDiscovery(mdns);
        var profile = new ServiceProfile(ComputerName, GooglyService.Type, (ushort)port);
        discovery.Advertise(profile);
        mdns.Start();
        discovery.Announce(profile);
    }

    private async void AcceptLoop(TcpListener listener)
    {
        while (true)
        {
            TcpClient client;
            try { client = await listener.AcceptTcpClientAsync(); }
            catch (Exception) { return; }  // stopped
            Accept(client);
        }
    }

    private void Accept(TcpClient client)
    {
        var phone = new Phone { Link = new LineConnection(client) };
        phones.Add(phone);
        phone.Link.OnClosed = () =>
        {
            phones.Remove(phone);
            OnPhonesChanged?.Invoke(PhoneNames);
        };
        phone.Link.OnPacket = packet =>
        {
            if (packet.Hello != null)
            {
                phone.Name = packet.Hello;
                // The phone's hello carries the token it got when it was paired (newer phone apps).
                if (!phone.Trusted && PairedPhones.Check(packet.Text)) Trust(phone);
                else if (!phone.Trusted) AskToPair(phone);
            }
            if (packet.Command == null) return;
            if (phone.Trusted) OnRequest?.Invoke(packet, reply => phone.Link.Send(reply));
            else if (phone.Asking && phone.Held.Count < 20) phone.Held.Add(packet);
        };
        // Say hello before listening, so the greeting always goes out ahead of any reply.
        phone.Link.Send(new Packet { Hello = ComputerName });
        phone.Link.Start();
    }

    private void Trust(Phone phone)
    {
        phone.Trusted = true;
        if (lastSent != null) phone.Link.Send(new Packet { Face = lastSent });
        OnPhonesChanged?.Invoke(PhoneNames);
    }

    /// An unknown phone: the user decides on this PC. Approved phones get a secret token to show next time.
    private void AskToPair(Phone phone)
    {
        if (phone.Asking) return;
        phone.Asking = true;
        if (OnApprovalNeeded == null) { phone.Link.Close(); return; }
        OnApprovalNeeded(phone.Name ?? "iPhone", approved =>
        {
            phone.Asking = false;
            if (!phones.Contains(phone)) return;  // it left while the user was deciding
            if (!approved) { phone.Held.Clear(); phone.Link.Close(); return; }
            var token = PairedPhones.Add(phone.Name ?? "iPhone");
            phone.Link.Send(new Packet { Command = "paired", Text = token });
            Trust(phone);
            foreach (var held in phone.Held) OnRequest?.Invoke(held, reply => phone.Link.Send(reply));
            phone.Held.Clear();
        });
    }

    /// Sends a command to every phone (e.g. "wake", "sleep").
    public void Broadcast(Packet packet)
    {
        foreach (var phone in phones.Where(p => p.Trusted).ToList()) phone.Link.Send(packet);
    }

    /// Sends the face to every phone, skipping updates too small to see.
    public void Send(FaceState face)
    {
        // Resend at least once a second even when nothing changed, so the phone knows the PC is still driving.
        var now = DateTime.UtcNow;
        if (lastSent is { } last && (now - lastSentAt).TotalSeconds < 1
            && last.Mood == face.Mood
            && Math.Abs(last.GazeX - face.GazeX) < 0.004
            && Math.Abs(last.GazeY - face.GazeY) < 0.004
            && Math.Abs(last.Talk - face.Talk) < 0.02)
            return;
        lastSent = face;
        lastSentAt = now;
        foreach (var phone in phones.Where(p => p.Trusted).ToList()) phone.Link.Send(new Packet { Face = face });
    }

    /// Drops every connection (they reconnect and have to pair again if forgotten).
    public void DisconnectAll()
    {
        foreach (var phone in phones.ToList()) phone.Link.Close();
    }

    public void Dispose()
    {
        try { discovery?.Unadvertise(); } catch (Exception) { }
        discovery?.Dispose();
        mdns?.Stop();
        listener?.Stop();
        foreach (var phone in phones.ToList()) phone.Link.Close();
    }
}

/// Phones the user approved on this PC, kept as hashes of their secret tokens in %APPDATA%\Bluey\phones.json.
public static class PairedPhones
{
    private sealed record Entry(string Name, string Hash, DateTime Added);

    private static string FilePath => Path.Combine(AppFolder.Path, "phones.json");

    private static List<Entry> Load()
    {
        try { return System.Text.Json.JsonSerializer.Deserialize<List<Entry>>(File.ReadAllText(FilePath)) ?? new(); }
        catch (Exception) { return new(); }
    }

    private static void Save(List<Entry> entries) =>
        File.WriteAllText(FilePath, System.Text.Json.JsonSerializer.Serialize(entries, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

    private static string Hash(string token) =>
        Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)));

    public static int Count => Load().Count;

    /// True when `token` belongs to a paired phone.
    public static bool Check(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length < 32) return false;
        var hash = Hash(token);
        return Load().Any(e => System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.ASCII.GetBytes(e.Hash), System.Text.Encoding.ASCII.GetBytes(hash)));
    }

    /// Pairs a phone and returns its new secret token (only its hash is kept here).
    public static string Add(string name)
    {
        var token = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var entries = Load();
        entries.Add(new Entry(name, Hash(token), DateTime.UtcNow));
        Save(entries);
        return token;
    }

    /// Forgets every paired phone; each has to be approved again.
    public static void Clear() => Save(new());
}
