import { yahooProvider } from "./yahoo";
import type { MarketDataProvider } from "./types";

export const provider: MarketDataProvider = yahooProvider;
export type { MarketDataProvider } from "./types";
