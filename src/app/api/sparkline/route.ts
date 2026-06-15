import { NextRequest, NextResponse } from "next/server";
import { provider } from "@/lib/providers";
import { readCache, writeCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the last 7 daily closes for each symbol in the `symbols` query param (comma-separated)
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9.\-=^]+$/.test(s))
    .slice(0, 30); // safety cap

  if (symbols.length === 0) {
    return NextResponse.json({ error: "missing symbols" }, { status: 400 });
  }

  const results: Record<string, number[]> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        let hist = await readCache(symbol, "1mo", "1d");
        if (!hist) {
          hist = await provider.fetchHistory(symbol, "1mo", "1d");
          await writeCache(symbol, "1mo", "1d", hist);
        }
        // Take last 7 closes
        results[symbol] = hist.candles.slice(-7).map((c) => c.close);
      } catch {
        results[symbol] = [];
      }
    }),
  );

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=900" },
  });
}
