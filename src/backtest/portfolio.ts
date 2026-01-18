/**
 * Portfolio Manager
 * Handles positions, trades, and P&L tracking
 */

import type {
  Position,
  Trade,
  TradeSide,
  CommissionConfig,
  SlippageConfig,
  PortfolioSnapshot,
} from './types';

let tradeIdCounter = 0;

/** Generate unique trade ID */
function generateTradeId(): string {
  return `T${++tradeIdCounter}-${Date.now()}`;
}

/** Default commission config */
export const DEFAULT_COMMISSION: CommissionConfig = {
  fixedFee: 0,
  percentFee: 0.001, // 0.1%
  minCommission: 0,
  maxCommission: Infinity,
};

/** Default slippage config */
export const DEFAULT_SLIPPAGE: SlippageConfig = {
  fixed: 0,
  percent: 0.0005, // 0.05%
  randomize: false,
};

export class Portfolio {
  private cash: number;
  private positions: Map<string, Position> = new Map();
  private trades: Trade[] = [];
  private commissionConfig: CommissionConfig;
  private slippageConfig: SlippageConfig;
  private allowFractional: boolean;

  constructor(
    initialCapital: number,
    commission: CommissionConfig = DEFAULT_COMMISSION,
    slippage: SlippageConfig = DEFAULT_SLIPPAGE,
    allowFractional = false
  ) {
    this.cash = initialCapital;
    this.commissionConfig = commission;
    this.slippageConfig = slippage;
    this.allowFractional = allowFractional;
  }

  /** Get current cash balance */
  getCash(): number {
    return this.cash;
  }

  /** Get all open positions */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /** Get position for a symbol */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /** Get all executed trades */
  getTrades(): Trade[] {
    return [...this.trades];
  }

  /** Calculate commission for a trade */
  calculateCommission(quantity: number, price: number): number {
    const value = Math.abs(quantity * price);
    let commission = this.commissionConfig.fixedFee + value * this.commissionConfig.percentFee;

    commission = Math.max(commission, this.commissionConfig.minCommission);
    commission = Math.min(commission, this.commissionConfig.maxCommission);

    return commission;
  }

  /** Calculate slippage for a trade */
  calculateSlippage(price: number, side: TradeSide): number {
    let slippage = this.slippageConfig.fixed + price * this.slippageConfig.percent;

    if (this.slippageConfig.randomize) {
      slippage *= 0.5 + Math.random(); // 50% - 150% variation
    }

    // Slippage is adverse: buy higher, sell lower
    return side === 'buy' ? slippage : -slippage;
  }

  /** Execute a buy order */
  buy(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: number
  ): Trade | null {
    if (quantity <= 0) return null;

    // Apply slippage
    const slippage = this.calculateSlippage(price, 'buy');
    const executionPrice = price + slippage;

    // Round quantity if not allowing fractional
    const finalQuantity = this.allowFractional
      ? quantity
      : Math.floor(quantity);

    if (finalQuantity <= 0) return null;

    // Calculate costs
    const tradeValue = finalQuantity * executionPrice;
    const commission = this.calculateCommission(finalQuantity, executionPrice);
    const totalCost = tradeValue + commission;

    // Check if we have enough cash
    if (totalCost > this.cash) {
      return null;
    }

    // Deduct from cash
    this.cash -= totalCost;

    // Update or create position
    const existingPosition = this.positions.get(symbol);

    if (existingPosition) {
      // Average cost calculation
      const totalQuantity = existingPosition.quantity + finalQuantity;
      const totalCostBasis =
        existingPosition.quantity * existingPosition.avgCost +
        finalQuantity * executionPrice;
      existingPosition.avgCost = totalCostBasis / totalQuantity;
      existingPosition.quantity = totalQuantity;
      existingPosition.currentPrice = executionPrice;
      existingPosition.marketValue = totalQuantity * executionPrice;
      existingPosition.unrealizedPnl =
        totalQuantity * (executionPrice - existingPosition.avgCost);
      existingPosition.unrealizedPnlPercent =
        (executionPrice / existingPosition.avgCost - 1) * 100;
      existingPosition.lastUpdate = timestamp;
    } else {
      this.positions.set(symbol, {
        symbol,
        quantity: finalQuantity,
        avgCost: executionPrice,
        currentPrice: executionPrice,
        marketValue: finalQuantity * executionPrice,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openDate: timestamp,
        lastUpdate: timestamp,
      });
    }

    // Record trade
    const trade: Trade = {
      id: generateTradeId(),
      timestamp,
      symbol,
      side: 'buy',
      quantity: finalQuantity,
      price: executionPrice,
      commission,
      slippage: slippage * finalQuantity,
      status: 'filled',
    };

    this.trades.push(trade);
    return trade;
  }

  /** Execute a sell order */
  sell(
    symbol: string,
    quantity: number,
    price: number,
    timestamp: number
  ): Trade | null {
    if (quantity <= 0) return null;

    const position = this.positions.get(symbol);
    if (!position || position.quantity <= 0) {
      return null; // No position to sell
    }

    // Apply slippage
    const slippage = this.calculateSlippage(price, 'sell');
    const executionPrice = price + slippage;

    // Can't sell more than we have
    const finalQuantity = Math.min(
      this.allowFractional ? quantity : Math.floor(quantity),
      position.quantity
    );

    if (finalQuantity <= 0) return null;

    // Calculate proceeds
    const tradeValue = finalQuantity * executionPrice;
    const commission = this.calculateCommission(finalQuantity, executionPrice);
    const proceeds = tradeValue - commission;

    // Calculate P&L for this trade
    const costBasis = finalQuantity * position.avgCost;
    const pnl = proceeds - costBasis + commission; // Add back commission for trade P&L
    const pnlPercent = (executionPrice / position.avgCost - 1) * 100;

    // Holding period
    const holdingPeriodDays = Math.ceil(
      (timestamp - position.openDate) / (24 * 60 * 60 * 1000)
    );

    // Add to cash
    this.cash += proceeds;

    // Update position
    position.quantity -= finalQuantity;
    position.lastUpdate = timestamp;

    if (position.quantity <= 0.0001) {
      // Close position (with small tolerance for floating point)
      this.positions.delete(symbol);
    } else {
      position.marketValue = position.quantity * executionPrice;
      position.unrealizedPnl =
        position.quantity * (executionPrice - position.avgCost);
      position.unrealizedPnlPercent =
        (executionPrice / position.avgCost - 1) * 100;
    }

    // Record trade
    const trade: Trade = {
      id: generateTradeId(),
      timestamp,
      symbol,
      side: 'sell',
      quantity: finalQuantity,
      price: executionPrice,
      commission,
      slippage: slippage * finalQuantity,
      status: 'filled',
      pnl,
      pnlPercent,
      holdingPeriodDays,
    };

    this.trades.push(trade);
    return trade;
  }

  /** Close all positions */
  closeAll(prices: Map<string, number>, timestamp: number): Trade[] {
    const trades: Trade[] = [];

    for (const [symbol, position] of this.positions) {
      const price = prices.get(symbol);
      if (price && position.quantity > 0) {
        const trade = this.sell(symbol, position.quantity, price, timestamp);
        if (trade) trades.push(trade);
      }
    }

    return trades;
  }

  /** Update position prices (mark to market) */
  updatePrices(prices: Map<string, number>, timestamp: number): void {
    for (const [symbol, position] of this.positions) {
      const price = prices.get(symbol);
      if (price) {
        position.currentPrice = price;
        position.marketValue = position.quantity * price;
        position.unrealizedPnl =
          position.quantity * (price - position.avgCost);
        position.unrealizedPnlPercent =
          (price / position.avgCost - 1) * 100;
        position.lastUpdate = timestamp;
      }
    }
  }

  /** Get total portfolio value */
  getTotalValue(): number {
    let invested = 0;
    for (const position of this.positions.values()) {
      invested += position.marketValue;
    }
    return this.cash + invested;
  }

  /** Get portfolio snapshot */
  getSnapshot(timestamp: number, prevValue?: number): PortfolioSnapshot {
    const totalValue = this.getTotalValue();
    const dailyReturn = prevValue ? (totalValue / prevValue - 1) * 100 : 0;

    return {
      timestamp,
      cash: this.cash,
      positions: this.getPositions(),
      totalValue,
      dailyReturn,
      cumulativeReturn: 0, // Will be calculated by engine
    };
  }

  /** Reset portfolio to initial state */
  reset(initialCapital: number): void {
    this.cash = initialCapital;
    this.positions.clear();
    this.trades = [];
    tradeIdCounter = 0;
  }
}
