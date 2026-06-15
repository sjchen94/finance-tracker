"use client";

import { type ClientFilter, DEFAULT_FILTER } from "./types";

export default function FilterBar({
  filter,
  onChange,
}: {
  filter: ClientFilter;
  onChange: (next: ClientFilter) => void;
}) {
  const set = <K extends keyof ClientFilter>(key: K, value: ClientFilter[K]) =>
    onChange({ ...filter, [key]: value });

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-black/10 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">RSI</span>
        <input
          type="number"
          value={filter.minRsi}
          min={0}
          max={100}
          step={1}
          onChange={(e) => set("minRsi", Number(e.target.value) || 0)}
          className="w-14 rounded border border-black/10 bg-transparent px-1.5 py-0.5 text-xs dark:border-white/15"
        />
        <span className="text-xs text-zinc-500">–</span>
        <input
          type="number"
          value={filter.maxRsi}
          min={0}
          max={100}
          step={1}
          onChange={(e) => set("maxRsi", Number(e.target.value) || 100)}
          className="w-14 rounded border border-black/10 bg-transparent px-1.5 py-0.5 text-xs dark:border-white/15"
        />
      </div>

      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">Moving averages</legend>
        <label className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={filter.above20d}
            onChange={(e) => set("above20d", e.target.checked)}
          />
          &gt; 20d
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={filter.above50d}
            onChange={(e) => set("above50d", e.target.checked)}
          />
          &gt; 50d
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={filter.above200d}
            onChange={(e) => set("above200d", e.target.checked)}
          />
          &gt; 200d
        </label>
      </fieldset>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="min-score">
          Min score
        </label>
        <input
          id="min-score"
          type="range"
          min={0}
          max={100}
          step={1}
          value={filter.minScore}
          onChange={(e) => set("minScore", Number(e.target.value))}
        />
        <span className="w-8 text-right font-mono text-xs">{filter.minScore}</span>
      </div>

      <label className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={filter.breakoutOnly}
          onChange={(e) => set("breakoutOnly", e.target.checked)}
        />
        ⚡ Breakouts only
      </label>

      <button
        onClick={() => onChange({ ...DEFAULT_FILTER })}
        className="ml-auto rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
      >
        Reset
      </button>
    </section>
  );
}
