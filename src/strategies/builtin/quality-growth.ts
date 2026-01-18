/**
 * Quality Growth Strategy
 * High quality companies with strong growth characteristics
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class QualityGrowthStrategy extends BaseStrategy {
  readonly name = 'quality-growth';
  readonly description = 'Invest in high-quality companies with strong ROE, low debt, and growth momentum';
  readonly riskLevel: RiskLevel = 'medium';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'buyThreshold',
      type: 'number',
      default: 70,
      min: 50,
      max: 95,
      description: 'Composite quality score threshold for buy',
    },
    {
      name: 'sellThreshold',
      type: 'number',
      default: 30,
      min: 5,
      max: 50,
      description: 'Composite quality score threshold for sell',
    },
    {
      name: 'minROE',
      type: 'number',
      default: 15,
      min: 0,
      max: 50,
      description: 'Minimum ROE % to consider',
    },
    {
      name: 'maxDebtToEquity',
      type: 'number',
      default: 1.5,
      min: 0,
      max: 5,
      description: 'Maximum debt-to-equity ratio',
    },
    {
      name: 'qualityWeight',
      type: 'number',
      default: 0.5,
      min: 0,
      max: 1,
      description: 'Weight for quality factors',
    },
    {
      name: 'growthWeight',
      type: 'number',
      default: 0.5,
      min: 0,
      max: 1,
      description: 'Weight for growth/momentum factors',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 12,
      min: 1,
      max: 50,
      description: 'Maximum number of positions',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    this.ensureParams();
    const startTime = Date.now();
    const signals: Signal[] = [];

    const buyThreshold = this._parameters!.buyThreshold as number;
    const sellThreshold = this._parameters!.sellThreshold as number;
    const minROE = this._parameters!.minROE as number;
    const maxDebtToEquity = this._parameters!.maxDebtToEquity as number;
    const qualityWeight = this._parameters!.qualityWeight as number;
    const growthWeight = this._parameters!.growthWeight as number;
    const maxPositions = this._parameters!.maxPositions as number;

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      // Quality screens
      const roe = this.getFactorValue(factorData, 'roe');
      const debtToEquity = this.getFactorValue(factorData, 'debt_to_equity');

      if (roe !== null && roe < minROE) continue;
      if (debtToEquity !== null && debtToEquity > maxDebtToEquity) continue;

      // Calculate quality score
      const { score: qualityScore, contributions: qualityContribs } =
        this.calculateWeightedScore(factorData, {
          roe: { weight: 0.35, higherIsBetter: true },
          roa: { weight: 0.25, higherIsBetter: true },
          profit_margin: { weight: 0.25, higherIsBetter: true },
          debt_to_equity: { weight: 0.15, higherIsBetter: false },
        });

      // Calculate growth score
      const { score: growthScore, contributions: growthContribs } =
        this.calculateWeightedScore(factorData, {
          momentum_60d: { weight: 0.4, higherIsBetter: true },
          momentum_20d: { weight: 0.3, higherIsBetter: true },
          price_to_sma_50: { weight: 0.3, higherIsBetter: true },
        });

      // Combined score
      const totalWeight = qualityWeight + growthWeight;
      const combinedScore =
        (qualityScore * qualityWeight + growthScore * growthWeight) / totalWeight;

      const contributions = [
        ...qualityContribs.map((c) => ({
          ...c,
          weight: c.weight * qualityWeight,
        })),
        ...growthContribs.map((c) => ({
          ...c,
          weight: c.weight * growthWeight,
        })),
      ];

      const action = this.scoreToAction(combinedScore, buyThreshold, sellThreshold);
      const confidence = this.scoreToConfidence(combinedScore, buyThreshold, sellThreshold);

      if (action !== 'hold') {
        signals.push(
          this.createSignal(symbol, action, confidence, combinedScore, contributions, {
            qualityScore,
            growthScore,
            roe,
            debtToEquity,
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
