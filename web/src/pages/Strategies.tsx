/**
 * Strategies Page
 * Strategy list and backtest runner
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useStrategies, useBacktest } from '../hooks/useApi';
import type { BacktestResult } from '../lib/types';

export function Strategies() {
  const { data: strategiesData, isLoading } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const backtest = useBacktest();

  const handleBacktest = async () => {
    if (!selectedStrategy) return;

    const result = await backtest.mutateAsync({
      strategyId: selectedStrategy,
      symbols: ['AAPL', 'GOOGL', 'MSFT', 'AMZN'],
      startDate: Date.now() - 365 * 24 * 60 * 60 * 1000,
      endDate: Date.now(),
      initialCapital: 100000,
    });

    setBacktestResult(result);
  };

  return (
    <div className="space-y-6">
      {/* Strategy List */}
      <Card>
        <CardHeader title="Trading Strategies" subtitle="Select a strategy to backtest" />
        <CardContent>
          {isLoading ? (
            <div className="text-text-muted">Loading strategies...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {strategiesData?.items.map((strategy) => (
                <button
                  key={strategy.id}
                  onClick={() => setSelectedStrategy(strategy.id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedStrategy === strategy.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <h3 className="font-medium text-text">{strategy.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{strategy.description}</p>
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-bg-hover rounded text-text-muted">
                    {strategy.category}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedStrategy && (
            <div className="mt-6 pt-6 border-t border-border">
              <Button onClick={handleBacktest} loading={backtest.isPending}>
                Run Backtest
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backtest Results */}
      {backtestResult && (
        <Card>
          <CardHeader
            title="Backtest Results"
            subtitle={backtestResult.strategyName}
          />
          <CardContent>
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <MetricCard
                label="Total Return"
                value={`${backtestResult.metrics.totalReturn.toFixed(2)}%`}
                positive={backtestResult.metrics.totalReturn >= 0}
              />
              <MetricCard
                label="Sharpe Ratio"
                value={backtestResult.metrics.sharpeRatio.toFixed(2)}
              />
              <MetricCard
                label="Max Drawdown"
                value={`${backtestResult.metrics.maxDrawdown.toFixed(2)}%`}
                positive={false}
              />
              <MetricCard
                label="Win Rate"
                value={`${backtestResult.metrics.winRate.toFixed(1)}%`}
                positive={backtestResult.metrics.winRate >= 50}
              />
              <MetricCard
                label="Total Trades"
                value={backtestResult.metrics.totalTrades.toString()}
              />
            </div>

            {/* Equity Curve */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-text-muted mb-3">Equity Curve</h4>
              <div className="h-48 bg-bg-hover rounded-lg flex items-center justify-center">
                <div className="flex items-end gap-1 h-32">
                  {backtestResult.equityCurve.map((point, i) => (
                    <div
                      key={i}
                      className="w-2 bg-primary rounded-t"
                      style={{
                        height: `${(point.equity / 150000) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div>
              <h4 className="text-sm font-medium text-text-muted mb-3">
                Sample Trades
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-text-muted">Date</th>
                      <th className="px-3 py-2 text-left text-text-muted">Symbol</th>
                      <th className="px-3 py-2 text-left text-text-muted">Side</th>
                      <th className="px-3 py-2 text-right text-text-muted">Qty</th>
                      <th className="px-3 py-2 text-right text-text-muted">Price</th>
                      <th className="px-3 py-2 text-right text-text-muted">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestResult.trades.slice(0, 5).map((trade, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-2 text-text">
                          {new Date(trade.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-text">{trade.symbol}</td>
                        <td
                          className={`px-3 py-2 ${
                            trade.side === 'buy' ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {trade.side.toUpperCase()}
                        </td>
                        <td className="px-3 py-2 text-right text-text">
                          {trade.quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-text">
                          ${trade.price.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${
                            (trade.pnl ?? 0) >= 0 ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {trade.pnl ? `$${trade.pnl.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="p-3 bg-bg-hover rounded-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p
        className={`text-lg font-bold mt-1 ${
          positive === undefined
            ? 'text-text'
            : positive
              ? 'text-bull'
              : 'text-bear'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
