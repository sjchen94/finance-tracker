import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

/**
 * Portfolio Dividend Income API
 *
 * Given a comma-separated list of tickers the user actually holds, fetches
 * trailing dividend yield + annual dividend rate + next ex-dividend date for
 * each. Unlike /api/dividends (which covers the fixed momentum sector
 * universe), this endpoint accepts arbitrary symbols so it can back a
 * per-holding "projected income" view for the Portfolio Tracker.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yahooFinance = new YahooFinance();

export type PortfolioDividendInfo = {
  symbol: string;
  /** Trailing 12-month dividend yield as a percentage, e.g. 2.5 for 2.5% */
  dividendYieldPct: number | null;
  /** Annual dividend per share (trailing) */
  annualDividendPerShare: number | null;
  /** Next ex-dividend date (ISO date string YYYY-MM-DD), or null */
  exDividendDate: string | null;
};

export type PortfolioDividendsResponse = {
  dividends: PortfolioDividendInfo[];
};

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "missing symbols" }, { status: 400 });
  }

  const symbols = [
    ...new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9.\-=^]+$/.test(s)),
    ),
  ].slice(0, 30);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "no valid symbols" }, { status: 400 });
  }

  const dividends: PortfolioDividendInfo[] = [];

  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const summary = await yahooFinance.quoteSummary(symbol, {
          modules: ["summaryDetail"],
        });
        const sd = (summary.summaryDetail ?? {}) as Record<string, unknown>;

        const rawYield = (sd["dividendYield"] ?? null) as number | null;
        const rawRate = (sd["trailingAnnualDividendRate"] ?? null) as number | null;
        const rawExDate = (sd["exDividendDate"] ?? null) as Date | null;

        dividends.push({
          symbol,
          dividendYieldPct:
            rawYield != null && rawYield > 0 ? parseFloat((rawYield * 100).toFixed(2)) : null,
          annualDividendPerShare: rawRate != null && rawRate > 0 ? rawRate : null,
          exDividendDate:
            rawExDate instanceof Date ? rawExDate.toISOString().slice(0, 10) : null,
        });
      } catch {
        dividends.push({
          symbol,
          dividendYieldPct: null,
          annualDividendPerShare: null,
          exDividendDate: null,
        });
      }
    }),
  );

  return NextResponse.json(
    { dividends } satisfies PortfolioDividendsResponse,
    { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=300" } },
  );
}
