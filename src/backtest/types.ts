/**
 * Backtesting Engine Types
 * Commission-aware simulation with comprehensive metrics
 */

/** Trade side */
export type TradeSide = 'buy' | 'sell';

/** Trade status */
export type TradeStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';

/** Position sizing method */
export type PositionSizing = 'fixed' | 'percent' | 'kelly' | 'equal_weight';

/** Rebalancing frequency */
export type RebalanceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'never';

/** Individual trade record */
export interface Trade {
  id: string;
  timestamp: number;
  symbol: string;
  side: TradeSide;
  quantity: number;
  price: number;
  commission: number;
  slippage: number;
  status: TradeStatus;
  pnl?: number;
  pnlPercent?: number;
  holdingPeriodDays?: number;
}

/** Open position */
export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  openDate: number;
  lastUpdate: number;
}

/** Portfolio snapshot at a point in time */
export interface PortfolioSnapshot {
  timestamp: number;
  cash: number;
  positions: Position[];
  totalValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

/** Commission configuration */
export interface CommissionConfig {
  /** Fixed fee per trade */
  fixedFee: number;
  /** Percentage of trade value */
  percentFee: number;
  /** Minimum commission */
  minCommission: number;
  /** Maximum commission */
  maxCommission: number;
}

/** Slippage configuration */
export interface SlippageConfig {
  /** Fixed slippage in price units */
  fixed: number;
  /** Percentage slippage */
  percent: number;
  /** Enable random slippage variation */
  randomize: boolean;
}

/** Backtest configuration */
export interface BacktestConfig {
  /** Initial capital */
  initialCapital: number;
  /** Commission settings */
  commission: CommissionConfig;
  /** Slippage settings */
  slippage: SlippageConfig;
  /** Position sizing method */
  positionSizing: PositionSizing;
  /** Fixed position size (for 'fixed' sizing) */
  fixedPositionSize?: number;
  /** Position size as % of portfolio (for 'percent' sizing) */
  positionSizePercent?: number;
  /** Maximum positions allowed */
  maxPositions: number;
  /** Maximum position size as % of portfolio */
  maxPositionPercent: number;
  /** Rebalancing frequency */
  rebalanceFrequency: RebalanceFrequency;
  /** Allow fractional shares */
  allowFractional: boolean;
  /** Risk-free rate for Sharpe calculation */
  riskFreeRate: number;
}

/** Performance metrics */
export interface PerformanceMetrics {
  // Returns
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  cagr: number;

  // Risk metrics
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  // Drawdown
  maxDrawdown: number;
  maxDrawdownDuration: number; // days
  avgDrawdown: number;

  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;

  // Other
  tradingDays: number;
  startDate: number;
  endDate: number;
  finalValue: number;
}

/** Benchmark comparison */
export interface BenchmarkComparison {
  benchmarkReturn: number;
  benchmarkVolatility: number;
  benchmarkSharpe: number;
  benchmarkMaxDrawdown: number;
  alpha: number;
  beta: number;
  correlation: number;
  informationRatio: number;
  trackingError: number;
  excessReturn: number;
}

/** Equity curve point */
export interface EquityPoint {
  date: number;
  equity: number;
  cash: number;
  invested: number;
  dailyReturn: number;
  cumulativeReturn: number;
  drawdown: number;
  benchmark?: number;
}

/** Monthly returns table entry */
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  benchmark?: number;
}

/** Complete backtest result */
export interface BacktestResult {
  config: BacktestConfig;
  metrics: PerformanceMetrics;
  benchmark?: BenchmarkComparison;
  equityCurve: EquityPoint[];
  monthlyReturns: MonthlyReturn[];
  trades: Trade[];
  finalPositions: Position[];
}

/** Price bar for backtest */
export interface PriceBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Backtest input data */
export interface BacktestData {
  symbols: string[];
  prices: Map<string, PriceBar[]>;
  startDate: number;
  endDate: number;
}
