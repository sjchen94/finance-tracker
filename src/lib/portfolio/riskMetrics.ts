/**
 * Portfolio risk metric calculations.
 * All formulas use daily log-returns, annualised assuming ~252 trading days/year.
 */

export type RiskMetrics = {
  /** Annualised volatility as a fraction (e.g. 0.22 = 22%) */
  annualisedVolatility: number | null;
  /** Sharpe ratio (risk-free rate: 5% p.a.) */
  sharpeRatio: number | null;
  /** Maximum drawdown from highest historical value (fraction, e.g. -0.15 = -15%) */
  maxDrawdown: number | null;
  /** Beta vs benchmark (SPY). null when benchmark has insufficient data */
  beta: number | null;
};

/** Compute array of daily log-returns from a price series. */
function logReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 0;
  const m = mu ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
  }
  return cov / (n - 1);
}

/**
 * Compute annualised volatility from an array of daily closes.
 * Returns null when there are fewer than 5 data points.
 */
export function computeVolatility(closes: number[]): number | null {
  if (closes.length < 5) return null;
  const ret = logReturns(closes);
  if (ret.length < 4) return null;
  return stddev(ret) * Math.sqrt(252);
}

/**
 * Compute Sharpe ratio using annualised returns vs a 5% risk-free rate.
 * Returns null when there are fewer than 5 data points.
 */
export function computeSharpe(closes: number[], riskFreeRate = 0.05): number | null {
  if (closes.length < 5) return null;
  const ret = logReturns(closes);
  if (ret.length < 4) return null;
  const annualisedReturn = mean(ret) * 252;
  const vol = stddev(ret) * Math.sqrt(252);
  if (vol === 0) return null;
  return (annualisedReturn - riskFreeRate) / vol;
}

/**
 * Compute maximum drawdown from the highest point in the price series.
 * Returns a negative fraction (e.g. -0.15 = -15% drawdown). null if < 2 points.
 */
export function computeMaxDrawdown(closes: number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0];
  let maxDD = 0;
  for (const price of closes) {
    if (price > peak) peak = price;
    const dd = (price - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

/**
 * Compute beta of the portfolio price series vs the benchmark (SPY).
 * Aligns the two series to their overlap (tail). Returns null if insufficient data.
 */
export function computeBeta(closes: number[], benchmarkCloses: number[]): number | null {
  if (closes.length < 5 || benchmarkCloses.length < 5) return null;
  const n = Math.min(closes.length, benchmarkCloses.length);
  const portSlice = closes.slice(closes.length - n);
  const benchSlice = benchmarkCloses.slice(benchmarkCloses.length - n);
  const portRet = logReturns(portSlice);
  const benchRet = logReturns(benchSlice);
  if (portRet.length < 4 || benchRet.length < 4) return null;
  const cov = covariance(portRet, benchRet);
  const benchVar = stddev(benchRet) ** 2;
  if (benchVar === 0) return null;
  return cov / benchVar;
}

/**
 * Compute a synthetic portfolio daily price series from holdings.
 * Returns a weighted average of each holding's close series, normalised to
 * start at 100. Aligns all series to the shortest length available.
 */
export function computePortfolioPriceSeries(
  holdings: Array<{ marketValue: number; closes: number[] }>,
): number[] | null {
  const valid = holdings.filter((h) => h.closes.length > 1 && h.marketValue > 0);
  if (valid.length === 0) return null;

  const totalValue = valid.reduce((s, h) => s + h.marketValue, 0);
  if (totalValue === 0) return null;

  const weights = valid.map((h) => h.marketValue / totalValue);
  const minLen = Math.min(...valid.map((h) => h.closes.length));
  if (minLen < 2) return null;

  // Normalise each holding's closes to its own starting value (relative performance)
  const normalised = valid.map((h) => {
    const tail = h.closes.slice(h.closes.length - minLen);
    const base = tail[0];
    return base > 0 ? tail.map((p) => p / base) : tail.map(() => 1);
  });

  const portfolio: number[] = new Array(minLen).fill(0);
  for (let i = 0; i < minLen; i++) {
    for (let j = 0; j < valid.length; j++) {
      portfolio[i] += weights[j] * (normalised[j][i] ?? 1);
    }
  }

  // Scale to start at 100
  const base = portfolio[0];
  return base > 0 ? portfolio.map((v) => (v / base) * 100) : portfolio;
}

/**
 * All-in-one: compute portfolio risk metrics from holdings with close histories.
 */
export function computeRiskMetrics(
  holdings: Array<{ marketValue: number; closes: number[] }>,
  spyCloses: number[],
): RiskMetrics {
  const portSeries = computePortfolioPriceSeries(holdings);
  if (!portSeries) {
    return { annualisedVolatility: null, sharpeRatio: null, maxDrawdown: null, beta: null };
  }

  return {
    annualisedVolatility: computeVolatility(portSeries),
    sharpeRatio: computeSharpe(portSeries),
    maxDrawdown: computeMaxDrawdown(portSeries),
    beta: computeBeta(portSeries, spyCloses),
  };
}
