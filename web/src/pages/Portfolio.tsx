/**
 * Portfolio Page
 * Holdings, P&L, and trade management
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent, StatCard } from '../components/Card';
import { Button } from '../components/Button';
import { usePortfolio, usePlaceOrder, useTrades } from '../hooks/useApi';

export function Portfolio() {
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: tradesData } = useTrades(portfolio?.id ?? 'default');
  const placeOrder = usePlaceOrder();
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    side: 'buy' as 'buy' | 'sell',
    quantity: '',
  });

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderForm.symbol || !orderForm.quantity) return;

    await placeOrder.mutateAsync({
      portfolioId: portfolio?.id ?? 'default',
      symbol: orderForm.symbol.toUpperCase(),
      side: orderForm.side,
      quantity: parseInt(orderForm.quantity, 10),
      type: 'market',
    });

    setOrderForm({ symbol: '', side: 'buy', quantity: '' });
  };

  if (portfolioLoading) {
    return <div className="text-text-muted">Loading portfolio...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Value"
          value={portfolio?.totalValue ?? 0}
          prefix="$"
          change={portfolio?.dayChangePercent}
        />
        <StatCard label="Cash" value={portfolio?.cash ?? 0} prefix="$" />
        <StatCard
          label="Day Change"
          value={portfolio?.dayChange ?? 0}
          prefix="$"
          change={portfolio?.dayChangePercent}
        />
        <StatCard
          label="Positions"
          value={portfolio?.positions.length ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Form */}
        <Card className="lg:col-span-1">
          <CardHeader title="Place Order" />
          <CardContent>
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Symbol</label>
                <input
                  type="text"
                  value={orderForm.symbol}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, symbol: e.target.value })
                  }
                  placeholder="AAPL"
                  className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">Side</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderForm({ ...orderForm, side: 'buy' })}
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      orderForm.side === 'buy'
                        ? 'border-bull bg-bull/10 text-bull'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderForm({ ...orderForm, side: 'sell' })}
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      orderForm.side === 'sell'
                        ? 'border-bear bg-bear/10 text-bear'
                        : 'border-border text-text-muted'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={orderForm.quantity}
                  onChange={(e) =>
                    setOrderForm({ ...orderForm, quantity: e.target.value })
                  }
                  placeholder="100"
                  min="1"
                  className="w-full px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button
                type="submit"
                variant={orderForm.side === 'buy' ? 'success' : 'danger'}
                fullWidth
                loading={placeOrder.isPending}
              >
                {orderForm.side === 'buy' ? 'Buy' : 'Sell'} Market
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Holdings */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Holdings"
            subtitle={`${portfolio?.positions.length ?? 0} positions`}
          />
          <CardContent className="p-0">
            {portfolio?.positions.length === 0 ? (
              <div className="p-4 text-center text-text-muted">
                No positions yet. Place an order to get started.
              </div>
            ) : (
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
                        Avg Cost
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
                    {portfolio?.positions.map((pos) => (
                      <tr key={pos.symbol} className="hover:bg-bg-hover">
                        <td className="px-4 py-3 font-medium text-text">
                          {pos.symbol}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          {pos.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          ${pos.avgCost.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          ${pos.currentPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-text">
                          ${pos.marketValue.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            pos.unrealizedPnl >= 0 ? 'text-bull' : 'text-bear'
                          }`}
                        >
                          {pos.unrealizedPnl >= 0 ? '+' : ''}$
                          {pos.unrealizedPnl.toFixed(2)}
                          <br />
                          <span className="text-xs">
                            ({pos.unrealizedPnlPercent.toFixed(2)}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader
          title="Trade History"
          subtitle={`${tradesData?.total ?? 0} total trades`}
        />
        <CardContent className="p-0">
          {!tradesData?.items.length ? (
            <div className="p-4 text-center text-text-muted">
              No trades yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-hover">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                      Side
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                      P&L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tradesData?.items.map((trade) => (
                    <tr key={trade.id} className="hover:bg-bg-hover">
                      <td className="px-4 py-3 text-text">
                        {new Date(trade.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {trade.symbol}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          trade.side === 'buy' ? 'text-bull' : 'text-bear'
                        }`}
                      >
                        {trade.side.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-right text-text">
                        {trade.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-text">
                        ${trade.price.toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          (trade.pnl ?? 0) >= 0 ? 'text-bull' : 'text-bear'
                        }`}
                      >
                        {trade.pnl !== undefined
                          ? `$${trade.pnl.toFixed(2)}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
