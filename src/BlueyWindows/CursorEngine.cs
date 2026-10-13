namespace Bluey;

public readonly record struct Pt(double X, double Y)
{
    public static Pt operator +(Pt a, Pt b) => new(a.X + b.X, a.Y + b.Y);
    public static Pt operator -(Pt a, Pt b) => new(a.X - b.X, a.Y - b.Y);
    public static Pt operator *(Pt a, double k) => new(a.X * k, a.Y * k);
    public double Length => Math.Sqrt(X * X + Y * Y);
    public double DistanceTo(Pt o) => (this - o).Length;
}

public readonly record struct Box(double X, double Y, double Width, double Height)
{
    public double MidX => X + Width / 2;
    public double MidY => Y + Height / 2;
    public double MinY => Y;
    public double MaxY => Y + Height;
}

/// Where the big character cursor wants to be.
public abstract record CursorMode
{
    /// Parked at the bottom edge of the screen, peeking up above the phone.
    public sealed record Docked : CursorMode;
    /// Tucked out of sight below the screen; the phone's eyes follow your own mouse instead.
    public sealed record Following : CursorMode;
    /// Flew to a spot and stays there.
    public sealed record Pinned(Pt Spot) : CursorMode;

    public static readonly CursorMode Dock = new Docked();
    public static readonly CursorMode Follow = new Following();
}

/// A CSS-style cubic-bezier timing curve: maps time (0…1) to progress (0…1).
public readonly struct TimingCurve
{
    private readonly double x1, y1, x2, y2;
    public TimingCurve(double x1, double y1, double x2, double y2) { this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2; }

    /// Starts gently, then arrives with a long, soft deceleration.
    public static readonly TimingCurve Launch = new(0.42, 0, 0.22, 1);
    /// Keeps the speed it already had (for a change of plans mid-flight), then settles the same way.
    public static readonly TimingCurve Redirect = new(0.25, 0.25, 0.22, 1);
    /// Even and deliberate, for drags.
    public static readonly TimingCurve Steady = new(0.42, 0, 0.38, 1);

    private static double Coordinate(double t, double a, double b)
    {
        double u = 1 - t;
        return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
    }

    private static double Derivative(double t, double a, double b)
    {
        double u = 1 - t;
        return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
    }

    private double Parameter(double x)
    {
        double t = x;
        for (int i = 0; i < 8; i++)
        {
            double error = Coordinate(t, x1, x2) - x;
            if (Math.Abs(error) < 1e-7) return t;
            double d = Derivative(t, x1, x2);
            if (Math.Abs(d) < 1e-7) break;
            t -= error / d;
        }
        double low = 0, high = 1;
        t = x;
        for (int i = 0; i < 40; i++)
        {
            double value = Coordinate(t, x1, x2);
            if (Math.Abs(value - x) < 1e-7) break;
            if (value < x) low = t; else high = t;
            t = (low + high) / 2;
        }
        return t;
    }

    public double Value(double x)
    {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        return Coordinate(Parameter(x), y1, y2);
    }

    /// How fast progress changes with time at `x`.
    public double Rate(double x)
    {
        double t = Parameter(Math.Clamp(x, 0, 1));
        double dx = Derivative(t, x1, x2), dy = Derivative(t, y1, y2);
        return dx > 1e-7 ? dy / dx : 0;
    }
}

/// One planned trip: a smooth cubic curve walked with an easing curve.
internal sealed class Flight
{
    public Pt From, C1, C2, To;
    public double Start, Duration;
    public TimingCurve Timing;
    /// It was sent to point at something (not heading home).
    public bool Pointing;
    public bool Landed;

    public double Progress(double now) => Duration <= 0 ? 1 : Math.Clamp((now - Start) / Duration, 0, 1);

    public Pt Position(double e)
    {
        double u = 1 - e;
        double a = u * u * u, b = 3 * u * u * e, c = 3 * u * e * e, d = e * e * e;
        return new(a * From.X + b * C1.X + c * C2.X + d * To.X, a * From.Y + b * C1.Y + c * C2.Y + d * To.Y);
    }

    public Pt Tangent(double e)
    {
        double u = 1 - e;
        double a = 3 * u * u, b = 6 * u * e, c = 3 * e * e;
        return new(a * (C1.X - From.X) + b * (C2.X - C1.X) + c * (To.X - C2.X),
                   a * (C1.Y - From.Y) + b * (C2.Y - C1.Y) + c * (To.Y - C2.Y));
    }
}

/// Where the cursor is and how it moves. Coordinates are top-left origin, y down, in points
/// (1/96 inch) on the primary screen. A straight port of CursorEngine in CursorOverlay.swift.
public sealed class CursorEngine
{
    public CursorMode Mode { get; private set; } = CursorMode.Follow;
    public Pt Tip { get; private set; } = new(-1000, -1000);
    public Pt Velocity { get; private set; }
    public double Angle { get; private set; } = Math.PI / 4;
    private double angleVelocity;
    public double Opacity { get; private set; }
    private Flight? flight;
    private bool placed;
    public (double Width, double Height) Bounds { get; private set; } = (1440, 900);
    /// Drags move slower and in a straight, steady line.
    public bool Dragging;

    public double LandedAt { get; private set; } = -10;
    private double pressStart = -10, pressDepth;

    public double TalkUntil;
    /// Set while he's listening, thinking or talking.
    public Mood? BrainMood;
    /// Where the phone's eyes should look instead of at the cursor.
    public Pt? GazeOverride;
    /// True while he's awake and talking with you (no dozing off then).
    public bool Awake;
    private Pt mouse;
    private double lastMouseMove = Clock.Now;
    public Func<double> TalkLevel = () => 0;
    public double BlinkUntil { get; private set; }
    private double nextBlink = Clock.Now + 3;

    private readonly AppSettings settings = AppSettings.Shared;
    public double Size => settings.CursorSize;

    public void SetMode(CursorMode mode) => Mode = mode;

    public bool IsHome => Mode is not CursorMode.Pinned;

    /// Where the phone sits, just below the bottom edge of the screen.
    public Pt PhonePoint((double Width, double Height) b) => new(b.Width * settings.PhonePosition, b.Height + b.Height * 0.18);

    /// Peeking up from the bottom edge, right above the phone.
    public Pt DockPoint((double Width, double Height) b) => new(b.Width * settings.PhonePosition, b.Height - Size * 0.42);

    /// Just below the bottom edge, out of sight, as if tucked into the phone.
    public Pt TuckedPoint((double Width, double Height) b) => new(b.Width * settings.PhonePosition, b.Height + Size * 0.35);

    private Pt Goal() => Mode switch
    {
        CursorMode.Docked => DockPoint(Bounds),
        CursorMode.Pinned p => p.Spot,
        _ => TuckedPoint(Bounds),
    };

    /// Seconds until the current trip arrives.
    public double TimeToArrive(double now) => flight == null ? 0 : Math.Max(0, flight.Start + flight.Duration - now);

    /// A little squish toward the tip, like pressing a button.
    public void Press(double depth, double? at = null)
    {
        pressStart = at ?? Clock.Now;
        pressDepth = depth;
    }

    public void Step(double dt, double now, Pt mouse, (double Width, double Height) bounds)
    {
        Bounds = bounds;
        if (mouse.DistanceTo(this.mouse) > 1.5) lastMouseMove = now;
        this.mouse = mouse;
        if (!placed)
        {
            Tip = TuckedPoint(bounds);
            placed = true;
        }

        var target = Goal();
        bool needsPlan = flight != null ? flight.To.DistanceTo(target) > 0.5 : Tip.DistanceTo(target) > 0.5;
        if (needsPlan) Plan(target, now);
        Advance(now);

        // Fades in the moment it leaves home; in follow mode it fades out once it has tucked itself away.
        bool settled = (flight?.Progress(now) ?? 1) >= 1;
        double wantOpacity = Mode is CursorMode.Following && settled ? 0 : 1;
        double rate = wantOpacity > Opacity ? 12 : 6;
        Opacity += (wantOpacity - Opacity) * Math.Min(1, dt * rate);

        // Upright like a normal cursor while out and about (tipped up when parked), leaning a touch into the motion.
        double lean = Math.Clamp(Velocity.X / 2800, -0.2, 0.2);
        double targetAngle = (IsHome ? Math.PI / 4 : 0) + lean;
        const double k = 24;
        angleVelocity += (k * (targetAngle - Angle) - 2 * Math.Sqrt(k) * angleVelocity) * dt;
        Angle += angleVelocity * dt;

        if (now > nextBlink)
        {
            BlinkUntil = now + 0.13;
            nextBlink = now + 2.5 + Random.Shared.NextDouble() * 3.5;
        }
    }

    /// Plans a natural-looking trip: a gentle curve, timed like a real hand movement, with a smooth
    /// start and a long, soft landing.
    private void Plan(Pt goal, double now)
    {
        var from = Tip;
        double dx = goal.X - from.X, dy = goal.Y - from.Y;
        double distance = Math.Sqrt(dx * dx + dy * dy);
        bool pointing = !IsHome;
        if (distance <= 0.5)
        {
            flight = new Flight { From = from, C1 = from, C2 = goal, To = goal, Start = now, Duration = 0, Timing = TimingCurve.Launch, Pointing = pointing };
            return;
        }

        double duration = Math.Min(1.2, Math.Max(0.45, 0.4 + 0.12 * Math.Log2(1 + distance / 24)));
        if (Dragging) duration = Math.Min(1.6, Math.Max(0.6, duration * 1.45));

        var direction = new Pt(dx / distance, dy / distance);
        var normal = new Pt(-direction.Y, direction.X);
        if (Math.Abs(direction.X) > 0.4)
        {
            if (normal.Y > 0) normal = normal * -1;  // sideways trips bow gently upward
        }
        else
        {
            double towardMiddle = Bounds.Width / 2 - (from.X + goal.X) / 2 >= 0 ? 1 : -1;
            if (normal.X * towardMiddle < 0) normal = normal * -1;  // vertical trips bow toward the middle
        }
        double bow = Dragging ? 0 : Math.Min(distance * 0.1, 70) * 0.75;
        double reach = distance * 0.3;
        var c2 = new Pt(goal.X - direction.X * reach + normal.X * bow, goal.Y - direction.Y * reach + normal.Y * bow);

        double speed = Velocity.Length;
        Pt c1;
        TimingCurve timing;
        if (speed > 60)
        {
            // A change of plans mid-flight: carry on from the current speed and heading, no kink.
            var carry = Velocity * (duration / 3);
            double length = carry.Length;
            if (length > distance * 0.6) carry = carry * (distance * 0.6 / length);
            c1 = from + carry;
            timing = TimingCurve.Redirect;
        }
        else
        {
            c1 = new Pt(from.X + direction.X * reach + normal.X * bow, from.Y + direction.Y * reach + normal.Y * bow);
            timing = Dragging ? TimingCurve.Steady : TimingCurve.Launch;
        }
        flight = new Flight { From = from, C1 = c1, C2 = c2, To = goal, Start = now, Duration = duration, Timing = timing, Pointing = pointing };
    }

    private void Advance(double now)
    {
        if (flight == null)
        {
            Velocity = default;
            return;
        }
        double p = flight.Progress(now);
        double e = flight.Timing.Value(p);
        Tip = flight.Position(e);
        if (p >= 1)
        {
            Velocity = default;
            if (!flight.Landed)
            {
                flight.Landed = true;
                if (flight.Pointing) LandedAt = now;
            }
        }
        else
        {
            double rate = flight.Timing.Rate(p) / flight.Duration;
            Velocity = flight.Tangent(e) * rate;
        }
    }

    /// Scale for the press squish: a quick press, then a spring back with the tiniest rebound.
    public double PressScale(double now)
    {
        double t = now - pressStart;
        if (t < 0 || t >= 0.42) return 1;
        if (t < 0.12) return 1 - pressDepth * Math.Sin(t / 0.12 * Math.PI / 2);
        double r = (t - 0.12) / 0.3;
        return 1 - pressDepth * Math.Cos(r * Math.PI * 1.5) * Math.Exp(-r * 3.2);
    }

    /// A slow, gentle hover while it holds a point (eased in so it never jumps).
    public double Hover(double now)
    {
        if (IsHome || (flight?.Progress(now) ?? 1) < 1) return 0;
        double since = now - LandedAt;
        double amount = Math.Clamp((since - 0.35) / 0.6, 0, 1);
        return Math.Sin(since * 2.4) * 1.6 * amount;
    }

    public Pt BodyCenter
    {
        get
        {
            double r = Size * 0.5 * Math.Sqrt(2);
            return new(Tip.X + Math.Cos(Angle + Math.PI / 4) * r, Tip.Y + Math.Sin(Angle + Math.PI / 4) * r);
        }
    }

    /// What the phone's face should do: look at the cursor (or at your mouse in follow mode).
    public FaceState Face((double Width, double Height) bounds, double now)
    {
        var phone = PhonePoint(bounds);
        var c = Mode is CursorMode.Following ? mouse : BodyCenter;
        double gx = Math.Clamp((c.X - phone.X) / (bounds.Width * 0.5), -1, 1);
        double gy = -Math.Clamp((phone.Y - c.Y) / (bounds.Height * 1.1), 0.15, 1);
        if (GazeOverride is { } g) { gx = g.X; gy = g.Y; }

        bool testing = now < TalkUntil;
        double talk = testing ? 0.5 + 0.5 * Math.Sin(now * 19) * Math.Sin(now * 7.3) : TalkLevel();
        var mood = settings.Mood;
        if (BrainMood is { } brain) mood = brain;
        else if (testing) mood = Mood.Talking;
        else if (Mode is CursorMode.Pinned && mood == Mood.Listening) mood = Mood.Pointing;
        else if (Mode is CursorMode.Following && !Awake && mood == Mood.Listening)
        {
            // Your mouse sat still: he gets drowsy after 5 seconds and dozes off after 15.
            double idle = now - lastMouseMove;
            if (idle > 15) mood = Mood.Resting; else if (idle > 5) mood = Mood.Sleepy;
        }
        return new FaceState { GazeX = gx, GazeY = gy, Mood = mood, Talk = talk };
    }
}

/// Seconds since the app started, from a high-resolution clock.
public static class Clock
{
    private static readonly System.Diagnostics.Stopwatch watch = System.Diagnostics.Stopwatch.StartNew();
    public static double Now => watch.Elapsed.TotalSeconds;
}
