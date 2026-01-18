/**
 * Value Strategy
 * Buy undervalued stocks based on fundamental metrics
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class ValueStrategy extends BaseStrategy {
  readonly name = 'value';
  readonly description = 'Value investing strategy that buys undervalued stocks with strong fundamentals';
  readonly riskLevel: RiskLevel = 'medium';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'buyThreshold',
      type: 'number',
      default: 70,
      min: 50,
      max: 95,
      description: 'Composite value score threshold for buy',
    },
    {
      name: 'sellThreshold',
      type: 'number',
      default: 30,
      min: 5,
      max: 50,
      description: 'Composite value score threshold for sell',
    },
    {
      name: 'peWeight',
      type: 'number',
      default: 0.3,
      min: 0,
      max: 1,
      description: 'Weight for P/E ratio',
    },
    {
      name: 'pbWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for P/B ratio',
    },
    {
      name: 'dividendWeight',
      type: 'number',
      default: 0.2,
      min: 0,
      max: 1,
      description: 'Weight for dividend yield',
    },
    {
      name: 'evEbitdaWeight',
      type: 'number',
      default: 0.25,
      min: 0,
      max: 1,
      description: 'Weight for EV/EBITDA',
    },
    {
      name: 'requireDividend',
      type: 'boolean',
      default: false,
      description: 'Only consider dividend-paying stocks',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 15,
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
    const requireDividend = this._parameters!.requireDividend as boolean;
    const maxPositions = this._parameters!.maxPositions as number;

    // Build weights from parameters
    const weights: Record<string, { weight: number; higherIsBetter: boolean }> = {
      pe_ratio: {
        weight: this._parameters!.peWeight as number,
        higherIsBetter: false, // Lower P/E is better
      },
      pb_ratio: {
        weight: this._parameters!.pbWeight as number,
        higherIsBetter: false, // Lower P/B is better
      },
      dividend_yield: {
        weight: this._parameters!.dividendWeight as number,
        higherIsBetter: true, // Higher yield is better
      },
      ev_ebitda: {
        weight: this._parameters!.evEbitdaWeight as number,
        higherIsBetter: false, // Lower EV/EBITDA is better
      },
    };

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      // Check dividend requirement
      if (requireDividend) {
        const divYield = this.getFactorValue(factorData, 'dividend_yield');
        if (divYield === null || divYield <= 0) continue;
      }

      const { score, contributions } = this.calculateWeightedScore(factorData, weights);

      // Skip if insufficient data (score is 0)
      if (score === 0) continue;

      const action = this.scoreToAction(score, buyThreshold, sellThreshold);
      const confidence = this.scoreToConfidence(score, buyThreshold, sellThreshold);

      if (action !== 'hold') {
        signals.push(
          this.createSignal(symbol, action, confidence, score, contributions, {
            pe: this.getFactorValue(factorData, 'pe_ratio'),
            pb: this.getFactorValue(factorData, 'pb_ratio'),
            dividendYield: this.getFactorValue(factorData, 'dividend_yield'),
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
