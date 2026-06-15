import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic();

export type InsightRequest = {
  sectors: Array<{
    name: string;
    averageScore: number;
    topTickers: Array<{
      symbol: string;
      score: number;
      changePercent: number | null;
      breakout: boolean;
      rsi: number | null;
      return1m: number | null;
    }>;
  }>;
  marketIndicators: {
    spy: { price: number | null; changePercent: number | null } | null;
    qqq: { price: number | null; changePercent: number | null } | null;
    vix: { price: number | null; changePercent: number | null } | null;
  };
};

// --- FMP Fundamentals (graceful no-op if FMP_API_KEY not set) ---

type FmpProfile = {
  symbol: string;
  pe?: number | null;
  eps?: number | null;
  companyName?: string;
};

async function fetchFmpFundamentals(symbols: string[]): Promise<Map<string, FmpProfile>> {
  const map = new Map<string, FmpProfile>();
  const key = process.env.FMP_API_KEY;
  if (!key || symbols.length === 0) return map;

  await Promise.all(
    symbols.slice(0, 5).map(async (sym) => {
      try {
        const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(sym)}?apikey=${key}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return;
        const data = (await res.json()) as FmpProfile[];
        if (Array.isArray(data) && data[0]) {
          map.set(sym, data[0]);
        }
      } catch {
        /* silently ignore per-symbol failures */
      }
    }),
  );
  return map;
}

export async function POST(req: NextRequest) {
  let body: InsightRequest;
  try {
    body = (await req.json()) as InsightRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sectors, marketIndicators } = body;

  // Build a concise text summary of the current market state
  const topSectors = [...sectors]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3)
    .map((s) => `${s.name} (score ${s.averageScore.toFixed(0)})`)
    .join(", ");

  const bottomSectors = [...sectors]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 2)
    .map((s) => `${s.name} (score ${s.averageScore.toFixed(0)})`)
    .join(", ");

  const breakouts = sectors
    .flatMap((s) => s.topTickers.filter((t) => t.breakout).map((t) => t.symbol))
    .slice(0, 5);

  const topMovers = sectors
    .flatMap((s) =>
      s.topTickers.map((t) => ({
        symbol: t.symbol,
        changePercent: t.changePercent ?? 0,
        score: t.score,
      })),
    )
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5)
    .map((t) => `${t.symbol} (${t.changePercent >= 0 ? "+" : ""}${t.changePercent.toFixed(1)}%, score ${t.score.toFixed(0)})`);

  // FMP fundamentals for top breakout / top-scoring tickers
  const candidatesForFmp = [
    ...breakouts,
    ...sectors
      .flatMap((s) => s.topTickers)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((t) => t.symbol),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const fmpData = await fetchFmpFundamentals(candidatesForFmp);

  const dataText = [
    `Market: SPY ${marketIndicators.spy?.changePercent != null ? (marketIndicators.spy.changePercent >= 0 ? "+" : "") + marketIndicators.spy.changePercent.toFixed(2) + "%" : "N/A"}, QQQ ${marketIndicators.qqq?.changePercent != null ? (marketIndicators.qqq.changePercent >= 0 ? "+" : "") + marketIndicators.qqq.changePercent.toFixed(2) + "%" : "N/A"}, VIX ${marketIndicators.vix?.price != null ? marketIndicators.vix.price.toFixed(1) : "N/A"}`,
    `Leading sectors: ${topSectors}`,
    `Lagging sectors: ${bottomSectors}`,
    topMovers.length > 0 ? `Top movers: ${topMovers.join(", ")}` : null,
    breakouts.length > 0 ? `Breakout signals: ${breakouts.join(", ")}` : null,
    fmpData.size > 0
      ? `Fundamentals (via FMP): ${[...fmpData.values()]
          .map((p) => `${p.symbol} P/E ${p.pe?.toFixed(1) ?? "N/A"} EPS ${p.eps?.toFixed(2) ?? "N/A"}`)
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 256,
      system:
        "You are a momentum equity analyst. Given sector momentum data and market indicators, write 2-3 concise sentences highlighting the most notable pattern and one actionable observation. Be specific about tickers and sectors. Do not use bullet points.",
      messages: [
        {
          role: "user",
          content: `Current market snapshot:\n${dataText}\n\nProvide a 2-3 sentence insight.`,
        },
      ],
    });

    const text =
      message.content[0]?.type === "text" ? message.content[0].text : "";
    return NextResponse.json({ insight: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Claude API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
