/**
 * Dashboard Page
 * Main overview with portfolio summary and market data
 */

import { Card, CardHeader, CardContent, StatCard } from '../components/Card';
import { PriceDisplay } from '../components/PriceChange';
import { usePortfolio, useQuote } from '../hooks/useApi';

const watchlistSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN'];

export function Dashboard() {
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <section>
        <h2 className="text-lg font-semibold text-text mb-4">Portfolio Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Value"
            value={portfolioLoading ? '-' : portfolio?.totalValue ?? 0}
            prefix="$"
            change={portfolio?.dayChangePercent}
          />
          <StatCard
            label="Cash Balance"
            value={portfolioLoading ? '-' : portfolio?.cash ?? 0}
            prefix="$"
          />
          <StatCard
            label="Day Change"
            value={portfolioLoading ? '-' : portfolio?.dayChange ?? 0}
            prefix="$"
            change={portfolio?.dayChangePercent}
          />
          <StatCard
            label="Positions"
            value={portfolioLoading ? '-' : portfolio?.positions.length ?? 0}
          />
        </div>
      </section>

      {/* Watchlist */}
      <section>
        <Card>
          <CardHeader title="Watchlist" subtitle="Track your favorite symbols" />
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {watchlistSymbols.map((symbol) => (
                <WatchlistItem key={symbol} symbol={symbol} />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Holdings */}
      {portfolio && portfolio.positions.length > 0 && (
        <section>
          <Card>
            <CardHeader
              title="Holdings"
              subtitle={`${portfolio.positions.length} positions`}
            />
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-bg-hover">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                        Symbol
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                        Shares
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                        Value
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                        P&L
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {portfolio.positions.map((position) => (
                      <tr key={position.symbol} className="hover:bg-bg-hover">
                        <td className="px-4 py-3 font-medium text-text">
                          {position.symbol}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          {position.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          ${position.currentPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          ${position.marketValue.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            position.unrealizedPnl >= 0 ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {position.unrealizedPnl >= 0 ? '+' : ''}
                          ${position.unrealizedPnl.toFixed(2)} ({position.unrealizedPnlPercent.toFixed(2)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function WatchlistItem({ symbol }: { symbol: string }) {
  const { data: quote, isLoading } = useQuote(symbol);

  if (isLoading || !quote) {
    return (
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-medium text-text">{symbol}</span>
        <span className="text-text-muted">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-bg-hover">
      <div>
        <span className="font-medium text-text">{symbol}</span>
      </div>
      <PriceDisplay
        price={quote.price}
        change={quote.change}
        changePercent={quote.changePercent}
        className="text-right"
      />
    </div>
  );
}
