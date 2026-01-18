/**
 * Price Change Component
 * Displays price changes with color coding
 */

interface PriceChangeProps {
  value: number;
  percent?: number;
  showArrow?: boolean;
  className?: string;
}

export function PriceChange({
  value,
  percent,
  showArrow = true,
  className = '',
}: PriceChangeProps) {
  const isPositive = value >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        isPositive ? 'text-bull' : 'text-bear'
      } ${className}`}
    >
      {showArrow && <span>{isPositive ? '▲' : '▼'}</span>}
      <span>
        {isPositive ? '+' : ''}{value.toFixed(2)}
        {percent !== undefined && ` (${isPositive ? '+' : ''}${percent.toFixed(2)}%)`}
      </span>
    </span>
  );
}

interface PriceDisplayProps {
  price: number;
  change?: number;
  changePercent?: number;
  symbol?: string;
  className?: string;
}

export function PriceDisplay({
  price,
  change,
  changePercent,
  symbol = '$',
  className = '',
}: PriceDisplayProps) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="text-2xl font-bold text-text">
        {symbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      {change !== undefined && (
        <PriceChange value={change} percent={changePercent} />
      )}
    </div>
  );
}
