import type { DailyPoint } from '@/lib/stats/analytics';

/** Bars = reviews per day, line = retention (% not rated Again). Pure SVG, no chart library. */
export function DailyChart({ series }: { series: DailyPoint[] }) {
  const width = 600;
  const height = 180;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const innerH = height - padTop - padBottom;
  const maxTotal = Math.max(1, ...series.map((p) => p.total));
  const barW = (width - padX * 2) / series.length;

  const line = series
    .map((p, i) => {
      if (p.retention === null) return null;
      const x = padX + barW * i + barW / 2;
      const y = padTop + innerH * (1 - p.retention);
      return `${x},${y}`;
    })
    .filter((s): s is string => s !== null);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full"
      role="img"
      aria-label="Reviews per day and daily retention for the last 30 days"
      data-testid="daily-chart"
    >
      {[0.5, 0.9, 1].map((tick) => (
        <line
          key={tick}
          x1={padX}
          x2={width - padX}
          y1={padTop + innerH * (1 - tick)}
          y2={padTop + innerH * (1 - tick)}
          stroke="currentColor"
          strokeDasharray={tick === 0.9 ? '4 4' : undefined}
          className="text-stone-300 dark:text-stone-700"
          strokeWidth={1}
        />
      ))}
      {series.map((p, i) => {
        const h = (p.total / maxTotal) * innerH;
        return (
          <rect
            key={p.day}
            x={padX + barW * i + barW * 0.15}
            y={padTop + innerH - h}
            width={barW * 0.7}
            height={h}
            rx={2}
            className="fill-brand-300 dark:fill-brand-700"
          >
            <title>{`${p.day}: ${p.total} reviews${p.retention !== null ? `, ${Math.round(p.retention * 100)}% retention` : ''}`}</title>
          </rect>
        );
      })}
      {line.length > 1 && (
        <polyline
          points={line.join(' ')}
          fill="none"
          stroke="#2f9e78"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}
      {line.length === 1 && (
        <circle
          cx={Number(line[0].split(',')[0])}
          cy={Number(line[0].split(',')[1])}
          r={4}
          fill="#2f9e78"
        />
      )}
      {series.map((p, i) =>
        // Label every week and the last day, but never two labels within four days.
        i === series.length - 1 || (i % 7 === 0 && series.length - 1 - i >= 4) ? (
          <text
            key={`t-${p.day}`}
            x={padX + barW * i + barW / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-stone-500 text-[11px]"
          >
            {p.day.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
