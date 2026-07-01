"use client";

/**
 * Portfolio Goal Tracker
 *
 * Lets the user set a target portfolio value + target date. Projects
 * time-to-target using a future-value formula under three growth-rate
 * scenarios:
 *   - Current rate: trailing 3-month annualised return of the portfolio
 *   - Conservative: 6% p.a.
 *   - Aggressive: 10% p.a.
 *
 * Shows a progress bar, on-track/behind status vs the target date, and a
 * projected shortfall (or surplus) at the target date under the current-rate
 * scenario. Collapses to a one-line summary once a goal is set.
 *
 * Goal stored in localStorage. No new packages — uses computePortfolioPriceSeries()
 * from riskMetrics.ts for the trailing-return calc, same as PortfolioBenchmarkChart.
 */

import { useEffect, useState } from "react";
import { computePortfolioPriceSeries } from "@/lib/portfolio/riskMetrics";

// ---- Types -----------------------------------------------------------------

type Holding = {
  ticker: string;
  shares: number;
  costBasis: number;
};

type PriceMap = Record<string, number | null>;
type CloseMap = Record<string, number[]>;

type Goal = {
  targetValue: number;
  targetDate: string; // ISO yyyy-mm-dd
};

type GoalTrackerProps = {
  holdings: Holding[];
  prices: PriceMap;
  totalValue: number | null;
};

// ---- Constants ---------------------------------------------------------------

const STORAGE_KEY = "ft-portfolio-goal";
const CONSERVATIVE_RATE = 0.06;
const AGGRESSIVE_RATE = 0.1;

// ---- Helpers ---------------------------------------------------------------

function loadGoal(): Goal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Goal) : null;
  } catch {
    return null;
  }
}

function saveGoal(goal: Goal | null): void {
  try {
    if (goal) localStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

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

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

/** Years between now and an ISO date string. Can be negative if the date is past. */
function yearsUntil(dateIso: string): number {
  const target = new Date(dateIso).getTime();
  const now = Date.now();
  return (target - now) / (365.25 * 24 * 60 * 60 * 1000);
}

/** Future value of `pv` compounded annually at rate `r` for `years`. */
function futureValue(pv: number, r: number, years: number): number {
  if (years <= 0) return pv;
  return pv * Math.pow(1 + r, years);
}

/**
 * Years required to reach `target` from `pv` at annual rate `r`.
 * Returns null if unreachable (rate <= 0 and pv < target).
 */
function yearsToTarget(pv: number, target: number, r: number): number | null {
  if (pv <= 0) return null;
  if (pv >= target) return 0;
  if (r <= 0) return null;
  return Math.log(target / pv) / Math.log(1 + r);
}

function fmtYears(years: number | null): string {
  if (years == null) return "Not reachable at this rate";
  if (years <= 0) return "Already reached";
  if (years < 1) return `${Math.round(years * 12)} mo`;
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  if (m === 0) return `${y} yr`;
  if (m === 12) return `${y + 1} yr`;
  return `${y} yr ${m} mo`;
}

// ---- Component -------------------------------------------------------------

export default function GoalTracker({ holdings, prices, totalValue }: GoalTrackerProps) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [draftDate, setDraftDate] = useState("");

  const [closeMap, setCloseMap] = useState<CloseMap>({});
  const [loading, setLoading] = useState(false);

  // Load goal from localStorage on mount
  useEffect(() => {
    const g = loadGoal();
    setGoal(g);
    if (g) {
      setDraftValue(String(g.targetValue));
      setDraftDate(g.targetDate);
    }
  }, []);

  const activeTickers = [
    ...new Set(holdings.filter((h) => prices[h.ticker] != null).map((h) => h.ticker)),
  ];
  const fetchKey = activeTickers.slice().sort().join(",");

  useEffect(() => {
    if (activeTickers.length === 0) return;
    setLoading(true);
    Promise.all(activeTickers.map((t) => fetchCloses(t).then((c) => [t, c] as const)))
      .then((entries) => {
        const next: CloseMap = {};
        for (const [t, c] of entries) next[t] = c;
        setCloseMap(next);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  if (holdings.length === 0 || totalValue == null) return null;

  // Trailing 3-month annualised return of the portfolio
  const holdingsInput = holdings
    .map((h) => {
      const currentPrice = prices[h.ticker];
      if (currentPrice == null) return null;
      return {
        marketValue: currentPrice * h.shares,
        closes: closeMap[h.ticker] ?? [],
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.closes.length > 1);

  const portSeries = holdingsInput.length > 0 ? computePortfolioPriceSeries(holdingsInput) : null;

  let currentAnnualRate: number | null = null;
  if (portSeries && portSeries.length > 1) {
    const start = portSeries[0]!;
    const end = portSeries[portSeries.length - 1]!;
    const threeMonthReturn = end / start - 1;
    // Annualise a ~3-month trailing return: (1+r)^4 - 1
    currentAnnualRate = Math.pow(1 + threeMonthReturn, 4) - 1;
  }

  function startEditing() {
    setDraftValue(goal ? String(goal.targetValue) : "");
    setDraftDate(goal ? goal.targetDate : "");
    setEditing(true);
  }

  function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(draftValue);
    if (!Number.isFinite(val) || val <= 0 || !draftDate) return;
    const newGoal: Goal = { targetValue: val, targetDate: draftDate };
    setGoal(newGoal);
    saveGoal(newGoal);
    setEditing(false);
  }

  function clearGoal() {
    setGoal(null);
    saveGoal(null);
    setDraftValue("");
    setDraftDate("");
    setEditing(false);
  }

  // ---- No goal set yet: show setup prompt or form -----

  if (!goal || editing) {
    return (
      <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
          <h2 className="font-mono text-sm font-semibold">Goal Tracker</h2>
        </header>
        <div className="p-4">
          <form onSubmit={saveDraft} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Target value ($)</label>
              <input
                type="number"
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                placeholder="100000"
                min="1"
                step="any"
                className="w-36 rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm dark:border-white/20 dark:bg-zinc-800"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Target date</label>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="rounded border border-black/20 bg-zinc-50 px-2 py-1.5 font-mono text-sm dark:border-white/20 dark:bg-zinc-800"
                required
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {goal ? "Update goal" : "Set goal"}
            </button>
            {goal && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-black/15 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            )}
          </form>
          <p className="mt-2 text-[10px] text-zinc-400">
            Stored locally in your browser. Projections use your trailing 3-month annualised
            return, plus 6% conservative and 10% aggressive scenarios.
          </p>
        </div>
      </section>
    );
  }

  // ---- Goal set: progress + projections -----

  const progressPct = Math.min((totalValue / goal.targetValue) * 100, 100);
  const yearsRemaining = yearsUntil(goal.targetDate);

  const scenarios = [
    { label: "Current rate", rate: currentAnnualRate, key: "current" as const },
    { label: "Conservative (6%)", rate: CONSERVATIVE_RATE, key: "conservative" as const },
    { label: "Aggressive (10%)", rate: AGGRESSIVE_RATE, key: "aggressive" as const },
  ];

  // On-track check using current-rate projection
  const projectedAtTargetDate =
    currentAnnualRate != null && yearsRemaining > 0
      ? futureValue(totalValue, currentAnnualRate, yearsRemaining)
      : null;
  const shortfall =
    projectedAtTargetDate != null ? goal.targetValue - projectedAtTargetDate : null;
  const onTrack = shortfall != null ? shortfall <= 0 : null;

  const currentTimeToTarget =
    currentAnnualRate != null ? yearsToTarget(totalValue, goal.targetValue, currentAnnualRate) : null;

  return (
    <section className="rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="font-mono text-sm font-semibold">Goal Tracker</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={startEditing}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Edit
          </button>
          <button
            onClick={clearGoal}
            className="text-xs text-zinc-400 hover:text-red-500"
            title="Clear goal"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Summary line */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="font-mono font-semibold">{fmtCurrency(totalValue)}</span>{" "}
            <span className="text-zinc-400">of</span>{" "}
            <span className="font-mono font-semibold">{fmtCurrency(goal.targetValue)}</span>{" "}
            <span className="text-zinc-400">by</span>{" "}
            <span className="font-mono font-semibold">
              {new Date(goal.targetDate).toLocaleDateString()}
            </span>
          </p>
          {onTrack != null && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                onTrack
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/15 text-red-600 dark:text-red-400"
              }`}
            >
              {onTrack ? "On track" : "Behind"}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${
                progressPct >= 100 ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{progressPct.toFixed(1)}% of target</p>
        </div>

        {/* Shortfall/surplus projection */}
        {shortfall != null && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            At the current trailing rate ({currentAnnualRate != null ? fmtPct(currentAnnualRate) : "—"}
            {" "}p.a.), your portfolio is projected to be{" "}
            <span className="font-mono font-semibold">
              {fmtCurrency(projectedAtTargetDate ?? 0)}
            </span>{" "}
            by the target date —{" "}
            {shortfall > 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                a shortfall of {fmtCurrency(shortfall)}
              </span>
            ) : (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                a surplus of {fmtCurrency(-shortfall)}
              </span>
            )}
            .
          </p>
        )}

        {/* Scenario table */}
        <div>
          <h3 className="mb-2 font-mono text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Projected time to target {loading && <span className="normal-case font-normal text-zinc-400">(loading…)</span>}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/10 text-zinc-500 dark:border-white/10">
                  <th className="py-1.5 text-left font-medium pr-4">Scenario</th>
                  <th className="py-1.5 text-right font-medium pr-4">Annual rate</th>
                  <th className="py-1.5 text-right font-medium">Time to target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {scenarios.map((s) => {
                  const years = s.rate != null ? yearsToTarget(totalValue, goal.targetValue, s.rate) : null;
                  return (
                    <tr key={s.key}>
                      <td className="py-1.5 pr-4 font-medium text-zinc-600 dark:text-zinc-400">
                        {s.label}
                      </td>
                      <td className="py-1.5 pr-4 text-right font-mono">
                        {s.rate != null ? fmtPct(s.rate) : "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {s.rate == null ? "—" : fmtYears(years)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] text-zinc-400">
          Current rate = trailing 3-month annualised portfolio return, compounded. Not investment
          advice.
          {currentTimeToTarget == null && currentAnnualRate != null && currentAnnualRate <= 0 && (
            <> Current rate is flat or negative — target not reachable without a rate change.</>
          )}
        </p>
      </div>
    </section>
  );
}
