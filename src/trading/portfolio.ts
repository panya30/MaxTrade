/**
 * Portfolio Class
 * Manages cash, positions, and portfolio-level operations
 */

import type {
  Position,
  PortfolioConfig,
  PortfolioSummary,
  Trade,
  OrderSide,
  PriceProvider,
} from './types';
import { DEFAULT_PORTFOLIO_CONFIG } from './types';

/** Generate unique ID */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Paper trading portfolio
 */
export class Portfolio {
  readonly id: string;
  readonly name: string;
  private config: Required<PortfolioConfig>;
  private cash: number;
  private positions: Map<string, Position>;
  private trades: Trade[];
  private createdAt: number;
  private lastUpdated: number;
  private initialValue: number;
  private highWaterMark: number;
  private dailyStartValue: number;
  private dailyStartDate: number;

  constructor(
    name: string,
    config: PortfolioConfig = {},
    id?: string
  ) {
    this.id = id ?? generateId('pf');
    this.name = name;
    this.config = { ...DEFAULT_PORTFOLIO_CONFIG, ...config };
    this.cash = this.config.initialCash;
    this.positions = new Map();
    this.trades = [];
    this.createdAt = Date.now();
    this.lastUpdated = Date.now();
    this.initialValue = this.config.initialCash;
    this.highWaterMark = this.config.initialCash;
    this.dailyStartValue = this.config.initialCash;
    this.dailyStartDate = this.getDateKey();
  }

  /** Get current date key (YYYY-MM-DD) */
  private getDateKey(): number {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  /** Check if new trading day */
  private checkNewDay(): void {
    const today = this.getDateKey();
    if (today > this.dailyStartDate) {
      this.dailyStartValue = this.getTotalValue();
      this.dailyStartDate = today;
    }
  }

  /** Get cash balance */
  getCash(): number {
    return this.cash;
  }

  /** Get position by symbol */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /** Get all positions */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /** Get position value for a symbol */
  getPositionValue(symbol: string): number {
    const position = this.positions.get(symbol);
    return position ? position.marketValue : 0;
  }

  /** Get total value of all positions */
  getPositionsValue(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      total += pos.marketValue;
    }
    return total;
  }

  /** Get total portfolio value */
  getTotalValue(): number {
    return this.cash + this.getPositionsValue();
  }

  /** Get day change */
  getDayChange(): number {
    this.checkNewDay();
    return this.getTotalValue() - this.dailyStartValue;
  }

  /** Get day change percent */
  getDayChangePercent(): number {
    this.checkNewDay();
    if (this.dailyStartValue === 0) return 0;
    return (this.getDayChange() / this.dailyStartValue) * 100;
  }

  /** Get total return */
  getTotalReturn(): number {
    return this.getTotalValue() - this.initialValue;
  }

  /** Get total return percent */
  getTotalReturnPercent(): number {
    if (this.initialValue === 0) return 0;
    return (this.getTotalReturn() / this.initialValue) * 100;
  }

  /** Get portfolio summary */
  getSummary(): PortfolioSummary {
    return {
      id: this.id,
      name: this.name,
      cash: this.cash,
      totalValue: this.getTotalValue(),
      positionsValue: this.getPositionsValue(),
      dayChange: this.getDayChange(),
      dayChangePercent: this.getDayChangePercent(),
      totalReturn: this.getTotalReturn(),
      totalReturnPercent: this.getTotalReturnPercent(),
      positionCount: this.positions.size,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated,
    };
  }

  /** Calculate commission for a trade */
  calculateCommission(tradeValue: number): number {
    const fixed = this.config.commissionPerTrade;
    const rate = this.config.commissionRate;
    return fixed + tradeValue * rate;
  }

  /**
   * Execute a buy order
   * @returns Trade record or null if failed
   */
  buy(
    symbol: string,
    quantity: number,
    price: number,
    orderId: string
  ): Trade | null {
    const tradeValue = quantity * price;
    const commission = this.calculateCommission(tradeValue);
    const totalCost = tradeValue + commission;

    // Check sufficient cash
    if (totalCost > this.cash) {
      return null;
    }

    // Deduct cash
    this.cash -= totalCost;

    // Update or create position
    const existingPosition = this.positions.get(symbol);
    if (existingPosition) {
      const totalQuantity = existingPosition.quantity + quantity;
      const totalCostBasis =
        existingPosition.avgCost * existingPosition.quantity + tradeValue;
      const newAvgCost = totalCostBasis / totalQuantity;

      existingPosition.quantity = totalQuantity;
      existingPosition.avgCost = newAvgCost;
      existingPosition.currentPrice = price;
      existingPosition.marketValue = totalQuantity * price;
      existingPosition.unrealizedPnl =
        (price - newAvgCost) * totalQuantity;
      existingPosition.unrealizedPnlPercent =
        ((price - newAvgCost) / newAvgCost) * 100;
      existingPosition.lastUpdated = Date.now();
    } else {
      const position: Position = {
        symbol,
        quantity,
        avgCost: price,
        currentPrice: price,
        marketValue: tradeValue,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        realizedPnl: 0,
        openedAt: Date.now(),
        lastUpdated: Date.now(),
      };
      this.positions.set(symbol, position);
    }

    // Record trade
    const trade: Trade = {
      id: generateId('tr'),
      orderId,
      portfolioId: this.id,
      symbol,
      side: 'buy',
      quantity,
      price,
      commission,
      timestamp: Date.now(),
    };
    this.trades.push(trade);

    // Update high water mark
    const totalValue = this.getTotalValue();
    if (totalValue > this.highWaterMark) {
      this.highWaterMark = totalValue;
    }

    this.lastUpdated = Date.now();
    return trade;
  }

  /**
   * Execute a sell order
   * @returns Trade record or null if failed
   */
  sell(
    symbol: string,
    quantity: number,
    price: number,
    orderId: string
  ): Trade | null {
    const position = this.positions.get(symbol);
    if (!position || position.quantity < quantity) {
      return null;
    }

    const tradeValue = quantity * price;
    const commission = this.calculateCommission(tradeValue);
    const proceeds = tradeValue - commission;

    // Calculate P&L for this trade
    const costBasis = position.avgCost * quantity;
    const pnl = proceeds - costBasis;

    // Add cash (proceeds minus commission)
    this.cash += proceeds;

    // Update position
    const remainingQuantity = position.quantity - quantity;
    if (remainingQuantity === 0) {
      // Close position
      this.positions.delete(symbol);
    } else {
      // Reduce position
      position.quantity = remainingQuantity;
      position.currentPrice = price;
      position.marketValue = remainingQuantity * price;
      position.unrealizedPnl =
        (price - position.avgCost) * remainingQuantity;
      position.unrealizedPnlPercent =
        ((price - position.avgCost) / position.avgCost) * 100;
      position.realizedPnl += pnl;
      position.lastUpdated = Date.now();
    }

    // Record trade
    const trade: Trade = {
      id: generateId('tr'),
      orderId,
      portfolioId: this.id,
      symbol,
      side: 'sell',
      quantity,
      price,
      commission,
      timestamp: Date.now(),
      pnl,
    };
    this.trades.push(trade);

    // Update high water mark
    const totalValue = this.getTotalValue();
    if (totalValue > this.highWaterMark) {
      this.highWaterMark = totalValue;
    }

    this.lastUpdated = Date.now();
    return trade;
  }

  /**
   * Update position prices
   */
  async updatePrices(priceProvider: PriceProvider): Promise<void> {
    const symbols = Array.from(this.positions.keys());
    if (symbols.length === 0) return;

    const prices = await priceProvider.getPrices(symbols);

    for (const [symbol, position] of this.positions) {
      const price = prices.get(symbol);
      if (price !== undefined) {
        position.currentPrice = price;
        position.marketValue = position.quantity * price;
        position.unrealizedPnl =
          (price - position.avgCost) * position.quantity;
        position.unrealizedPnlPercent =
          ((price - position.avgCost) / position.avgCost) * 100;
        position.lastUpdated = Date.now();
      }
    }

    // Update high water mark
    const totalValue = this.getTotalValue();
    if (totalValue > this.highWaterMark) {
      this.highWaterMark = totalValue;
    }

    this.lastUpdated = Date.now();
  }

  /** Get trade history */
  getTrades(): Trade[] {
    return [...this.trades];
  }

  /** Get trades for a specific symbol */
  getTradesForSymbol(symbol: string): Trade[] {
    return this.trades.filter((t) => t.symbol === symbol);
  }

  /** Get current drawdown */
  getDrawdown(): number {
    if (this.highWaterMark === 0) return 0;
    const currentValue = this.getTotalValue();
    return ((this.highWaterMark - currentValue) / this.highWaterMark) * 100;
  }

  /** Get portfolio configuration */
  getConfig(): Required<PortfolioConfig> {
    return { ...this.config };
  }

  /** Check if can afford a purchase */
  canAfford(tradeValue: number): boolean {
    const commission = this.calculateCommission(tradeValue);
    const totalCost = tradeValue + commission;
    const minReserve = this.getTotalValue() * this.config.minCashReserve;
    return this.cash - totalCost >= minReserve;
  }

  /** Get available buying power */
  getBuyingPower(): number {
    const minReserve = this.getTotalValue() * this.config.minCashReserve;
    return Math.max(0, this.cash - minReserve);
  }

  /** Serialize portfolio to JSON */
  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      config: this.config,
      cash: this.cash,
      positions: Array.from(this.positions.entries()),
      trades: this.trades,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated,
      initialValue: this.initialValue,
      highWaterMark: this.highWaterMark,
      dailyStartValue: this.dailyStartValue,
      dailyStartDate: this.dailyStartDate,
    };
  }

  /** Restore portfolio from JSON */
  static fromJSON(data: ReturnType<Portfolio['toJSON']>): Portfolio {
    const portfolio = new Portfolio(
      (data as { name: string }).name,
      (data as { config: PortfolioConfig }).config,
      (data as { id: string }).id
    );

    // Restore state
    const d = data as {
      cash: number;
      positions: Array<[string, Position]>;
      trades: Trade[];
      createdAt: number;
      lastUpdated: number;
      initialValue: number;
      highWaterMark: number;
      dailyStartValue: number;
      dailyStartDate: number;
    };

    // Use Object.assign to set private fields
    Object.assign(portfolio, {
      cash: d.cash,
      positions: new Map(d.positions),
      trades: d.trades,
      createdAt: d.createdAt,
      lastUpdated: d.lastUpdated,
      initialValue: d.initialValue,
      highWaterMark: d.highWaterMark,
      dailyStartValue: d.dailyStartValue,
      dailyStartDate: d.dailyStartDate,
    });

    return portfolio;
  }
}
