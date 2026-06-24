"use client";

import type { SectorData } from "./types";
import { scoreTier } from "./types";

// --- Squarified treemap layout ---

type Rect = { x: number; y: number; w: number; h: number };

type TreemapNode = {
  id: string;
  name: string;
  value: number; // area weight
  score: number;
  tickerCount: number;
  topTicker: string | null;
};

function squarify(
  nodes: TreemapNode[],
  rect: Rect,
): Array<TreemapNode & Rect> {
  if (nodes.length === 0) return [];
  const total = nodes.reduce((s, n) => s + n.value, 0);
  if (total === 0) return [];

  const result: Array<TreemapNode & Rect> = [];
  const sorted = [...nodes].sort((a, b) => b.value - a.value);
  layoutRow(sorted, rect, total, result);
  return result;
}

function layoutRow(
  nodes: TreemapNode[],
  rect: Rect,
  total: number,
  out: Array<TreemapNode & Rect>,
): void {
  if (nodes.length === 0) return;

  const area = rect.w * rect.h;
  const { x, y, w, h } = rect;
  const isWide = w >= h;

  // Find the best row split using squarify worst-ratio heuristic
  let rowNodes: TreemapNode[] = [];
  let rowSum = 0;
  let bestRatio = Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const candidate = nodes.slice(0, i + 1);
    const candidateSum = candidate.reduce((s, n) => s + n.value, 0);
    const rowLen = isWide ? w * (candidateSum / total) : h * (candidateSum / total);
    const ratio = candidate.reduce((worst, n) => {
      const cellSize = (area * n.value) / total;
      const cellDim = cellSize / rowLen;
      const r = Math.max(rowLen / cellDim, cellDim / rowLen);
      return Math.max(worst, r);
    }, 0);

    if (ratio < bestRatio) {
      bestRatio = ratio;
      rowNodes = candidate;
      rowSum = candidateSum;
    } else {
      break;
    }
  }

  // Layout the row
  let cursor = isWide ? x : y;
  const rowLen = isWide ? w * (rowSum / total) : h * (rowSum / total);
  for (const node of rowNodes) {
    const size = rowLen * (node.value / rowSum);
    if (isWide) {
      out.push({ ...node, x: cursor, y, w: rowLen, h: size });
      cursor += size;
    } else {
      out.push({ ...node, x, y: cursor, w: size, h: rowLen });
      cursor += size;
    }
  }

  // Recurse on remaining nodes with the trimmed rect
  const remaining = nodes.slice(rowNodes.length);
  if (remaining.length === 0) return;

  const remainingTotal = total - rowSum;
  const newRect: Rect = isWide
    ? { x: x + rowLen, y, w: w - rowLen, h }
    : { x, y: y + rowLen, w, h: h - rowLen };

  layoutRow(remaining, newRect, remainingTotal, out);
}

// --- Color mapping by score ---

function scoreColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) return { bg: "#16a34a", text: "#f0fdf4", border: "#14532d" };
  if (score >= 65) return { bg: "#22c55e", text: "#052e16", border: "#15803d" };
  if (score >= 50) return { bg: "#71717a", text: "#fafafa", border: "#3f3f46" };
  if (score >= 35) return { bg: "#f59e0b", text: "#1c1917", border: "#92400e" };
  return { bg: "#ef4444", text: "#fff1f2", border: "#991b1b" };
}

// --- Component ---

type Props = {
  sectors: SectorData[];
};

const CANVAS_W = 600;
const CANVAS_H = 300;

export default function SectorTreemap({ sectors }: Props) {
  if (sectors.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-zinc-500">
        No sector data available.
      </div>
    );
  }

  // Build nodes — weight by ticker count so each sector gets fair area
  const nodes: TreemapNode[] = sectors.map((s) => ({
    id: s.id,
    name: s.name,
    value: Math.max(1, s.tickers.length),
    score: s.averageScore,
    tickerCount: s.tickers.length,
    topTicker: [...s.tickers].sort((a, b) => b.score - a.score)[0]?.symbol ?? null,
  }));

  const laid = squarify(nodes, { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H });

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold tracking-tight">Sector Heatmap</h2>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          {/* Legend */}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#16a34a" }} />
            Strong
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#22c55e" }} />
            Solid
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#71717a" }} />
            Neutral
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#f59e0b" }} />
            Weak
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />
            Bearish
          </span>
        </div>
      </header>

      <div className="px-4 py-4">
        <svg
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="w-full rounded-md"
          aria-label="Sector momentum heatmap"
          style={{ maxHeight: "280px" }}
        >
          {laid.map((node) => {
            const colors = scoreColor(node.score);
            const tier = scoreTier(node.score);
            const PAD = 2;
            const rx = node.x + PAD;
            const ry = node.y + PAD;
            const rw = Math.max(0, node.w - PAD * 2);
            const rh = Math.max(0, node.h - PAD * 2);

            // Determine font sizes based on available space
            const showName = rw > 44 && rh > 28;
            const showScore = rw > 30 && rh > 18;
            const showTicker = rw > 60 && rh > 50;
            const nameFontSize = Math.min(13, Math.max(8, rw / 7));
            const scoreFontSize = Math.min(11, Math.max(7, rw / 9));

            const cx = rx + rw / 2;
            const cy = ry + rh / 2;

            return (
              <g key={node.id}>
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  rx={4}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={0.5}
                />
                {showName && (
                  <text
                    x={cx}
                    y={showTicker ? cy - 10 : showScore ? cy - 6 : cy + nameFontSize / 3}
                    textAnchor="middle"
                    fontSize={nameFontSize}
                    fontFamily="monospace"
                    fontWeight="600"
                    fill={colors.text}
                    style={{ userSelect: "none" }}
                  >
                    {node.name}
                  </text>
                )}
                {showTicker && node.topTicker && (
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fontSize={scoreFontSize}
                    fontFamily="monospace"
                    fill={colors.text}
                    opacity={0.8}
                    style={{ userSelect: "none" }}
                  >
                    {node.topTicker}
                  </text>
                )}
                {showScore && (
                  <text
                    x={cx}
                    y={showTicker ? cy + 16 : showName ? cy + 10 : cy + scoreFontSize / 3}
                    textAnchor="middle"
                    fontSize={scoreFontSize}
                    fontFamily="monospace"
                    fill={colors.text}
                    opacity={0.85}
                    style={{ userSelect: "none" }}
                  >
                    {node.score.toFixed(0)} · {tier.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <p className="mt-2 text-[10px] text-zinc-400">
          Area = # tickers · Color = avg momentum score · Top ticker shown per sector
        </p>
      </div>
    </section>
  );
}
