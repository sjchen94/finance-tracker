import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const runtime = "nodejs";
export const revalidate = 30;

type RawQuote = {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  currency?: string;
  marketState?: string;
  fullExchangeName?: string;
  exchange?: string;
};

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get("symbols");
  if (!symbolsParam) {
    return NextResponse.json({ error: "missing symbols" }, { status: 400 });
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "no valid symbols" }, { status: 400 });
  }

  // Fetch the whole batch first; if Yahoo rejects the batch outright (e.g. one
  // invalid/delisted symbol in the list), fall back to per-symbol requests so a
  // single bad ticker doesn't 500 out quotes for the rest of the watchlist.
  let list: RawQuote[];
  try {
    const results = (await yahooFinance.quote(symbols)) as unknown as
      | RawQuote
      | RawQuote[];
    list = Array.isArray(results) ? results : [results];
  } catch {
    const settled = await Promise.allSettled(
      symbols.map((s) => yahooFinance.quote(s) as unknown as Promise<RawQuote>),
    );
    list = settled
      .filter((r): r is PromiseFulfilledResult<RawQuote> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  const quotes = list.map((q) => ({
    symbol: q.symbol,
    shortName: q.shortName ?? q.longName ?? q.symbol,
    price: q.regularMarketPrice ?? null,
    change: q.regularMarketChange ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
    currency: q.currency ?? "USD",
    marketState: q.marketState ?? null,
    exchange: q.fullExchangeName ?? q.exchange ?? null,
  }));

  const failedSymbols = symbols.filter(
    (s) => !quotes.some((q) => q.symbol === s),
  );

  return NextResponse.json({ quotes, failedSymbols });
}
