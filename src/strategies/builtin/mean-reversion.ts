/**
 * Mean Reversion Strategy
 * Bet on price reversal to the mean
 */

import { BaseStrategy } from '../base';
import type {
  StrategyInput,
  StrategyResult,
  ParamDefinition,
  RiskLevel,
  Signal,
} from '../types';

export class MeanReversionStrategy extends BaseStrategy {
  readonly name = 'mean-reversion';
  readonly description = 'Contrarian strategy that buys oversold stocks and sells overbought ones';
  readonly riskLevel: RiskLevel = 'high';

  readonly paramDefinitions: ParamDefinition[] = [
    {
      name: 'oversoldRSI',
      type: 'number',
      default: 30,
      min: 10,
      max: 40,
      description: 'RSI level considered oversold (buy signal)',
    },
    {
      name: 'overboughtRSI',
      type: 'number',
      default: 70,
      min: 60,
      max: 90,
      description: 'RSI level considered overbought (sell signal)',
    },
    {
      name: 'bollingerDeviation',
      type: 'number',
      default: 2,
      min: 1,
      max: 3,
      description: 'Standard deviations for Bollinger Bands',
    },
    {
      name: 'useSMAFilter',
      type: 'boolean',
      default: true,
      description: 'Only trade in direction of 200-day SMA trend',
    },
    {
      name: 'maxPositions',
      type: 'number',
      default: 8,
      min: 1,
      max: 30,
      description: 'Maximum number of positions',
    },
  ];

  generateSignals(input: StrategyInput): StrategyResult {
    this.ensureParams();
    const startTime = Date.now();
    const signals: Signal[] = [];

    const oversoldRSI = this._parameters!.oversoldRSI as number;
    const overboughtRSI = this._parameters!.overboughtRSI as number;
    const useSMAFilter = this._parameters!.useSMAFilter as boolean;
    const maxPositions = this._parameters!.maxPositions as number;

    for (const symbol of input.symbols) {
      const factorData = input.factorData.get(symbol);
      if (!factorData) continue;

      const rsi = this.getFactorValue(factorData, 'rsi_14');
      const bollingerPctB = this.getFactorValue(factorData, 'bollinger_pct_b');
      const priceToSMA200 = this.getFactorValue(factorData, 'price_to_sma_200');

      if (rsi === null) continue;

      // SMA trend filter
      const inUptrend = priceToSMA200 !== null && priceToSMA200 > 0;
      const inDowntrend = priceToSMA200 !== null && priceToSMA200 < 0;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      let score = 50;

      // Oversold conditions - potential buy
      if (rsi < oversoldRSI) {
        // If using SMA filter, only buy in uptrend
        if (!useSMAFilter || inUptrend) {
          action = 'buy';
          // Score based on how oversold
          score = 100 - rsi; // Lower RSI = higher buy score

          // Bollinger confirmation
          if (bollingerPctB !== null && bollingerPctB < 0) {
            score += 10; // Price below lower band
          }
        }
      }

      // Overbought conditions - potential sell
      if (rsi > overboughtRSI) {
        // If using SMA filter, only sell in downtrend
        if (!useSMAFilter || inDowntrend) {
          action = 'sell';
          // Score based on how overbought
          score = rsi; // Higher RSI = higher sell score

          // Bollinger confirmation
          if (bollingerPctB !== null && bollingerPctB > 100) {
            score += 10; // Price above upper band
          }
        }
      }

      if (action !== 'hold') {
        const confidence = Math.min(1, Math.abs(score - 50) / 50);

        const contributions = [
          {
            name: 'rsi_14',
            value: rsi,
            weight: 0.6,
            contribution: (action === 'buy' ? 100 - rsi : rsi) * 0.006,
          },
        ];

        if (bollingerPctB !== null) {
          contributions.push({
            name: 'bollinger_pct_b',
            value: bollingerPctB,
            weight: 0.4,
            contribution:
              (action === 'buy' ? 100 - bollingerPctB : bollingerPctB) * 0.004,
          });
        }

        signals.push(
          this.createSignal(symbol, action, confidence, score, contributions, {
            rsi,
            bollingerPctB,
            priceToSMA200,
            inUptrend,
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
