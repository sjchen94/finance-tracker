import { NextRequest, NextResponse } from "next/server";
import { fetchSectorData, getLeaderboard } from "@/lib/momentum/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const parsed = limitRaw ? Number.parseInt(limitRaw, 10) : 10;
  const limit = Number.isFinite(parsed) && parsed > 0 && parsed <= 50 ? parsed : 10;
  try {
    const bundle = await fetchSectorData();
    const top = getLeaderboard(bundle, limit);
    return NextResponse.json({
      generatedAt: bundle.generatedAt,
      limit,
      leaderboard: top,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
