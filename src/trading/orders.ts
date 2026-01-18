/**
 * Order Manager
 * Handles order creation, tracking, and execution
 */

import type {
  Order,
  OrderRequest,
  OrderStatus,
  Trade,
  PriceProvider,
} from './types';
import { Portfolio } from './portfolio';

/** Generate unique ID */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Order execution result
 */
export interface OrderResult {
  success: boolean;
  order: Order;
  trade?: Trade;
  error?: string;
}

/**
 * Order Manager
 * Manages orders and executes them against portfolios
 */
export class OrderManager {
  private orders: Map<string, Order> = new Map();
  private pendingOrders: Map<string, Order> = new Map();
  private priceProvider: PriceProvider;
  private slippageRate: number;

  constructor(priceProvider: PriceProvider, slippageRate = 0.001) {
    this.priceProvider = priceProvider;
    this.slippageRate = slippageRate;
  }

  /**
   * Create and submit an order
   */
  async submitOrder(
    portfolio: Portfolio,
    request: OrderRequest
  ): Promise<OrderResult> {
    const order: Order = {
      ...request,
      id: generateId('ord'),
      portfolioId: portfolio.id,
      status: 'pending',
      filledQuantity: 0,
      avgFillPrice: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      commission: 0,
    };

    this.orders.set(order.id, order);

    // Execute immediately for market orders
    if (request.type === 'market') {
      return this.executeMarketOrder(portfolio, order);
    }

    // Queue limit orders for monitoring
    this.pendingOrders.set(order.id, order);
    return { success: true, order };
  }

  /**
   * Execute a market order immediately
   */
  private async executeMarketOrder(
    portfolio: Portfolio,
    order: Order
  ): Promise<OrderResult> {
    try {
      // Get current price with slippage
      const basePrice = await this.priceProvider.getPrice(order.symbol);
      const slippage = basePrice * this.slippageRate;
      const executionPrice =
        order.side === 'buy' ? basePrice + slippage : basePrice - slippage;

      // Execute trade
      let trade: Trade | null;
      if (order.side === 'buy') {
        trade = portfolio.buy(
          order.symbol,
          order.quantity,
          executionPrice,
          order.id
        );
      } else {
        trade = portfolio.sell(
          order.symbol,
          order.quantity,
          executionPrice,
          order.id
        );
      }

      if (!trade) {
        order.status = 'rejected';
        order.updatedAt = Date.now();
        order.notes =
          order.side === 'buy' ? 'Insufficient funds' : 'Insufficient shares';
        return {
          success: false,
          order,
          error: order.notes,
        };
      }

      // Update order status
      order.status = 'filled';
      order.filledQuantity = order.quantity;
      order.avgFillPrice = executionPrice;
      order.filledAt = Date.now();
      order.updatedAt = Date.now();
      order.commission = trade.commission;

      return { success: true, order, trade };
    } catch (error) {
      order.status = 'rejected';
      order.updatedAt = Date.now();
      order.notes = `Execution failed: ${(error as Error).message}`;
      return {
        success: false,
        order,
        error: order.notes,
      };
    }
  }

  /**
   * Execute a limit order if price conditions are met
   */
  private async executeLimitOrder(
    portfolio: Portfolio,
    order: Order,
    currentPrice: number
  ): Promise<OrderResult | null> {
    // Check if limit price is reached
    const priceReached =
      order.side === 'buy'
        ? currentPrice <= (order.limitPrice ?? Infinity)
        : currentPrice >= (order.limitPrice ?? 0);

    if (!priceReached) {
      return null; // Price not reached, order remains pending
    }

    // Execute at limit price (or better)
    const executionPrice =
      order.side === 'buy'
        ? Math.min(currentPrice, order.limitPrice ?? currentPrice)
        : Math.max(currentPrice, order.limitPrice ?? currentPrice);

    let trade: Trade | null;
    if (order.side === 'buy') {
      trade = portfolio.buy(
        order.symbol,
        order.quantity,
        executionPrice,
        order.id
      );
    } else {
      trade = portfolio.sell(
        order.symbol,
        order.quantity,
        executionPrice,
        order.id
      );
    }

    if (!trade) {
      order.status = 'rejected';
      order.updatedAt = Date.now();
      order.notes =
        order.side === 'buy' ? 'Insufficient funds' : 'Insufficient shares';
      this.pendingOrders.delete(order.id);
      return {
        success: false,
        order,
        error: order.notes,
      };
    }

    // Update order status
    order.status = 'filled';
    order.filledQuantity = order.quantity;
    order.avgFillPrice = executionPrice;
    order.filledAt = Date.now();
    order.updatedAt = Date.now();
    order.commission = trade.commission;
    this.pendingOrders.delete(order.id);

    return { success: true, order, trade };
  }

  /**
   * Process pending limit orders
   * Call this periodically or when prices update
   */
  async processPendingOrders(
    portfolio: Portfolio
  ): Promise<OrderResult[]> {
    const results: OrderResult[] = [];
    const symbols = new Set<string>();

    // Collect unique symbols
    for (const order of this.pendingOrders.values()) {
      if (order.portfolioId === portfolio.id) {
        symbols.add(order.symbol);
      }
    }

    if (symbols.size === 0) return results;

    // Get current prices
    const prices = await this.priceProvider.getPrices(Array.from(symbols));

    // Process each pending order
    for (const [orderId, order] of this.pendingOrders) {
      if (order.portfolioId !== portfolio.id) continue;

      const currentPrice = prices.get(order.symbol);
      if (currentPrice === undefined) continue;

      const result = await this.executeLimitOrder(
        portfolio,
        order,
        currentPrice
      );
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) return false;

    if (order.status !== 'pending') {
      return false; // Can only cancel pending orders
    }

    order.status = 'cancelled';
    order.cancelledAt = Date.now();
    order.updatedAt = Date.now();
    this.pendingOrders.delete(orderId);

    return true;
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders for a portfolio
   */
  getOrdersForPortfolio(portfolioId: string): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.portfolioId === portfolioId
    );
  }

  /**
   * Get pending orders for a portfolio
   */
  getPendingOrders(portfolioId: string): Order[] {
    return Array.from(this.pendingOrders.values()).filter(
      (o) => o.portfolioId === portfolioId
    );
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(portfolioId: string, status: OrderStatus): Order[] {
    return Array.from(this.orders.values()).filter(
      (o) => o.portfolioId === portfolioId && o.status === status
    );
  }

  /**
   * Get all orders
   */
  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  /**
   * Clear all orders (for testing)
   */
  clearOrders(): void {
    this.orders.clear();
    this.pendingOrders.clear();
  }
}
