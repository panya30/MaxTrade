/**
 * Momentum Strategy
 * Buy winners, sell losers - trend following approach
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class MomentumStrategy extends BaseStrategy {
  readonly name = 'momentum';
  readonly description = 'Trend-following strategy that buys recent winners and sells losers';
  readonly riskLevel: RiskLevel = 'high';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'lookbackPeriod',
      type: 'select',
      default: '60d',
      options: ['20d', '60d', '252d'],
      description: 'Lookback period for momentum calculation',
    },
    {
      name: 'buyThreshold',
      type: 'number',
      default: 70,
      min: 50,
      max: 95,
      description: 'Percentile threshold to generate buy signal',
    },
    {
      name: 'sellThreshold',
      type: 'number',
      default: 30,
      min: 5,
      max: 50,
      description: 'Percentile threshold to generate sell signal',
    },
    {
      name: 'useRSIFilter',
      type: 'boolean',
      default: true,
      description: 'Filter overbought/oversold with RSI',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 10,
      min: 1,
      max: 50,
      description: 'Maximum number of positions',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    this.ensureParams();
    const startTime = Date.now();
    const signals: Signal[] = [];

    const lookbackPeriod = this._parameters!.lookbackPeriod as string;
    const buyThreshold = this._parameters!.buyThreshold as number;
    const sellThreshold = this._parameters!.sellThreshold as number;
    const useRSIFilter = this._parameters!.useRSIFilter as boolean;
    const maxPositions = this._parameters!.maxPositions as number;

    // Map lookback period to factor name
    const momentumFactor = `momentum_${lookbackPeriod.replace('d', '')}d`;

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      const { score, contributions } = this.calculateWeightedScore(factorData, {
        [momentumFactor]: { weight: 0.6, higherIsBetter: true },
        momentum_accel_20d: { weight: 0.2, higherIsBetter: true },
        volume_momentum_20d: { weight: 0.2, higherIsBetter: true },
      });

      // RSI filter: avoid overbought (>70) and oversold (<30)
      if (useRSIFilter) {
        const rsi = this.getFactorValue(factorData, 'rsi_14');
        if (rsi !== null) {
          if (score >= buyThreshold && rsi > 70) {
            // Skip overbought
            continue;
          }
          if (score <= sellThreshold && rsi < 30) {
            // Skip oversold
            continue;
          }
        }
      }

      const action = this.scoreToAction(score, buyThreshold, sellThreshold);
      const confidence = this.scoreToConfidence(score, buyThreshold, sellThreshold);

      if (action !== 'hold') {
        signals.push(
          this.createSignal(symbol, action, confidence, score, contributions, {
            momentumFactor,
            rsi: this.getFactorValue(factorData, 'rsi_14'),
          })
        );
      }
    }

    // Sort by confidence and limit positions
    signals.sort((a, b) => b.confidence - a.confidence);
    const limitedSignals = signals.slice(0, maxPositions);

    return this.createResult(limitedSignals, startTime);
  }
}
