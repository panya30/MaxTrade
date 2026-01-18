/**
 * Multi-Factor Strategy
 * Balanced approach combining momentum, value, quality, and volatility
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class MultiFactorStrategy extends BaseStrategy {
  readonly name = 'multi-factor';
  readonly description = 'Diversified strategy combining momentum, value, quality, and volatility factors';
  readonly riskLevel: RiskLevel = 'medium';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'buyThreshold',
      type: 'number',
      default: 65,
      min: 50,
      max: 95,
      description: 'Composite score threshold for buy',
    },
    {
      name: 'sellThreshold',
      type: 'number',
      default: 35,
      min: 5,
      max: 50,
      description: 'Composite score threshold for sell',
    },
    {
      name: 'momentumWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for momentum factors',
    },
    {
      name: 'valueWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for value factors',
    },
    {
      name: 'qualityWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for quality factors',
    },
    {
      name: 'volatilityWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for volatility factors (inverted)',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 20,
      min: 1,
      max: 100,
      description: 'Maximum number of positions',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    this.ensureParams();
    const startTime = Date.now();
    const signals: Signal[] = [];

    const buyThreshold = this._parameters!.buyThreshold as number;
    const sellThreshold = this._parameters!.sellThreshold as number;
    const momentumWeight = this._parameters!.momentumWeight as number;
    const valueWeight = this._parameters!.valueWeight as number;
    const qualityWeight = this._parameters!.qualityWeight as number;
    const volatilityWeight = this._parameters!.volatilityWeight as number;
    const maxPositions = this._parameters!.maxPositions as number;

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      // Momentum score
      const { score: momentumScore, contributions: momentumContribs } =
        this.calculateWeightedScore(factorData, {
          momentum_60d: { weight: 0.5, higherIsBetter: true },
          momentum_20d: { weight: 0.3, higherIsBetter: true },
          rsi_14: { weight: 0.2, higherIsBetter: false }, // Neutral RSI is better
        });

      // Value score
      const { score: valueScore, contributions: valueContribs } =
        this.calculateWeightedScore(factorData, {
          pe_ratio: { weight: 0.4, higherIsBetter: false },
          pb_ratio: { weight: 0.3, higherIsBetter: false },
          dividend_yield: { weight: 0.3, higherIsBetter: true },
        });

      // Quality score
      const { score: qualityScore, contributions: qualityContribs } =
        this.calculateWeightedScore(factorData, {
          roe: { weight: 0.4, higherIsBetter: true },
          profit_margin: { weight: 0.3, higherIsBetter: true },
          debt_to_equity: { weight: 0.3, higherIsBetter: false },
        });

      // Volatility score (lower volatility preferred)
      const { score: volatilityScore, contributions: volatilityContribs } =
        this.calculateWeightedScore(factorData, {
          volatility_20d: { weight: 0.5, higherIsBetter: false },
          max_drawdown: { weight: 0.3, higherIsBetter: false },
          sharpe_ratio: { weight: 0.2, higherIsBetter: true },
        });

      // Combine scores
      const totalWeight = momentumWeight + valueWeight + qualityWeight + volatilityWeight;
      const combinedScore =
        (momentumScore * momentumWeight +
          valueScore * valueWeight +
          qualityScore * qualityWeight +
          volatilityScore * volatilityWeight) /
        totalWeight;

      // Aggregate contributions
      const contributions = [
        ...momentumContribs.map((c) => ({ ...c, weight: c.weight * momentumWeight })),
        ...valueContribs.map((c) => ({ ...c, weight: c.weight * valueWeight })),
        ...qualityContribs.map((c) => ({ ...c, weight: c.weight * qualityWeight })),
        ...volatilityContribs.map((c) => ({ ...c, weight: c.weight * volatilityWeight })),
      ];

      const action = this.scoreToAction(combinedScore, buyThreshold, sellThreshold);
      const confidence = this.scoreToConfidence(combinedScore, buyThreshold, sellThreshold);

      if (action !== 'hold') {
        signals.push(
          this.createSignal(symbol, action, confidence, combinedScore, contributions, {
            momentumScore,
            valueScore,
            qualityScore,
            volatilityScore,
          })
        );
      }
    }

    // Sort by confidence and limit
    signals.sort((a, b) => b.confidence - a.confidence);
    const limitedSignals = signals.slice(0, maxPositions);

    return this.createResult(limitedSignals, startTime);
  }
}
