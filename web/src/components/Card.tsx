/**
 * Card Components
 * Reusable card UI components
 */

import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`bg-bg-card rounded-xl border border-border shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div>
        <h3 className="font-semibold text-text">{title}</h3>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  prefix?: string;
  suffix?: string;
}

export function StatCard({ label, value, change, prefix = '', suffix = '' }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <Card>
      <CardContent>
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text mt-1">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        {change !== undefined && (
          <p
            className={`text-sm mt-1 ${
              isPositive ? 'text-bull' : 'text-bear'
            }`}
          >
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}
