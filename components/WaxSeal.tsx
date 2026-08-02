type WaxSealVariant = "ember" | "gold" | "sage";

const VARIANT_COLORS: Record<WaxSealVariant, string> = {
  ember: "#B8433A",
  gold: "#D4A73D",
  sage: "#7C9A82",
};

export function WaxSeal({
  variant = "ember",
  size = 36,
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
      <circle cx="50" cy="50" r="40" fill={color} />
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="black"
        strokeOpacity="0.15"
        strokeWidth="1.5"
      />
      <circle cx="50" cy="50" r="24" fill="black" fillOpacity="0.08" />
      <circle cx="50" cy="50" r="7" fill="#EFE6D8" fillOpacity="0.5" />
    </svg>
  );
}
