"use client";

/**
 * Tax-Loss Harvesting Scanner
 *
 * Flags holdings whose unrealised loss exceeds a threshold (default -10%)
 * using the cost-basis data already captured for each position. Surfaces
 * the estimated harvestable loss (cost - market value) per flagged lot.
 *
 * Wash-sale (IRS 30-day rule) caveat: this app does not record purchase
 * dates, only shares + average cost basis, so we cannot detect an actual
 * 30-day buy/sell conflict. Instead we surface a conservative warning for
 * any ticker held across multiple lots (multiple entries in the holdings
 * list), since harvesting one lot while still holding — or having recently
 * added to — another lot of the same security is exactly the situation a
 * wash sale can arise from. Treat it as a prompt to check your real trade
 * dates, not a definitive violation.
 *
 * No new packages — reuses the holdings/prices already loaded by
 * PortfolioTracker, same pattern as PriceAlerts.tsx.
 */

import { useState } from "react";

// ---- Types -----------------------------------------------------------------

type Holding = {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number; // per share
};

type PriceMap = Record<string, number | null>;

type TaxLossHarvestingProps = {
  holdings: Holding[];
  prices: PriceMap;
};

// ---- Helpers ---------------------------------------------------------------

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

const DEFAULT_THRESHOLD_PCT = 10; // flag losses worse than -10%

// ---- Component -------------------------------------------------------------

export default function TaxLossHarvesting({ holdings, prices }: TaxLossHarvestingProps) {
  const [thresholdPct, setThresholdPct] = useState(DEFAULT_THRESHOLD_PCT);

  if (holdings.length === 0) return null;

  // Count lots per ticker to power the wash-sale heads-up.
  const lotCounts = new Map<string, number>();
  for (const h of holdings) {
    lotCounts.set(h.ticker, (lotCounts.get(h.ticker) ?? 0) + 1);
  }

  const candidates = holdings
    .map((h) => {
      const price = prices[h.ticker];
      if (price == null || h.costBasis <= 0) return null;
      const lossPct = ((price - h.costBasis) / h.costBasis) * 100;
      const costValue = h.costBasis * h.shares;
      const marketValue = price * h.shares;
      const harvestableLoss = costValue - marketValue; // positive = a loss
      return {
        id: h.id,
        ticker: h.ticker,
        shares: h.shares,
        costBasis: h.costBasis,
        price,
        lossPct,
        harvestableLoss,
        multiLot: (lotCounts.get(h.ticker) ?? 0) > 1,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.lossPct <= -thresholdPct)
    .sort((a, b) => b.harvestableLoss - a.harvestableLoss);

  const totalHarvestable = candidates.reduce((s, c) => s + c.harvestableLoss, 0);

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Tax-Loss Harvesting Scanner</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Flag losses worse than</label>
          <input
            type="number"
            min={1}
            max={90}
            step={1}
            value={thresholdPct}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v) && v > 0) setThresholdPct(v);
            }}
            className="w-14 rounded border border-black/20 bg-zinc-50 px-1.5 py-1 text-right font-mono text-xs dark:border-white/20 dark:bg-zinc-800"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </header>

      <div className="p-4">
        {candidates.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No positions are down more than {thresholdPct}% from cost basis. Nothing to harvest
            right now.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                {candidates.length}
              </span>{" "}
              position{candidates.length === 1 ? "" : "s"} eligible, up to{" "}
              <span className="font-mono font-semibold">{fmtCurrency(totalHarvestable)}</span>{" "}
              in harvestable losses.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-zinc-500 dark:border-white/10">
                    <th className="py-1.5 text-left font-medium pr-4">Ticker</th>
                    <th className="py-1.5 text-right font-medium pr-4">Cost basis</th>
                    <th className="py-1.5 text-right font-medium pr-4">Price</th>
                    <th className="py-1.5 text-right font-medium pr-4">Loss %</th>
                    <th className="py-1.5 text-right font-medium">Harvestable loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {candidates.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5 pr-4 font-mono font-semibold">
                        {c.ticker}
                        {c.multiLot && (
                          <span
                            title="Multiple lots of this ticker are held — check your actual trade dates before selling to avoid a wash sale (IRS disallows the loss if you buy the same or a substantially identical security within 30 days before/after the sale)."
                            className="ml-1 cursor-help rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                          >
                            wash-sale risk
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-mono">
                        {fmtCurrency(c.costBasis)}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-mono">{fmtCurrency(c.price)}</td>
                      <td className="py-1.5 pr-4 text-right font-mono font-semibold text-red-600 dark:text-red-400">
                        {fmtPct(c.lossPct)}
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold">
                        {fmtCurrency(c.harvestableLoss)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-3 text-[10px] text-zinc-400">
          Wash-sale check is approximate: this app tracks average cost basis, not individual trade
          dates, so &quot;wash-sale risk&quot; only flags tickers held across multiple lots — verify
          actual purchase dates before selling. Not tax advice.
        </p>
      </div>
    </section>
  );
}
