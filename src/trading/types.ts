/**
 * Paper Trading Types
 * Type definitions for paper trading simulation
 */

/** Order side - buy or sell */
export type OrderSide = 'buy' | 'sell';

/** Order type - market or limit */
export type OrderType = 'market' | 'limit';

/** Order status */
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected';

/** Order creation request */
export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  type: OrderType;
  limitPrice?: number;
  stopPrice?: number;
}

/** Order with full details */
export interface Order extends OrderRequest {
  id: string;
  portfolioId: string;
  status: OrderStatus;
  filledQuantity: number;
  avgFillPrice: number;
  createdAt: number;
  updatedAt: number;
  filledAt?: number;
  cancelledAt?: number;
  commission: number;
  notes?: string;
}

/** Position in a portfolio */
export interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  openedAt: number;
  lastUpdated: number;
}

/** Portfolio configuration */
export interface PortfolioConfig {
  /** Initial cash balance */
  initialCash: number;
  /** Commission per trade (fixed amount) */
  commissionPerTrade?: number;
  /** Commission rate (percentage of trade value) */
  commissionRate?: number;
  /** Maximum position size as percentage of portfolio */
  maxPositionSize?: number;
  /** Daily loss limit as percentage of portfolio */
  dailyLossLimit?: number;
  /** Maximum number of positions */
  maxPositions?: number;
  /** Minimum cash reserve as percentage */
  minCashReserve?: number;
}

/** Portfolio summary */
export interface PortfolioSummary {
  id: string;
  name: string;
  cash: number;
  totalValue: number;
  positionsValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  positionCount: number;
  createdAt: number;
  lastUpdated: number;
}

/** Trade record for history */
export interface Trade {
  id: string;
  orderId: string;
  portfolioId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission: number;
  timestamp: number;
  pnl?: number;
}

/** Risk check result */
export interface RiskCheckResult {
  allowed: boolean;
  warnings: string[];
  errors: string[];
}

/** Risk limits configuration */
export interface RiskLimits {
  /** Maximum position size as percentage of portfolio */
  maxPositionPct: number;
  /** Maximum single position value */
  maxPositionValue: number;
  /** Maximum daily loss percentage */
  maxDailyLossPct: number;
  /** Maximum drawdown percentage */
  maxDrawdownPct: number;
  /** Maximum number of positions */
  maxPositions: number;
  /** Minimum cash reserve percentage */
  minCashReservePct: number;
  /** Maximum concentration in single position */
  maxConcentrationPct: number;
}

/** Portfolio analytics */
export interface PortfolioAnalytics {
  /** Sharpe ratio */
  sharpeRatio: number;
  /** Sortino ratio */
  sortinoRatio: number;
  /** Maximum drawdown */
  maxDrawdown: number;
  /** Win rate */
  winRate: number;
  /** Average win */
  avgWin: number;
  /** Average loss */
  avgLoss: number;
  /** Profit factor */
  profitFactor: number;
  /** Total trades */
  totalTrades: number;
  /** Winning trades */
  winningTrades: number;
  /** Losing trades */
  losingTrades: number;
}

/** Price provider interface for getting current prices */
export interface PriceProvider {
  getPrice(symbol: string): Promise<number>;
  getPrices(symbols: string[]): Promise<Map<string, number>>;
}

/** Default portfolio configuration */
export const DEFAULT_PORTFOLIO_CONFIG: Required<PortfolioConfig> = {
  initialCash: 100000,
  commissionPerTrade: 0,
  commissionRate: 0.001, // 0.1%
  maxPositionSize: 0.2, // 20%
  dailyLossLimit: 0.05, // 5%
  maxPositions: 20,
  minCashReserve: 0.05, // 5%
};

/** Default risk limits */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionPct: 0.2,
  maxPositionValue: 50000,
  maxDailyLossPct: 0.05,
  maxDrawdownPct: 0.15,
  maxPositions: 20,
  minCashReservePct: 0.05,
  maxConcentrationPct: 0.25,
};
