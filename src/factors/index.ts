/**
 * Factor Analysis Module
 * Multi-factor model for quantitative analysis
 */

// Types
export type {
  FactorCategory,
  FactorDefinition,
  FactorValue,
  FactorData,
  MomentumFactors,
  ValueFactors,
  QualityFactors,
  SizeFactors,
  VolatilityFactors,
  TechnicalFactors,
  AllFactors,
  PriceData,
  FundamentalData,
  FactorOptions,
  NormalizationMethod,
  CompositeWeights,
} from './types';

// Utilities
export {
  sma,
  ema,
  stdDev,
  returns,
  logReturns,
  covariance,
  correlation,
  percentileRank,
  zscore,
  minMaxNorm,
  maxDrawdown,
  downsideDeviation,
  trueRange,
  rollingWindow,
  safeDivide,
  annualize,
} from './utils';

// Momentum factors
export {
  calculateMomentumFactors,
  calculatePriceMomentum,
  calculateMomentumAcceleration,
  calculateVolumeMomentum,
  calculateRSI,
  calculateMACD,
} from './momentum';

// Value factors
export {
  calculateValueFactors,
  calculatePERatio,
  calculatePBRatio,
  calculatePSRatio,
  calculateDividendYield,
  calculateEVEBITDA,
  calculatePriceToFCF,
  calculatePEGRatio,
  calculateEarningsYield,
  calculateFCFYield,
} from './value';

// Quality factors
export {
  calculateQualityFactors,
  calculateROE,
  calculateROA,
  calculateROIC,
  calculateDebtToEquity,
  calculateCurrentRatio,
  calculateProfitMargin,
  calculateGrossMargin,
  calculateOperatingMargin,
  calculateInterestCoverage,
  calculateAssetTurnover,
} from './quality';

// Size factors
export {
  calculateSizeFactors,
  calculateLogMarketCap,
  classifyMarketCap,
  calculateFloatPercentage,
} from './size';

// Volatility factors
export {
  calculateVolatilityFactors,
  calculateHistoricalVolatility,
  calculateBeta,
  calculateSharpeRatio,
  calculateDownsideDeviation,
  calculateSortinoRatio,
  calculateCalmarRatio,
} from './volatility';

// Technical factors
export {
  calculateTechnicalFactors,
  calculateBollingerBands,
  calculateATR,
  calculateADX,
  calculateOBV,
  calculateVWAP,
  calculateStochastic,
} from './technical';

// Calculator
export {
  FactorCalculator,
  factorCalculator,
  FACTOR_DEFINITIONS,
} from './calculator';
