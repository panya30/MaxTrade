/**
 * Screener Page
 * Factor-based stock screening
 */

import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/Card';
import { Button } from '../components/Button';
import { useScreen } from '../hooks/useApi';
import type { ScreenResult } from '../lib/types';

interface FactorFilter {
  name: string;
  min?: number;
  max?: number;
  weight: number;
}

const defaultFilters: FactorFilter[] = [
  { name: 'momentum_20d', min: 0, weight: 1 },
  { name: 'rsi_14', min: 30, max: 70, weight: 1 },
  { name: 'pe_ratio', max: 30, weight: 1 },
];

export function Screener() {
  const [filters, setFilters] = useState<FactorFilter[]>(defaultFilters);
  const [results, setResults] = useState<ScreenResult[]>([]);
  const screen = useScreen();

  const handleAddFilter = () => {
    setFilters([...filters, { name: '', weight: 1 }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleUpdateFilter = (index: number, field: keyof FactorFilter, value: string | number) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [field]: value };
    setFilters(updated);
  };

  const handleScreen = async () => {
    const validFilters = filters.filter((f) => f.name);
    if (validFilters.length === 0) return;

    const result = await screen.mutateAsync({
      factors: validFilters,
      limit: 20,
    });
    setResults(result);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader
          title="Factor Filters"
          subtitle="Configure screening criteria"
          action={
            <Button size="sm" onClick={handleAddFilter}>
              Add Filter
            </Button>
          }
        />
        <CardContent>
          <div className="space-y-4">
            {filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-4">
                <select
                  value={filter.name}
                  onChange={(e) => handleUpdateFilter(index, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select factor...</option>
                  <option value="momentum_20d">Momentum (20d)</option>
                  <option value="momentum_60d">Momentum (60d)</option>
                  <option value="rsi_14">RSI (14)</option>
                  <option value="macd">MACD</option>
                  <option value="pe_ratio">P/E Ratio</option>
                  <option value="pb_ratio">P/B Ratio</option>
                  <option value="roe">ROE</option>
                  <option value="volatility_20d">Volatility (20d)</option>
                </select>

                <input
                  type="number"
                  placeholder="Min"
                  value={filter.min ?? ''}
                  onChange={(e) =>
                    handleUpdateFilter(index, 'min', e.target.value ? parseFloat(e.target.value) : undefined as unknown as number)
                  }
                  className="w-24 px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <input
                  type="number"
                  placeholder="Max"
                  value={filter.max ?? ''}
                  onChange={(e) =>
                    handleUpdateFilter(index, 'max', e.target.value ? parseFloat(e.target.value) : undefined as unknown as number)
                  }
                  className="w-24 px-3 py-2 bg-bg-hover border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFilter(index)}
                >
                  ✕
                </Button>
              </div>
            ))}

            <div className="pt-4 border-t border-border">
              <Button onClick={handleScreen} loading={screen.isPending}>
                Run Screen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader
            title="Results"
            subtitle={`${results.length} stocks found`}
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-hover">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase">
                      Score
                    </th>
                    {filters.filter((f) => f.name).map((filter) => (
                      <th
                        key={filter.name}
                        className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase"
                      >
                        {filter.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((result) => (
                    <tr key={result.symbol} className="hover:bg-bg-hover">
                      <td className="px-4 py-3 text-text-muted">{result.rank}</td>
                      <td className="px-4 py-3 font-medium text-text">
                        {result.symbol}
                      </td>
                      <td className="px-4 py-3 text-right text-primary font-medium">
                        {result.score.toFixed(1)}
                      </td>
                      {filters.filter((f) => f.name).map((filter) => (
                        <td
                          key={filter.name}
                          className="px-4 py-3 text-right text-text"
                        >
                          {result.factors[filter.name]?.toFixed(2) ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
