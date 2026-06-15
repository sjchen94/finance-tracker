# Daily Automated Screener — Coder Brief

Researcher: `finance-tracker-charts-researcher` · Locked 2026-05-10

## Goal

Daily automated screener that posts a 9am ET Discord digest with three ranked lists derived from a S&P 1500 universe.

## Scope of v1

- Standalone Node/TS script invoked by host cron — no Next.js dev server dependency.
- Stays in current stack (Next.js 16 / React 19 / TS, port 3001). No Python sidecar; `yahoo-finance2` v3.14 is sufficient.
- Reuses existing `MarketDataProvider` interface (`src/lib/providers/types.ts`) and `cache.ts`.

## Architecture

```
~/projects/finance-tracker/
├── data/
│   └── sp1500.csv                       # checked-in; refreshed by scripts/refresh-universe.ts
├── scripts/
│   ├── screener.ts                      # cron entrypoint
│   └── refresh-universe.ts              # quarterly: pulls iShares IVV+IJH+IJR holdings → sp1500.csv
├── src/
│   ├── lib/
│   │   └── screener/
│   │       ├── universe.ts              # load sp1500.csv → ticker list
│   │       ├── fetcher.ts               # batched quote() → mkt-cap filter → chart()+quoteSummary() for survivors
│   │       ├── signals/                 # one pure fn per signal, (snapshot) → { matched, value }
│   │       │   ├── technical/{rsiSweet,macdCross,breakout20d,volSurge,aboveSma50}.ts
│   │       │   └── fundamental/{peUnder,roeAbove,deBelow,growth5y,fcfPositive}.ts
│   │       ├── score.ts                 # z-score normalize + composite weighting
│   │       ├── runner.ts                # orchestrates fetch → snapshot → rank → write
│   │       ├── db.ts                    # better-sqlite3 wrapper, migrations
│   │       └── notify.ts                # Discord webhook poster
│   └── app/
│       ├── api/screener/{today,history}/route.ts
│       └── screener/page.tsx            # dashboard
└── package.json
    # add: "screener": "tsx scripts/screener.ts",
    #      "screener:refresh-universe": "tsx scripts/refresh-universe.ts"
    # devDeps: tsx, better-sqlite3, @types/better-sqlite3
```

## Schedule

- **Cron: `30 8 * * 1-5`** (08:30 ET Mon–Fri) — 30min buffer before 9am ET digest delivery.
- Holiday detection: if SPY has no candle for today's ET trading date, mark run `skipped:holiday`, no Discord ping.
- Idempotence: keyed by ET trading date in `runs` table; re-run aborts unless `--force`.

## Data flow

1. Load S&P 1500 ticker list from `data/sp1500.csv` (~1505 names).
2. **Cheap first pass:** `yahooFinance.quote(symbols, { fields: ['marketCap','regularMarketPrice','regularMarketChangePercent'] })` in batches of 25 → filter to mkt cap > $100M.
3. **Survivor pass:** for each remaining symbol, fetch in parallel (concurrency 8, 200ms stagger):
   - `chart(symbol, { period1: -260d, interval: '1d' })` for SMA200 warmup
   - `quoteSummary(symbol, { modules: ['summaryDetail','financialData','defaultKeyStatistics'] })` for fundamentals
4. Compute snapshot row (all metrics) for each symbol, persist to `snapshots`.
5. Run signal modules → boolean+value per signal per symbol.
6. Score each list, persist top-N to `ranks`.
7. Render Discord embed, POST to webhook.
8. Write JSON dump to `~/.openclaw/finance-tracker/screener/runs/<YYYY-MM-DD>.json`.

## Rate-limit / failure handling

- Concurrency 8, 200ms stagger between request starts.
- Exp backoff on 429/5xx (3 retries: 500ms / 2s / 8s).
- Abort run if >10% of survivor symbols error after retries → mark `failed:upstream`, ping #orchestrator-control.
- Reuse `cache.ts` (already (symbol, range, interval)-keyed) — 12h TTL, free hits across signals within a run.

## Three lists

### 🎯 Top 10 Composite Buys
Blended z-score across all 10 metrics (5 technical + 5 fundamental). z-score normalize within universe, then weighted sum: 50% technical component + 50% fundamental component. Tickers can rank well without being best-in-class on any axis.

### 📈 Top 5 Short-term Momentum (technical only)
Signals (each pure fn over candles):
1. **breakout20d** — close > rolling 20d high (excluding today)
2. **volSurge** — today's vol > 2× 20d avg vol
3. **rsiSweet** — RSI(14) ∈ [50, 70] (in trend, not overbought)
4. **macdCross** — MACD signal-line cross + histogram > 0
5. **aboveSma50** — close > SMA50

Score = matched count; tie-break by 5d return.

### 🏛 Top 5 Long-term Value (fundamental only)
Signals (each pure fn over `quoteSummary` data):
1. **peUnder** — trailing P/E < 20
2. **roeAbove** — return on equity > 15%
3. **deBelow** — debt/equity < 1.0
4. **growth5y** — 5y earnings growth > 5%
5. **fcfPositive** — free cash flow > 0

Score = matched count; tie-break by lowest P/E.

A symbol may appear in multiple lists — that's intentional signal concentration.

## DB schema

```sql
CREATE TABLE runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,           -- ET trading date YYYY-MM-DD
  status       TEXT NOT NULL,                  -- 'running'|'succeeded'|'skipped:holiday'|'failed:upstream'
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  universe_size INTEGER,
  version      TEXT NOT NULL                   -- e.g. 'v1.0'
);

CREATE TABLE snapshots (
  run_id        INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  sector        TEXT,
  mkt_cap       REAL,
  close         REAL,
  vol           INTEGER,
  day_change_pct REAL,
  sma20 REAL, sma50 REAL, sma200 REAL,
  rsi14 REAL, macd_hist REAL, vol_avg20 REAL,
  return_5d REAL,
  pe REAL, roe REAL, de REAL, growth_5y REAL, fcf REAL,
  PRIMARY KEY (run_id, symbol)
);

CREATE TABLE ranks (
  run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL,
  list_type       TEXT NOT NULL,             -- 'composite'|'momentum'|'value'
  rank            INTEGER NOT NULL,
  score           REAL NOT NULL,
  components_json TEXT NOT NULL,             -- which signals matched, raw values
  PRIMARY KEY (run_id, symbol, list_type)
);

CREATE INDEX idx_ranks_list_rank ON ranks(list_type, run_id, rank);
```

DB path: `~/.openclaw/finance-tracker/screener.db` (matches stebot ecosystem convention; keeps project repo clean).

## Delivery

- Discord webhook URL stored in `process.env.SCREENER_DISCORD_WEBHOOK` (read from `~/stebot/.env` per existing convention).
- New **#screener** channel under 📊 finance-tracker-charts category — orchestrator to create.
- Embed format:
  - One embed with three fields (Composite / Momentum / Value), each listing tickers as `[AAPL](http://localhost:3001/ticker/AAPL)` (or prod URL).
  - Footer: `run #{id} · {universe_size} symbols scanned · view: /screener?date=YYYY-MM-DD`
- Empty days: still post digest with "No signals matched today across all three lists" (visibility > silence).

## Dashboard (Next.js)

- `GET /api/screener/today` → today's run with all three lists + snapshot data
- `GET /api/screener/history?limit=30` → last 30 runs (id, date, hit counts per list)
- `/screener` page → today's three lists, calendar of past runs
- `/screener?date=YYYY-MM-DD` → permalink for a specific run
- Reuse existing `PriceChart` for click-through on any ranked symbol

## 5-day build

| Day | Deliverable |
|-----|-------------|
| 1 | sqlite schema + migrations + db wrapper; signal modules (5 technical + 5 fundamental) as pure fns + unit tests; z-score utility |
| 2 | universe loader (sp1500.csv parser + iShares refresh script); batched fetcher with concurrency limiter + retry/backoff |
| 3 | runner glue (fetch → snapshot → rank → persist) + idempotence + JSON dump; CLI entrypoint with `--force` flag |
| 4 | Discord webhook poster + #screener channel + cron install + first end-to-end smoke run |
| 5 | `/screener` dashboard page + `/api/screener/{today,history}` + home page link |

## Risks

- **Yahoo unofficial rate limit** — concurrency 8, 200ms stagger, exp-backoff, abort >10% errors. Worst case: fall back to second provider via existing `MarketDataProvider` abstraction.
- **iShares CSV format drift** — refresh script needs schema validation + alert on parse failure.
- **`quoteSummary` field gaps** — small/midcaps often missing fundamentals; treat missing as "signal not matched" rather than excluding the symbol from all lists.
- **Pre-market holidays / half-days** — half-days (1pm ET close) still produce daily candles; cron runs as normal next morning. Full holidays detected via SPY check.

## Defaults locked

- Composite + per-list lean: ✅ approved 2026-05-10
- Data source: yahoo-finance2 (Node, no Python sidecar) — ✅ approved 2026-05-10
- Delivery: 9am ET pre-market digest, 8:30 ET cron — ✅
- Universe: S&P 1500 from iShares ETF holdings, mkt cap > $100M post-filter — ✅
- All 6 prior open decisions: ✅ default per recommendation
