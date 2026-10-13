using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bluey;

/// Everything the PC and the iPhone agree on: the Bonjour service name, what a "face update"
/// looks like, and how lines of JSON travel over TCP. Mirrors Shared/GooglyLink.swift.
public static class GooglyService
{
    public const string Type = "_googly._tcp";
}

public enum Mood
{
    Listening,
    Resting,
    Thinking,
    Talking,
    Pointing,
    Happy,
    Sleepy,
}

/// What the phone should show right now.
public sealed record FaceState
{
    /// Where the eyes look. x: -1 left … 1 right. y: -1 up … 1 down.
    [JsonPropertyName("gazeX")] public double GazeX { get; init; }
    [JsonPropertyName("gazeY")] public double GazeY { get; init; }
    [JsonPropertyName("mood")] public Mood Mood { get; init; } = Mood.Listening;
    /// Voice level, 0…1. Drives the talking bounce.
    [JsonPropertyName("talk")] public double Talk { get; init; }
}

public sealed class Packet
{
    [JsonPropertyName("face")] public FaceState? Face { get; set; }
    /// Sent once by each side after connecting, with a device name.
    [JsonPropertyName("hello")] public string? Hello { get; set; }
    [JsonPropertyName("volume")] public double? Volume { get; set; }
    /// A request or event, like "realtimeToken" or "caption" (phone→PC) or "wake"/"sleep" (PC→phone).
    [JsonPropertyName("command")] public string? Command { get; set; }
    [JsonPropertyName("audio")] public string? Audio { get; set; }
    [JsonPropertyName("speech")] public int? Speech { get; set; }
    /// Pairs a request with its reply (tool calls, realtime tokens).
    [JsonPropertyName("callID")] public string? CallID { get; set; }
    [JsonPropertyName("tool")] public string? Tool { get; set; }
    /// Free text: tool arguments or output, a token, a caption.
    [JsonPropertyName("text")] public string? Text { get; set; }
    /// A JPEG (base64) that goes with a tool result.
    [JsonPropertyName("image")] public string? Image { get; set; }

    public static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // Moods travel as their lowercase names ("listening"), like the Swift enum's raw values.
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };
}

/// Newline-delimited JSON over one TCP connection. Start it on the UI thread: every callback runs there.
public sealed class LineConnection
{
    private readonly TcpClient client;
    private readonly NetworkStream stream;
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private bool closed;

    public Action<Packet>? OnPacket;
    public Action? OnClosed;

    public LineConnection(TcpClient client)
    {
        this.client = client;
        client.NoDelay = true;
        client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.KeepAlive, true);
        client.Client.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveTime, 2);
        client.Client.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveInterval, 1);
        client.Client.SetSocketOption(SocketOptionLevel.Tcp, SocketOptionName.TcpKeepAliveRetryCount, 5);
        stream = client.GetStream();
    }

    public async void Start()
    {
        var buffer = new byte[64 * 1024];
        var line = new MemoryStream();
        try
        {
            while (true)
            {
                int read = await stream.ReadAsync(buffer);
                if (read <= 0) break;
                int start = 0;
                for (int i = 0; i < read; i++)
                {
                    if (buffer[i] != 0x0A) continue;
                    line.Write(buffer, start, i - start);
                    start = i + 1;
                    Deliver(line.ToArray());
                    line.SetLength(0);
                }
                line.Write(buffer, start, read - start);
            }
        }
        catch (Exception) { }
        Close();
    }

    private void Deliver(byte[] data)
    {
        Packet? packet;
        try { packet = JsonSerializer.Deserialize<Packet>(data, Packet.Json); }
        catch (JsonException) { return; }
        if (packet != null) OnPacket?.Invoke(packet);
    }

    public async void Send(Packet packet)
    {
        if (closed) return;
        var data = JsonSerializer.SerializeToUtf8Bytes(packet, Packet.Json);
        await writeLock.WaitAsync();
        try
        {
            await stream.WriteAsync(data);
            await stream.WriteAsync(new byte[] { 0x0A });
        }
        catch (Exception) { Close(); }
        finally { writeLock.Release(); }
    }

    public void Close()
    {
        if (closed) return;
        closed = true;
        try { client.Close(); } catch (Exception) { }
        OnClosed?.Invoke();
    }
}
