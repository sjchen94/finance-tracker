import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { ALL_TICKERS } from "@/lib/momentum/sectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

export type DividendTicker = {
  symbol: string;
  shortName: string | null;
  sector: string;
  /** Trailing 12-month dividend yield as a percentage, e.g. 2.5 for 2.5% */
  dividendYieldPct: number | null;
  /** Annual dividend per share (trailing) */
  trailingAnnualDividendRate: number | null;
  /** Next ex-dividend date (ISO date string YYYY-MM-DD), or null */
  exDividendDate: string | null;
  /** Last dividend pay date (ISO date string YYYY-MM-DD), or null */
  lastPayDate: string | null;
  /** Current price */
  price: number | null;
};

export type DividendsResponse = {
  tickers: DividendTicker[];
  generatedAt: number;
};

// Sector name lookup from ticker
import { TICKER_TO_SECTOR } from "@/lib/momentum/sectors";

export async function GET() {
  const results: DividendTicker[] = [];

  // Batch requests — fetch summaryDetail + price for each ticker
  await Promise.allSettled(
    ALL_TICKERS.map(async (symbol) => {
      try {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ["summaryDetail", "price"],
        });

        const sd = (summary.summaryDetail ?? {}) as Record<string, unknown>;
        const p = (summary.price ?? {}) as Record<string, unknown>;

        const rawYield = (sd["dividendYield"] ?? null) as number | null;
        const rawRate = (sd["trailingAnnualDividendRate"] ?? null) as number | null;
        const rawExDate = (sd["exDividendDate"] ?? null) as Date | null;
        const rawPayDate = (sd["lastDividendDate"] ?? null) as Date | null;
        const price = (p["regularMarketPrice"] ?? null) as number | null;
        const shortName = ((p["shortName"] ?? p["longName"] ?? null) as string | null);

        const sectorInfo = TICKER_TO_SECTOR[symbol];

        results.push({
          symbol,
          shortName,
          sector: sectorInfo?.name ?? "Unknown",
          dividendYieldPct:
            rawYield != null && rawYield > 0 ? parseFloat((rawYield * 100).toFixed(2)) : null,
          trailingAnnualDividendRate: rawRate != null && rawRate > 0 ? rawRate : null,
          exDividendDate:
            rawExDate instanceof Date
              ? rawExDate.toISOString().slice(0, 10)
              : null,
          lastPayDate:
            rawPayDate instanceof Date
              ? rawPayDate.toISOString().slice(0, 10)
              : null,
          price,
        });
      } catch {
        // silently skip failed tickers
      }
    }),
  );

  // Sort: paying dividends first (by yield desc), then non-payers
  results.sort((a, b) => {
    if (a.dividendYieldPct != null && b.dividendYieldPct != null) {
      return b.dividendYieldPct - a.dividendYieldPct;
    }
    if (a.dividendYieldPct != null) return -1;
    if (b.dividendYieldPct != null) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return NextResponse.json(
    { tickers: results, generatedAt: Date.now() } satisfies DividendsResponse,
    { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=300" } },
  );
}
