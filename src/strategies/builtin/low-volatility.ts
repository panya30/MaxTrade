/**
 * Low Volatility Strategy
 * Defensive approach focusing on stable, low-volatility stocks
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class LowVolatilityStrategy extends BaseStrategy {
  readonly name = 'low-volatility';
  readonly description = 'Defensive strategy that invests in stable, low-volatility stocks';
  readonly riskLevel: RiskLevel = 'low';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'maxVolatility',
      type: 'number',
      default: 25,
      min: 5,
      max: 50,
      description: 'Maximum annualized volatility % to consider',
    },
    {
      name: 'maxBeta',
      type: 'number',
      default: 1.0,
      min: 0.1,
      max: 2.0,
      description: 'Maximum beta to consider',
    },
    {
      name: 'minSharpe',
      type: 'number',
      default: 0.5,
      min: -1,
      max: 3,
      description: 'Minimum Sharpe ratio to consider',
    },
    {
      name: 'buyThreshold',
      type: 'number',
      default: 60,
      min: 50,
      max: 95,
      description: 'Stability score threshold for buy',
    },
    {
      name: 'includeQuality',
      type: 'boolean',
      default: true,
      description: 'Include quality factors in scoring',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 25,
      min: 1,
      max: 100,
      description: 'Maximum number of positions',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    this.ensureParams();
    const startTime = Date.now();
    const signals: Signal[] = [];

    const maxVolatility = this._parameters!.maxVolatility as number;
    const maxBeta = this._parameters!.maxBeta as number;
    const minSharpe = this._parameters!.minSharpe as number;
    const buyThreshold = this._parameters!.buyThreshold as number;
    const includeQuality = this._parameters!.includeQuality as boolean;
    const maxPositions = this._parameters!.maxPositions as number;

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      // Hard filters
      const volatility = this.getFactorValue(factorData, 'volatility_20d');
      const beta = this.getFactorValue(factorData, 'beta');
      const sharpe = this.getFactorValue(factorData, 'sharpe_ratio');

      if (volatility !== null && volatility > maxVolatility) continue;
      if (beta !== null && beta > maxBeta) continue;
      if (sharpe !== null && sharpe < minSharpe) continue;

      // Stability score
      const stabilityWeights: Record<string, { weight: number; higherIsBetter: boolean }> = {
        volatility_20d: { weight: 0.35, higherIsBetter: false },
        max_drawdown: { weight: 0.25, higherIsBetter: false },
        sharpe_ratio: { weight: 0.25, higherIsBetter: true },
        downside_deviation: { weight: 0.15, higherIsBetter: false },
      };

      // Optionally include quality
      if (includeQuality) {
        stabilityWeights.profit_margin = { weight: 0.15, higherIsBetter: true };
        stabilityWeights.debt_to_equity = { weight: 0.1, higherIsBetter: false };
        stabilityWeights.dividend_yield = { weight: 0.1, higherIsBetter: true };

        // Rebalance weights
        const totalWeight = Object.values(stabilityWeights).reduce((s, w) => s + w.weight, 0);
        for (const key of Object.keys(stabilityWeights)) {
          stabilityWeights[key].weight /= totalWeight;
        }
      }

      const { score, contributions } = this.calculateWeightedScore(factorData, stabilityWeights);

      if (score === 0) continue;

      // Low vol strategy only generates buy signals for stable stocks
      if (score >= buyThreshold) {
        const confidence = Math.min(1, (score - buyThreshold) / (100 - buyThreshold));

        signals.push(
          this.createSignal(symbol, 'buy', confidence, score, contributions, {
            volatility,
            beta,
            sharpe,
            maxDrawdown: this.getFactorValue(factorData, 'max_drawdown'),
          })
        );
      }
    }

    // Sort by score (higher stability score is better)
    signals.sort((a, b) => b.strength - a.strength);
    const limitedSignals = signals.slice(0, maxPositions);

    return this.createResult(limitedSignals, startTime);
  }
}
