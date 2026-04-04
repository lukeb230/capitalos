"use client";

interface Props {
  ratio: number; // 0-100 percentage
}

// Convert a percentage (0-100) to an SVG point on the arc
// Arc goes from 180° (left) to 0° (right), center at (100, 100), radius 80
function percentToPoint(pct: number, radius: number = 80): { x: number; y: number } {
  const angle = ((100 - pct) / 100) * Math.PI; // 0% = π (left), 100% = 0 (right)
  return {
    x: 100 + radius * Math.cos(angle),
    y: 100 - radius * Math.sin(angle),
  };
}

// Build an SVG arc path from one percentage to another
function arcPath(fromPct: number, toPct: number, radius: number = 80): string {
  const start = percentToPoint(fromPct, radius);
  const end = percentToPoint(toPct, radius);
  const sweep = toPct - fromPct;
  const largeArc = sweep > 50 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function DTIGauge({ ratio }: Props) {
  const clampedRatio = Math.min(100, Math.max(0, ratio));

  const color =
    clampedRatio <= 36
      ? "#22c55e"
      : clampedRatio <= 43
      ? "#f59e0b"
      : clampedRatio <= 50
      ? "#f97316"
      : "#ef4444";

  const label =
    clampedRatio <= 36
      ? "Healthy"
      : clampedRatio <= 43
      ? "Acceptable"
      : clampedRatio <= 50
      ? "High"
      : "Critical";

  // Needle position
  const needle = percentToPoint(clampedRatio, 80);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
        {/* Background arc segments — all computed from same math */}
        <path d={arcPath(0, 36)} fill="none" stroke="#22c55e" strokeWidth="12" strokeLinecap="round" opacity={0.2} />
        <path d={arcPath(36, 43)} fill="none" stroke="#f59e0b" strokeWidth="12" opacity={0.2} />
        <path d={arcPath(43, 50)} fill="none" stroke="#f97316" strokeWidth="12" opacity={0.2} />
        <path d={arcPath(50, 100)} fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" opacity={0.2} />

        {/* Active arc — same math, guaranteed to align */}
        {clampedRatio > 0.5 && (
          <path
            d={arcPath(0, clampedRatio)}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}

        {/* Needle dot */}
        <circle cx={needle.x} cy={needle.y} r="6" fill={color} />
        <circle cx={needle.x} cy={needle.y} r="3" fill="white" />

        {/* Center text */}
        <text x="100" y="90" textAnchor="middle" className="text-2xl font-bold" fill={color} fontSize="28">
          {clampedRatio.toFixed(0)}%
        </text>
        <text x="100" y="110" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="11">
          {label}
        </text>

        {/* Scale labels */}
        <text x="18" y="115" fill="hsl(var(--muted-foreground))" fontSize="9">0%</text>
        <text x="172" y="115" fill="hsl(var(--muted-foreground))" fontSize="9">100%</text>
      </svg>
    </div>
  );
}
