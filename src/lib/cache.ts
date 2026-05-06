import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import type { HistoryInterval, HistoryResult } from "./providers/types";

const CACHE_DIR = path.join(
  process.env.FINANCE_TRACKER_CACHE_DIR ?? path.join(os.tmpdir(), "finance-tracker-cache"),
  "history",
);

function ttlMsForInterval(interval: HistoryInterval): number {
  switch (interval) {
    case "1m":
    case "5m":
    case "15m":
    case "30m":
    case "60m":
      return 60_000;
    case "1d":
      return 15 * 60_000;
    case "1wk":
    case "1mo":
      return 6 * 60 * 60_000;
  }
}

function keyFor(symbol: string, range: string, interval: string): string {
  const raw = `${symbol.toUpperCase()}|${range}|${interval}`;
  const hash = crypto.createHash("sha1").update(raw).digest("hex").slice(0, 12);
  return `${symbol.toUpperCase().replace(/[^A-Z0-9-]/g, "_")}_${range}_${interval}_${hash}.json`;
}

type CacheRecord = {
  storedAt: number;
  payload: HistoryResult;
};

export async function readCache(
  symbol: string,
  range: string,
  interval: HistoryInterval,
): Promise<HistoryResult | null> {
  const file = path.join(CACHE_DIR, keyFor(symbol, range, interval));
  try {
    const raw = await fs.readFile(file, "utf8");
    const rec = JSON.parse(raw) as CacheRecord;
    if (Date.now() - rec.storedAt > ttlMsForInterval(interval)) return null;
    return rec.payload;
  } catch {
    return null;
  }
}

export async function writeCache(
  symbol: string,
  range: string,
  interval: HistoryInterval,
  payload: HistoryResult,
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, keyFor(symbol, range, interval));
  const rec: CacheRecord = { storedAt: Date.now(), payload };
  await fs.writeFile(file, JSON.stringify(rec), "utf8");
}
