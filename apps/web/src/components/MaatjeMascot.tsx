interface MaatjeMascotProps {
  size?: "small" | "medium" | "large";
  className?: string;
}

export function MaatjeMascot({
  size = "medium",
  className = "",
}: MaatjeMascotProps) {
  return (
    <svg
      className={`maatje-mascot ${className}`.trim()}
      data-size={size}
      viewBox="0 0 118 142"
      role="img"
      aria-label="Maatje, het vriendelijke boodschappenbonnetje"
    >
      <path
        className="maatje-paper"
        d="M31 12 39 17l8-5 8 5 8-5 8 5 8-5 8 5 8-5v103l-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5V12Z"
      />
      <path className="maatje-arm" d="M31 61c-11 1-15 8-16 18m80-21c10 1 15 7 16 17" />
      <path className="maatje-hand" d="m15 79-5-5m5 5-6 1m102-5 5-5m-5 5 6 1" />
      <ellipse className="maatje-eye" cx="51" cy="48" rx="4" ry="7" />
      <ellipse className="maatje-eye" cx="76" cy="48" rx="4" ry="7" />
      <circle className="maatje-eye-shine" cx="52" cy="46" r="1.2" />
      <circle className="maatje-eye-shine" cx="77" cy="46" r="1.2" />
      <path className="maatje-brow" d="M45 37c4-3 8-3 12 0m13 0c4-3 8-3 12 0" />
      <path className="maatje-mouth" d="M49 64c6 12 22 12 29 0-8 4-20 4-29 0Z" />
      <path className="maatje-cheek" d="M42 61h5m34 0h5" />
      <path className="maatje-line" d="M45 89h38M45 98h30M45 107h34" />
      <path className="maatje-leg" d="m48 120-3 11m36-11 3 11" />
    </svg>
  );
}
