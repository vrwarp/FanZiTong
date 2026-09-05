/** Circular gauge for mean retrievability with the target retention marked. */
export function RetentionGauge({
  value,
  target,
  size = 140,
}: {
  /** 0-1 or null when there is no reviewed card yet. */
  value: number | null;
  /** 0-1 */
  target: number;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value ?? 0;
  const dash = circumference * pct;
  const targetAngle = -90 + 360 * target;
  const color =
    value === null
      ? '#a8a29e'
      : pct >= target
        ? '#2f9e78'
        : pct >= target - 0.1
          ? '#e0a22e'
          : '#d13c3c';
  const label = value === null ? '—' : `${Math.round(pct * 100)}%`;

  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="retention-gauge">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Recall now ${label}, target ${Math.round(target * 100)}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-stone-200 dark:text-stone-700"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <line
          x1={size / 2}
          y1={stroke / 2 - 2}
          x2={size / 2}
          y2={stroke + 4}
          stroke="currentColor"
          strokeWidth={2}
          className="text-stone-700 dark:text-stone-200"
          transform={`rotate(${targetAngle + 90} ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold" data-testid="retention-value">
          {label}
        </span>
        <span className="text-[10px] font-semibold text-stone-500 uppercase">recall</span>
      </div>
    </div>
  );
}
