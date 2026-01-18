/**
 * Risk Manager
 * Handles risk checks and portfolio limits
 */

import type {
  OrderRequest,
  RiskCheckResult,
  RiskLimits,
  PriceProvider,
} from './types';
import { DEFAULT_RISK_LIMITS } from './types';
import { Portfolio } from './portfolio';

/**
 * Risk Manager
 * Validates orders against portfolio risk limits
 */
export class RiskManager {
  private limits: RiskLimits;
  private priceProvider: PriceProvider;

  constructor(
    priceProvider: PriceProvider,
    limits: Partial<RiskLimits> = {}
  ) {
    this.priceProvider = priceProvider;
    this.limits = { ...DEFAULT_RISK_LIMITS, ...limits };
  }

  /**
   * Get current risk limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Update risk limits
   */
  setLimits(limits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Check if an order passes all risk checks
   */
  async checkOrder(
    portfolio: Portfolio,
    request: OrderRequest
  ): Promise<RiskCheckResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Only check buy orders for most limits
    if (request.side === 'buy') {
      // Get current price
      const price =
        request.type === 'limit' && request.limitPrice
          ? request.limitPrice
          : await this.priceProvider.getPrice(request.symbol);

      const orderValue = request.quantity * price;
      const totalValue = portfolio.getTotalValue();

      // Check 1: Position size limit
      const existingPosition = portfolio.getPosition(request.symbol);
      const existingValue = existingPosition?.marketValue ?? 0;
      const newPositionValue = existingValue + orderValue;
      const positionPct = newPositionValue / totalValue;

      if (positionPct > this.limits.maxPositionPct) {
        errors.push(
          `Position size (${(positionPct * 100).toFixed(1)}%) exceeds limit (${this.limits.maxPositionPct * 100}%)`
        );
      } else if (positionPct > this.limits.maxPositionPct * 0.8) {
        warnings.push(
          `Position size (${(positionPct * 100).toFixed(1)}%) approaching limit`
        );
      }

      // Check 2: Maximum position value
      if (newPositionValue > this.limits.maxPositionValue) {
        errors.push(
          `Position value ($${newPositionValue.toFixed(2)}) exceeds limit ($${this.limits.maxPositionValue})`
        );
      }

      // Check 3: Number of positions
      const positionCount = portfolio.getPositions().length;
      const isNewPosition = !existingPosition;
      if (isNewPosition && positionCount >= this.limits.maxPositions) {
        errors.push(
          `Maximum number of positions (${this.limits.maxPositions}) reached`
        );
      } else if (
        isNewPosition &&
        positionCount >= this.limits.maxPositions * 0.9
      ) {
        warnings.push(
          `Approaching maximum position count (${positionCount}/${this.limits.maxPositions})`
        );
      }

      // Check 4: Cash reserve
      const commission = portfolio.calculateCommission(orderValue);
      const totalCost = orderValue + commission;
      const remainingCash = portfolio.getCash() - totalCost;
      const minReserve = totalValue * this.limits.minCashReservePct;

      if (remainingCash < minReserve) {
        errors.push(
          `Insufficient cash reserve after trade (need $${minReserve.toFixed(2)}, would have $${remainingCash.toFixed(2)})`
        );
      }

      // Check 5: Concentration
      const concentrationPct = newPositionValue / totalValue;
      if (concentrationPct > this.limits.maxConcentrationPct) {
        errors.push(
          `Concentration (${(concentrationPct * 100).toFixed(1)}%) exceeds limit (${this.limits.maxConcentrationPct * 100}%)`
        );
      }

      // Check 6: Buying power
      if (!portfolio.canAfford(orderValue)) {
        errors.push('Insufficient buying power');
      }
    } else {
      // Sell order checks

      // Check 1: Position exists
      const position = portfolio.getPosition(request.symbol);
      if (!position) {
        errors.push(`No position in ${request.symbol}`);
      } else if (position.quantity < request.quantity) {
        errors.push(
          `Insufficient shares (have ${position.quantity}, selling ${request.quantity})`
        );
      }
    }

    // Common checks

    // Check 7: Daily loss limit
    const dayChangePct = Math.abs(portfolio.getDayChangePercent()) / 100;
    if (
      portfolio.getDayChange() < 0 &&
      dayChangePct >= this.limits.maxDailyLossPct
    ) {
      errors.push(
        `Daily loss limit (${this.limits.maxDailyLossPct * 100}%) reached`
      );
    } else if (
      portfolio.getDayChange() < 0 &&
      dayChangePct >= this.limits.maxDailyLossPct * 0.8
    ) {
      warnings.push(
        `Approaching daily loss limit (${(dayChangePct * 100).toFixed(1)}%)`
      );
    }

    // Check 8: Drawdown limit
    const drawdownPct = portfolio.getDrawdown() / 100;
    if (drawdownPct >= this.limits.maxDrawdownPct) {
      errors.push(
        `Maximum drawdown (${this.limits.maxDrawdownPct * 100}%) reached`
      );
    } else if (drawdownPct >= this.limits.maxDrawdownPct * 0.8) {
      warnings.push(
        `Approaching maximum drawdown (${(drawdownPct * 100).toFixed(1)}%)`
      );
    }

    return {
      allowed: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Get portfolio risk summary
   */
  getPortfolioRiskSummary(portfolio: Portfolio): {
    positionCount: number;
    maxPositionPct: number;
    largestPosition: { symbol: string; pct: number } | null;
    cashReservePct: number;
    dayChangePct: number;
    drawdownPct: number;
    violations: string[];
    warnings: string[];
  } {
    const totalValue = portfolio.getTotalValue();
    const positions = portfolio.getPositions();
    const violations: string[] = [];
    const warnings: string[] = [];

    // Find largest position
    let largestPosition: { symbol: string; pct: number } | null = null;
    let maxPct = 0;
    for (const pos of positions) {
      const pct = (pos.marketValue / totalValue) * 100;
      if (pct > maxPct) {
        maxPct = pct;
        largestPosition = { symbol: pos.symbol, pct };
      }
    }

    const cashReservePct = (portfolio.getCash() / totalValue) * 100;
    const dayChangePct = portfolio.getDayChangePercent();
    const drawdownPct = portfolio.getDrawdown();

    // Check for violations
    if (positions.length >= this.limits.maxPositions) {
      violations.push('Maximum positions reached');
    }

    if (maxPct / 100 > this.limits.maxPositionPct) {
      violations.push(`Position concentration exceeds ${this.limits.maxPositionPct * 100}%`);
    }

    if (cashReservePct / 100 < this.limits.minCashReservePct) {
      violations.push('Below minimum cash reserve');
    }

    if (dayChangePct < 0 && Math.abs(dayChangePct) / 100 >= this.limits.maxDailyLossPct) {
      violations.push('Daily loss limit exceeded');
    }

    if (drawdownPct / 100 >= this.limits.maxDrawdownPct) {
      violations.push('Maximum drawdown exceeded');
    }

    // Check for warnings
    if (positions.length >= this.limits.maxPositions * 0.9) {
      warnings.push('Approaching maximum positions');
    }

    if (maxPct / 100 > this.limits.maxPositionPct * 0.8) {
      warnings.push('Approaching position concentration limit');
    }

    return {
      positionCount: positions.length,
      maxPositionPct: maxPct,
      largestPosition,
      cashReservePct,
      dayChangePct,
      drawdownPct,
      violations,
      warnings,
    };
  }

  /**
   * Calculate maximum shares that can be bought within risk limits
   */
  async calculateMaxShares(
    portfolio: Portfolio,
    symbol: string,
    price?: number
  ): Promise<number> {
    const currentPrice = price ?? (await this.priceProvider.getPrice(symbol));
    const totalValue = portfolio.getTotalValue();

    // Limit 1: Cash available (minus reserve)
    const buyingPower = portfolio.getBuyingPower();
    const commission = portfolio.calculateCommission(buyingPower);
    const cashLimit = Math.floor((buyingPower - commission) / currentPrice);

    // Limit 2: Position size limit
    const existingPosition = portfolio.getPosition(symbol);
    const existingValue = existingPosition?.marketValue ?? 0;
    const maxPositionValue = totalValue * this.limits.maxPositionPct;
    const positionLimit = Math.floor(
      (maxPositionValue - existingValue) / currentPrice
    );

    // Limit 3: Max position value
    const valueLimit = Math.floor(
      (this.limits.maxPositionValue - existingValue) / currentPrice
    );

    // Limit 4: Concentration limit
    const maxConcentrationValue = totalValue * this.limits.maxConcentrationPct;
    const concentrationLimit = Math.floor(
      (maxConcentrationValue - existingValue) / currentPrice
    );

    // Return minimum of all limits
    return Math.max(
      0,
      Math.min(cashLimit, positionLimit, valueLimit, concentrationLimit)
    );
  }
}
