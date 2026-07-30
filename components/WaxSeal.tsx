type WaxSealVariant = "ember" | "gold" | "sage";

const VARIANT_COLORS: Record<WaxSealVariant, string> = {
  ember: "#B8433A",
  gold: "#D4A73D",
  sage: "#7C9A82",
};

export function WaxSeal({
  variant = "ember",
  size = 64,
  className = "",
  animate = true,
}: {
  variant?: WaxSealVariant;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const color = VARIANT_COLORS[variant];
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Wax seal"
      className={`${animate ? "wax-seal-stamp" : ""} ${className}`}
    >
      <circle cx="50" cy="50" r="46" fill={color} opacity="0.18" />
      <circle cx="50" cy="50" r="38" fill={color} />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="black"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />
      <path
        d="M50 30 L56 44 L71 44 L59 53 L64 68 L50 59 L36 68 L41 53 L29 44 L44 44 Z"
        fill="black"
        fillOpacity="0.22"
      />
      <path
        d="M50 28 L56.5 43 L72 43 L59.5 52.5 L64.5 68 L50 58.5 L35.5 68 L40.5 52.5 L28 43 L43.5 43 Z"
        fill="#EFE6D8"
        fillOpacity="0.9"
      />
    </svg>
  );
}
