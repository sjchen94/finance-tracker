import { NextRequest, NextResponse } from "next/server";
import { fetchSectorData } from "@/lib/momentum/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const data = await fetchSectorData({ forceRefresh: refresh });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
