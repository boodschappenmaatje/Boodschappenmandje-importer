using System.Net;
using System.Net.Sockets;
using Makaretu.Dns;

namespace Bluey;

/// Advertises the PC on the local network (Bonjour, like the Mac app) and streams face updates
/// to any phone that connects. Mirrors Mac/Sources/GooglyMac/PhoneServer.swift.
public sealed class PhoneServer : IDisposable
{
    private sealed class Phone
    {
        public required LineConnection Link;
        public string? Name;
    }

    private readonly List<Phone> phones = new();
    private TcpListener? listener;
    private MulticastService? mdns;
    private ServiceDiscovery? discovery;
    private FaceState? lastSent;
    private DateTime lastSentAt = DateTime.MinValue;

    /// Called with the names of connected phones whenever that list changes.
    public Action<IReadOnlyList<string>>? OnPhonesChanged;
    /// Called when a phone asks for something. The second argument replies to that phone.
    public Action<Packet, Action<Packet>>? OnRequest;

    public IReadOnlyList<string> PhoneNames => phones.Select(p => p.Name ?? "iPhone").ToList();

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
                OnPhonesChanged?.Invoke(PhoneNames);
            }
            if (packet.Command != null)
                OnRequest?.Invoke(packet, reply => phone.Link.Send(reply));
        };
        // Say hello before listening, so the greeting always goes out ahead of any reply.
        phone.Link.Send(new Packet { Hello = ComputerName });
        if (lastSent != null) phone.Link.Send(new Packet { Face = lastSent });
        phone.Link.Start();
        OnPhonesChanged?.Invoke(PhoneNames);
    }

    /// Sends a command to every phone (e.g. "wake", "sleep").
    public void Broadcast(Packet packet)
    {
        foreach (var phone in phones.ToList()) phone.Link.Send(packet);
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
        foreach (var phone in phones.ToList()) phone.Link.Send(new Packet { Face = face });
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
