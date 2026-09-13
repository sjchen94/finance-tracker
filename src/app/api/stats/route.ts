import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

export const runtime = "nodejs";
// Cache for 15 minutes — fundamentals don't change intraday
export const revalidate = 900;

const yahooFinance = new YahooFinance();

export type TickerStats = {
  symbol: string;
  shortName: string | null;
  longName: string | null;
  // Price / market data
  marketCap: number | null;
  enterpriseValue: number | null;
  sharesOutstanding: number | null;
  // Valuation
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  priceToSalesTrailing12Months: number | null;
  // Earnings
  trailingEps: number | null;
  forwardEps: number | null;
  // Profitability
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  profitMargins: number | null;
  // Growth
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  // Range / liquidity
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyDayAverage: number | null;
  twoHundredDayAverage: number | null;
  averageVolume: number | null;
  averageVolume10Day: number | null;
  // Dividend
  dividendYield: number | null;
  exDividendDate: string | null;
  // Financial health
  totalDebt: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  totalCash: number | null;
  freeCashflow: number | null;
  // Analyst
  targetMeanPrice: number | null;
  numberOfAnalystOpinions: number | null;
  recommendationMean: number | null;
  recommendationKey: string | null;
  // Sector / industry
  sector: string | null;
  industry: string | null;
  website: string | null;
  longBusinessSummary: string | null;
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9.\-=^]+$/.test(symbol)) {
    return NextResponse.json({ error: "missing or invalid symbol" }, { status: 400 });
  }

  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: [
        "price",
        "summaryDetail",
        "financialData",
        "defaultKeyStatistics",
        "assetProfile",
      ],
    });

    const p = result.price ?? {};
    const sd = result.summaryDetail ?? {};
    const fd = result.financialData ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const ap = result.assetProfile ?? {};

    const stats: TickerStats = {
      symbol,
      shortName: (p as { shortName?: string }).shortName ?? null,
      longName: (p as { longName?: string }).longName ?? null,
      // Market data
      marketCap: (p as { marketCap?: number }).marketCap ?? (sd as { marketCap?: number }).marketCap ?? null,
      enterpriseValue: (ks as { enterpriseValue?: number }).enterpriseValue ?? null,
      sharesOutstanding: (ks as { sharesOutstanding?: number }).sharesOutstanding ?? null,
      // Valuation
      trailingPE: (sd as { trailingPE?: number }).trailingPE ?? (ks as { trailingPE?: number }).trailingPE ?? null,
      forwardPE: (sd as { forwardPE?: number }).forwardPE ?? null,
      priceToBook: (ks as { priceToBook?: number }).priceToBook ?? null,
      priceToSalesTrailing12Months: (sd as { priceToSalesTrailing12Months?: number }).priceToSalesTrailing12Months ?? null,
      // Earnings
      trailingEps: (ks as { trailingEps?: number }).trailingEps ?? null,
      forwardEps: (ks as { forwardEps?: number }).forwardEps ?? null,
      // Profitability
      returnOnEquity: (fd as { returnOnEquity?: number }).returnOnEquity ?? null,
      returnOnAssets: (fd as { returnOnAssets?: number }).returnOnAssets ?? null,
      profitMargins: (fd as { profitMargins?: number }).profitMargins ?? (ks as { profitMargins?: number }).profitMargins ?? null,
      // Growth
      revenueGrowth: (fd as { revenueGrowth?: number }).revenueGrowth ?? null,
      earningsGrowth: (fd as { earningsGrowth?: number }).earningsGrowth ?? null,
      // Range / liquidity
      fiftyTwoWeekHigh: (sd as { fiftyTwoWeekHigh?: number }).fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: (sd as { fiftyTwoWeekLow?: number }).fiftyTwoWeekLow ?? null,
      fiftyDayAverage: (sd as { fiftyDayAverage?: number }).fiftyDayAverage ?? null,
      twoHundredDayAverage: (sd as { twoHundredDayAverage?: number }).twoHundredDayAverage ?? null,
      averageVolume: (sd as { averageVolume?: number }).averageVolume ?? null,
      averageVolume10Day: (sd as { averageVolume10day?: number }).averageVolume10day ?? null,
      // Dividend
      dividendYield: (sd as { dividendYield?: number }).dividendYield ?? null,
      exDividendDate:
        (sd as { exDividendDate?: Date }).exDividendDate instanceof Date
          ? (sd as { exDividendDate: Date }).exDividendDate.toISOString().slice(0, 10)
          : null,
      // Financial health
      totalDebt: (fd as { totalDebt?: number }).totalDebt ?? null,
      debtToEquity: (fd as { debtToEquity?: number }).debtToEquity ?? null,
      currentRatio: (fd as { currentRatio?: number }).currentRatio ?? null,
      totalCash: (fd as { totalCash?: number }).totalCash ?? null,
      freeCashflow: (fd as { freeCashflow?: number }).freeCashflow ?? null,
      // Analyst
      targetMeanPrice: (fd as { targetMeanPrice?: number }).targetMeanPrice ?? null,
      numberOfAnalystOpinions: (fd as { numberOfAnalystOpinions?: number }).numberOfAnalystOpinions ?? null,
      recommendationMean: (fd as { recommendationMean?: number }).recommendationMean ?? null,
      recommendationKey: (fd as { recommendationKey?: string }).recommendationKey ?? null,
      // Sector / industry
      sector: (ap as { sector?: string }).sector ?? null,
      industry: (ap as { industry?: string }).industry ?? null,
      website: (ap as { website?: string }).website ?? null,
      longBusinessSummary: (ap as { longBusinessSummary?: string }).longBusinessSummary ?? null,
    };

    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
