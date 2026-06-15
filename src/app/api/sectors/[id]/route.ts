import { NextRequest, NextResponse } from "next/server";
import { fetchSectorData, getSectorById } from "@/lib/momentum/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    const bundle = await fetchSectorData();
    const sector = getSectorById(bundle, id);
    if (!sector) {
      return NextResponse.json({ error: "sector not found" }, { status: 404 });
    }
    return NextResponse.json({
      generatedAt: bundle.generatedAt,
      sector,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
