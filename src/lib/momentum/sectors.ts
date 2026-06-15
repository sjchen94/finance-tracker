export type SectorId =
  | "gpu"
  | "cpu"
  | "memory"
  | "photonics"
  | "clean-energy"
  | "energy"
  | "ai-infra";

export type SectorDef = {
  id: SectorId;
  name: string;
  tickers: string[];
};

export const SECTORS: SectorDef[] = [
  { id: "gpu", name: "GPU", tickers: ["NVDA", "AMD", "SMCI", "MRVL", "AVGO"] },
  { id: "cpu", name: "CPU", tickers: ["INTC", "QCOM", "ARM", "ASML"] },
  { id: "memory", name: "Memory", tickers: ["MU", "WDC", "STX", "AMAT"] },
  { id: "photonics", name: "Photonics", tickers: ["COHR", "LITE", "VIAV", "AAOI"] },
  { id: "clean-energy", name: "Clean Energy", tickers: ["FSLR", "ENPH", "NEE", "BE"] },
  { id: "energy", name: "Energy", tickers: ["XOM", "CVX", "COP", "EOG"] },
  { id: "ai-infra", name: "AI Infra", tickers: ["MSFT", "GOOGL", "META", "ANET", "CRWD"] },
];

export const ALL_TICKERS: string[] = Array.from(
  new Set(SECTORS.flatMap((s) => s.tickers)),
);

export const TICKER_TO_SECTOR: Record<string, { id: SectorId; name: string }> =
  SECTORS.reduce(
    (acc, sec) => {
      for (const t of sec.tickers) acc[t] = { id: sec.id, name: sec.name };
      return acc;
    },
    {} as Record<string, { id: SectorId; name: string }>,
  );

export const BENCHMARK_SYMBOL = "SPY";
