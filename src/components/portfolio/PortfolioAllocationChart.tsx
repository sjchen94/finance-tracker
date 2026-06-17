"use client";

/**
 * SVG donut chart showing portfolio allocation by market value.
 * Pure React + SVG — no chart library required.
 */

const PALETTE = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#9333ea", // purple-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
  "#ea580c", // orange-600
  "#0d9488", // teal-600
  "#7c3aed", // violet-600
  "#be185d", // rose-700
];

type Slice = {
  ticker: string;
  value: number;
  pct: number;
  color: string;
};

function buildSlices(
  rows: Array<{ ticker: string; currentValue: number | null; totalCost: number }>,
): Slice[] {
  // Use current market value when available, fall back to cost basis
  const items = rows.map((r, i) => ({
    ticker: r.ticker,
    value: r.currentValue ?? r.totalCost,
    color: PALETTE[i % PALETTE.length]!,
  }));
  const total = items.reduce((s, r) => s + r.value, 0);
  if (total === 0) return [];
  return items.map((r) => ({ ...r, pct: (r.value / total) * 100 }));
}

/**
 * Compute SVG arc path for a donut slice.
 * cx/cy = center, r = outer radius, ir = inner radius (hole),
 * startAngle/endAngle in radians (0 = top, clockwise).
 */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  ir: number,
  startAngle: number,
  endAngle: number,
): string {
  const toXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  });

  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;

  const o1 = toXY(startAngle, r);
  const o2 = toXY(endAngle, r);
  const i1 = toXY(endAngle, ir);
  const i2 = toXY(startAngle, ir);

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${ir} ${ir} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

type PortfolioAllocationChartProps = {
  rows: Array<{
    ticker: string;
    currentValue: number | null;
    totalCost: number;
  }>;
};

export default function PortfolioAllocationChart({ rows }: PortfolioAllocationChartProps) {
  const slices = buildSlices(rows);

  if (slices.length === 0) return null;

  const SIZE = 200;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 88;
  const IR = 52; // inner radius — creates the "donut" hole
  const GAP = 0.018; // radians of gap between slices

  // Build cumulative angles
  type SliceArc = Slice & { startAngle: number; endAngle: number };
  const arcs: SliceArc[] = [];
  let cursor = 0;
  for (const s of slices) {
    const span = (s.pct / 100) * 2 * Math.PI - GAP;
    if (span > 0) {
      arcs.push({ ...s, startAngle: cursor, endAngle: cursor + span });
    }
    cursor += (s.pct / 100) * 2 * Math.PI;
  }

  const totalValue = slices.reduce((s, r) => s + r.value, 0);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Allocation</h2>
      </header>
      <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
        {/* Donut SVG */}
        <div className="shrink-0">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            width={SIZE}
            height={SIZE}
            aria-label="Portfolio allocation donut chart"
          >
            {arcs.map((arc) => (
              <path
                key={arc.ticker}
                d={arcPath(cx, cy, R, IR, arc.startAngle, arc.endAngle)}
                fill={arc.color}
                opacity={0.9}
              >
                <title>
                  {arc.ticker}: {arc.pct.toFixed(1)}% ({fmtCurrency(arc.value)})
                </title>
              </path>
            ))}
            {/* Center label */}
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-900 dark:fill-zinc-100"
              style={{ fontSize: 11, fontFamily: "monospace" }}
            >
              Total
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-900 dark:fill-zinc-100"
              style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}
            >
              {fmtCurrency(totalValue)}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0">
          <ul className="space-y-1.5">
            {slices
              .slice()
              .sort((a, b) => b.pct - a.pct)
              .map((s) => (
                <li key={s.ticker} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="font-mono font-semibold w-14 shrink-0">{s.ticker}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-zinc-500 w-10 text-right shrink-0">
                    {s.pct.toFixed(1)}%
                  </span>
                  <span className="font-mono text-zinc-400 w-20 text-right shrink-0 hidden sm:block">
                    {fmtCurrency(s.value)}
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[10px] text-zinc-400">
            {rows.some((r) => r.currentValue == null)
              ? "Some positions use cost basis (live price unavailable)"
              : "Based on current market value"}
          </p>
        </div>
      </div>
    </section>
  );
}
