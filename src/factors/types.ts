/**
 * Factor Analysis Types
 * Multi-factor model for quantitative analysis
 */

/** Factor categories */
export type FactorCategory =
  | 'momentum'
  | 'value'
  | 'quality'
  | 'size'
  | 'volatility'
  | 'technical';

/** Individual factor definition */
export interface FactorDefinition {
  name: string;
  category: FactorCategory;
  description: string;
  higherIsBetter: boolean;
  unit?: string;
}

/** Factor value with metadata */
export interface FactorValue {
  name: string;
  value: number | null;
  percentile?: number;
  zscore?: number;
}

/** All factors for a symbol */
export interface FactorData {
  symbol: string;
  timestamp: number;
  factors: Record<string, FactorValue>;
}

/** Momentum factors */
export interface MomentumFactors {
  momentum_20d: number | null;
  momentum_60d: number | null;
  momentum_252d: number | null;
  momentum_accel_20d: number | null;
  momentum_accel_60d: number | null;
  volume_momentum_20d: number | null;
  rsi_14: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
}

/** Value factors */
export interface ValueFactors {
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  dividend_yield: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;
}

/** Quality factors */
export interface QualityFactors {
  roe: number | null;
  roa: number | null;
  roic: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  profit_margin: number | null;
  gross_margin: number | null;
}

/** Size factors */
export interface SizeFactors {
  market_cap: number | null;
  market_cap_log: number | null;
  float_shares: number | null;
}

/** Volatility factors */
export interface VolatilityFactors {
  volatility_20d: number | null;
  volatility_60d: number | null;
  beta: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  downside_deviation: number | null;
}

/** Technical factors */
export interface TechnicalFactors {
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  ema_12: number | null;
  ema_26: number | null;
  price_to_sma_20: number | null;
  price_to_sma_50: number | null;
  price_to_sma_200: number | null;
  bollinger_upper: number | null;
  bollinger_lower: number | null;
  bollinger_width: number | null;
  bollinger_pct_b: number | null;
  atr_14: number | null;
  adx_14: number | null;
  obv: number | null;
  vwap: number | null;
}

/** Combined factors */
export interface AllFactors {
  momentum: MomentumFactors;
  value: ValueFactors;
  quality: QualityFactors;
  size: SizeFactors;
  volatility: VolatilityFactors;
  technical: TechnicalFactors;
}

/** Price data for calculations */
export interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fundamental data for value/quality factors */
export interface FundamentalData {
  marketCap?: number;
  sharesOutstanding?: number;
  floatShares?: number;
  eps?: number;
  bookValuePerShare?: number;
  salesPerShare?: number;
  dividendPerShare?: number;
  ebitda?: number;
  enterpriseValue?: number;
  freeCashFlow?: number;
  netIncome?: number;
  totalAssets?: number;
  totalEquity?: number;
  totalDebt?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  revenue?: number;
  grossProfit?: number;
  investedCapital?: number;
}

/** Factor calculation options */
export interface FactorOptions {
  benchmark?: PriceData[];
  riskFreeRate?: number;
}

/** Normalization method */
export type NormalizationMethod = 'percentile' | 'zscore' | 'minmax' | 'rank';

/** Composite score weights */
export interface CompositeWeights {
  momentum?: number;
  value?: number;
  quality?: number;
  size?: number;
  volatility?: number;
  technical?: number;
}
