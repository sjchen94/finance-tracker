"use client";

/**
 * Portfolio What-If / Rebalancing Scenario Simulator
 *
 * Shows a "Current vs Proposed" diff of allocation %, beta, vol, and Sharpe
 * when the user edits draft holdings. Uses the existing computeRiskMetrics()
 * from riskMetrics.ts — no new packages required.
 */

import { useCallback, useEffect, useId, useState } from "react";
import {
  computeRiskMetrics,
  type RiskMetrics,
} from "@/lib/portfolio/riskMetrics";

// ---- Types ----------------------------------------------------------------

type Holding = {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;
type CloseMap = Record<string, number[]>;

type DraftHolding = {
  id: string;
  ticker: string;
  shares: string; // string so the input stays editable
};

type MetricsDiff = {
  current: RiskMetrics;
  proposed: RiskMetrics;
};

// ---- Helpers ---------------------------------------------------------------

async function fetchCloses(symbol: string): Promise<number[]> {
  try {
    const res = await fetch(
      `/api/history?symbol=${encodeURIComponent(symbol)}&range=3mo&interval=1d`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { candles?: Array<{ close: number }> };
    return (data.candles ?? []).map((c) => c.close);
  } catch {
    return [];
  }
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

function fmtFixed(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}

function diffClass(a: number | null, b: number | null, higherIsBetter: boolean): string {
  if (a == null || b == null) return "text-zinc-500";
  const improved = higherIsBetter ? b > a : b < a;
  const worsened = higherIsBetter ? b < a : b > a;
  if (improved) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (worsened) return "text-red-600 dark:text-red-400 font-semibold";
  return "text-zinc-500";
}

// ---- Allocation bar -------------------------------------------------------

function AllocationBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ---- Main component -------------------------------------------------------

type ScenarioEditorProps = {
  holdings: Holding[];
  prices: PriceMap;
};

export default function ScenarioEditor({
  holdings,
  prices,
}: ScenarioEditorProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);

  // Draft state — initialised from current holdings
  const [draft, setDraft] = useState<DraftHolding[]>([]);
  // All fetched close data (current tickers + any new draft tickers)
  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [spyCloses, setSpyCloses] = useState<number[]>([]);
  const [loadingCloses, setLoadingCloses] = useState(false);

  // Target-weight mode
  const [targetMode, setTargetMode] = useState(false);
  const [targetWeights, setTargetWeights] = useState<Record<string, string>>({});

  const [diff, setDiff] = useState<MetricsDiff | null>(null);

  // Open → populate draft from live holdings and kick off close fetching
  function openEditor() {
    const initialDraft: DraftHolding[] = holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      shares: String(h.shares),
    }));
    setDraft(initialDraft);
    setTargetWeights(
      Object.fromEntries(initialDraft.map((d) => [d.id, ""])),
    );
    setOpen(true);
  }

  // Fetch closes for any new tickers in draft
  const fetchMissingCloses = useCallback(
    async (tickers: string[]) => {
      const allNeeded = [...new Set([...tickers, "SPY"])];
      const missing = allNeeded.filter((t) => !closeMap[t] && t !== "SPY" || (t === "SPY" && spyCloses.length === 0));
      if (missing.length === 0) return;
      setLoadingCloses(true);
      const entries = await Promise.all(
        missing.map((t) => fetchCloses(t).then((c) => [t, c] as const)),
      );
      const newSpy = entries.find(([t]) => t === "SPY")?.[1];
      if (newSpy && newSpy.length > 0) setSpyCloses(newSpy);
      setCloseMap((prev) => {
        const next = { ...prev };
        for (const [t, c] of entries) {
          if (t !== "SPY") next[t] = c;
        }
        return next;
      });
      setLoadingCloses(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Object.keys(closeMap).sort().join(","), spyCloses.length],
  );

  // Recompute diff whenever draft or close data changes
  useEffect(() => {
    if (!open) return;

    // Current metrics (from live holdings)
    const currentInput = holdings
      .map((h) => {
        const price = prices[h.ticker];
        if (price == null) return null;
        return {
          marketValue: price * h.shares,
          closes: closeMap[h.ticker] ?? [],
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.closes.length > 1);

    const currentMetrics =
      currentInput.length > 0
        ? computeRiskMetrics(currentInput, spyCloses)
        : { annualisedVolatility: null, sharpeRatio: null, maxDrawdown: null, beta: null };

    // Proposed metrics — from draft shares
    const proposedInput = draft
      .map((d) => {
        const sharesNum = parseFloat(d.shares);
        if (!Number.isFinite(sharesNum) || sharesNum <= 0) return null;
        const ticker = d.ticker.trim().toUpperCase();
        const price = prices[ticker];
        if (price == null) return null;
        return {
          marketValue: price * sharesNum,
          closes: closeMap[ticker] ?? [],
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.closes.length > 1);

    const proposedMetrics =
      proposedInput.length > 0
        ? computeRiskMetrics(proposedInput, spyCloses)
        : { annualisedVolatility: null, sharpeRatio: null, maxDrawdown: null, beta: null };

    setDiff({ current: currentMetrics, proposed: proposedMetrics });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, closeMap, spyCloses, open]);

  // Fetch closes when draft tickers change
  useEffect(() => {
    if (!open) return;
    const tickers = draft.map((d) => d.ticker.trim().toUpperCase()).filter(Boolean);
    void fetchMissingCloses(tickers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.map((d) => d.ticker).join(","), open]);

  // ---- Draft mutations -----

  function updateShares(id: string, value: string) {
    setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, shares: value } : d)));
  }

  function updateTicker(id: string, value: string) {
    setDraft((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ticker: value.toUpperCase() } : d)),
    );
  }

  function addDraftRow() {
    const newId = `draft-${Date.now()}`;
    setDraft((prev) => [...prev, { id: newId, ticker: "", shares: "" }]);
    setTargetWeights((prev) => ({ ...prev, [newId]: "" }));
  }

  function removeDraftRow(id: string) {
    setDraft((prev) => prev.filter((d) => d.id !== id));
    setTargetWeights((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // ---- Target-weight share calculator -----

  function applyTargetWeights() {
    // Compute total portfolio value from live prices
    const totalValue = draft.reduce((sum, d) => {
      const price = prices[d.ticker.trim().toUpperCase()] ?? 0;
      const shares = parseFloat(d.shares) || 0;
      return sum + price * shares;
    }, 0);
    if (totalValue <= 0) return;

    setDraft((prev) =>
      prev.map((d) => {
        const pct = parseFloat(targetWeights[d.id] ?? "");
        if (!Number.isFinite(pct) || pct <= 0) return d;
        const price = prices[d.ticker.trim().toUpperCase()];
        if (price == null || price <= 0) return d;
        const targetValue = (pct / 100) * totalValue;
        const newShares = (targetValue / price).toFixed(4);
        return { ...d, shares: newShares };
      }),
    );
  }

  // ---- Allocation table for proposed draft -----

  const draftRows = draft
    .map((d) => {
      const sharesNum = parseFloat(d.shares);
      const ticker = d.ticker.trim().toUpperCase();
      const price = prices[ticker] ?? null;
      const value = price != null && Number.isFinite(sharesNum) ? price * sharesNum : null;
      return { ...d, ticker, price, value };
    })
    .filter((r) => r.value != null && r.value > 0);

  const totalProposedValue = draftRows.reduce((s, r) => s + (r.value ?? 0), 0);

  if (!open) {
    return (
      <button
        onClick={openEditor}
        className="inline-flex items-center gap-1.5 rounded-md border border-black/15 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        ⚡ What-If Simulator
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">What-If Scenario Simulator</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={targetMode}
              onChange={(e) => setTargetMode(e.target.checked)}
              className="accent-violet-600"
            />
            Target weights
          </label>
          <button
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ✕ Close
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Draft holdings table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/10 text-zinc-500 dark:border-white/10">
                <th className="py-1.5 text-left font-medium pr-2">Ticker</th>
                <th className="py-1.5 text-right font-medium pr-2">Proposed Shares</th>
                {targetMode && (
                  <th className="py-1.5 text-right font-medium pr-2">Target %</th>
                )}
                <th className="py-1.5 text-right font-medium pr-2">Price</th>
                <th className="py-1.5 text-right font-medium pr-2">Proposed Value</th>
                <th className="py-1.5 text-right font-medium pr-2">Allocation</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {draft.map((d) => {
                const ticker = d.ticker.trim().toUpperCase();
                const price = prices[ticker] ?? null;
                const sharesNum = parseFloat(d.shares);
                const value =
                  price != null && Number.isFinite(sharesNum) && sharesNum > 0
                    ? price * sharesNum
                    : null;
                const pct =
                  value != null && totalProposedValue > 0
                    ? (value / totalProposedValue) * 100
                    : null;

                return (
                  <tr key={d.id}>
                    <td className="py-1.5 pr-2">
                      <input
                        id={`${uid}-ticker-${d.id}`}
                        type="text"
                        value={d.ticker}
                        onChange={(e) => updateTicker(d.id, e.target.value)}
                        placeholder="AAPL"
                        className="w-20 rounded border border-black/20 bg-zinc-50 px-1.5 py-1 font-mono text-xs uppercase dark:border-white/20 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <input
                        id={`${uid}-shares-${d.id}`}
                        type="number"
                        value={d.shares}
                        onChange={(e) => updateShares(d.id, e.target.value)}
                        placeholder="100"
                        min="0"
                        step="any"
                        className="w-24 rounded border border-black/20 bg-zinc-50 px-1.5 py-1 font-mono text-xs text-right dark:border-white/20 dark:bg-zinc-800"
                      />
                    </td>
                    {targetMode && (
                      <td className="py-1.5 pr-2 text-right">
                        <input
                          type="number"
                          value={targetWeights[d.id] ?? ""}
                          onChange={(e) =>
                            setTargetWeights((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          placeholder="25"
                          min="0"
                          max="100"
                          step="any"
                          className="w-16 rounded border border-black/20 bg-zinc-50 px-1.5 py-1 font-mono text-xs text-right dark:border-white/20 dark:bg-zinc-800"
                        />
                      </td>
                    )}
                    <td className="py-1.5 pr-2 text-right font-mono text-zinc-500">
                      {price != null ? `$${price.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono">
                      {value != null
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          }).format(value)
                        : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {pct != null ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="font-mono text-zinc-500 w-10 text-right">
                            {pct.toFixed(1)}%
                          </span>
                          <AllocationBar pct={pct} color="bg-violet-500" />
                        </div>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => removeDraftRow(d.id)}
                        className="text-zinc-400 hover:text-red-500"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={addDraftRow}
            className="rounded border border-black/15 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            + Add row
          </button>
          {targetMode && (
            <button
              onClick={applyTargetWeights}
              className="rounded border border-violet-400/40 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-900/20 dark:text-violet-300"
            >
              Apply target weights → shares
            </button>
          )}
        </div>

        {/* Current vs Proposed metrics diff */}
        {diff && (
          <div>
            <h3 className="mb-2 font-mono text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              Current vs Proposed
              {loadingCloses && (
                <span className="ml-2 normal-case font-normal text-zinc-400">
                  (loading price history…)
                </span>
              )}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-zinc-500 dark:border-white/10">
                    <th className="py-1.5 text-left font-medium pr-4">Metric</th>
                    <th className="py-1.5 text-right font-medium pr-4">Current</th>
                    <th className="py-1.5 text-right font-medium pr-4">Proposed</th>
                    <th className="py-1.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10 dark:divide-white/10">
                  {/* Annualised Vol — lower is better */}
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
                      Ann. Vol
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {fmtPct(diff.current.annualisedVolatility)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right font-mono ${diffClass(
                        diff.current.annualisedVolatility,
                        diff.proposed.annualisedVolatility,
                        false,
                      )}`}
                    >
                      {fmtPct(diff.proposed.annualisedVolatility)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-zinc-400">
                      {diff.current.annualisedVolatility != null &&
                      diff.proposed.annualisedVolatility != null
                        ? fmtPct(
                            diff.proposed.annualisedVolatility -
                              diff.current.annualisedVolatility,
                          )
                        : "—"}
                    </td>
                  </tr>
                  {/* Sharpe — higher is better */}
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
                      Sharpe
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {fmtFixed(diff.current.sharpeRatio)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right font-mono ${diffClass(
                        diff.current.sharpeRatio,
                        diff.proposed.sharpeRatio,
                        true,
                      )}`}
                    >
                      {fmtFixed(diff.proposed.sharpeRatio)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-zinc-400">
                      {diff.current.sharpeRatio != null && diff.proposed.sharpeRatio != null
                        ? fmtFixed(diff.proposed.sharpeRatio - diff.current.sharpeRatio)
                        : "—"}
                    </td>
                  </tr>
                  {/* Max Drawdown — higher (closer to 0) is better */}
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
                      Max DD
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {fmtPct(diff.current.maxDrawdown)}
                    </td>
                    <td
                      className={`py-1.5 pr-4 text-right font-mono ${diffClass(
                        diff.current.maxDrawdown,
                        diff.proposed.maxDrawdown,
                        true,
                      )}`}
                    >
                      {fmtPct(diff.proposed.maxDrawdown)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-zinc-400">
                      {diff.current.maxDrawdown != null && diff.proposed.maxDrawdown != null
                        ? fmtPct(diff.proposed.maxDrawdown - diff.current.maxDrawdown)
                        : "—"}
                    </td>
                  </tr>
                  {/* Beta — neutral (no preference) */}
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
                      Beta (SPY)
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono">
                      {fmtFixed(diff.current.beta)}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-zinc-500">
                      {fmtFixed(diff.proposed.beta)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-zinc-400">
                      {diff.current.beta != null && diff.proposed.beta != null
                        ? fmtFixed(diff.proposed.beta - diff.current.beta)
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">
              Green = improvement · Red = deterioration · Computed from 3-month price history
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
