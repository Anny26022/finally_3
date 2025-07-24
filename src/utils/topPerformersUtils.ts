import { Trade } from '../types/trade';
import { calcWeightedRewardRisk } from '../lib/calculations';

export type MetricType = 'stockMove' | 'pfImpact' | 'rewardRisk' | 'plRs';

export interface TopPerformerMetric {
  type: MetricType;
  label: string;
  isPercentage: boolean;
  getValue: (trade: Trade) => number;
  formatValue: (value: number) => string;
}

export interface TopPerformerResult {
  highest: Trade | null;
  lowest: Trade | null;
  hasMultipleTrades: boolean;
}

/**
 * Configuration for different metrics that can be displayed in top performers
 */
export const METRIC_CONFIGS: Record<MetricType, TopPerformerMetric> = {
  stockMove: {
    type: 'stockMove',
    label: 'Stock Move',
    isPercentage: true,
    getValue: (trade) => trade.stockMove || 0,
    formatValue: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  },
  pfImpact: {
    type: 'pfImpact',
    label: 'Portfolio Impact',
    isPercentage: true,
    getValue: (trade) => {
      // This will be overridden in the hook with calculated value
      return trade.pfImpact || 0;
    },
    formatValue: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  },
  rewardRisk: {
    type: 'rewardRisk',
    label: 'Risk:Reward',
    isPercentage: false,
    getValue: (trade) => calcWeightedRewardRisk(trade),
    formatValue: (value) => {
      // Handle negative values properly - show negative risk for losses
      if (value < 0) {
        return `-1:${Math.abs(value).toFixed(2)}`;
      }
      return `1:${value.toFixed(2)}`;
    }
  },
  plRs: {
    type: 'plRs',
    label: 'P/L (₹)',
    isPercentage: false,
    getValue: (trade) => trade.plRs || 0,
    formatValue: (value) => {
      if (value >= 0) {
        return `₹+${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      } else {
        return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      }
    }
  }
};

/**
 * Calculate portfolio impact for a trade based on accounting method
 */
export function calculatePfImpact(
  trade: Trade,
  useCashBasis: boolean,
  isAllTime: boolean
): number {
  // Cast trade to any to access private properties
  const tradeAny = trade as any;

  if (useCashBasis) {
    // For cash basis, use _cashPfImpact first, then fallback to pfImpact
    return tradeAny._cashPfImpact ?? trade.pfImpact ?? 0;
  } else {
    // For accrual basis, use _accrualPfImpact first, then fallback to pfImpact
    return tradeAny._accrualPfImpact ?? trade.pfImpact ?? 0;
  }
}

/**
 * Deduplicate trades for cash basis to avoid showing same trade multiple times
 */
export function deduplicateTradesForCashBasis(trades: Trade[], useCashBasis: boolean): Trade[] {
  if (!useCashBasis) return trades;

  const seenTradeIds = new Set<string>();
  return trades.filter(trade => {
    const originalId = trade.id.split('_exit_')[0];
    if (seenTradeIds.has(originalId)) return false;
    seenTradeIds.add(originalId);
    return true;
  });
}

/**
 * Sort trades by a specific metric and return top and bottom performers
 */
export function getTopPerformers(
  trades: Trade[], 
  metricType: MetricType,
  useCashBasis: boolean,
  isAllTime: boolean
): TopPerformerResult {
  if (!trades || trades.length === 0) {
    return { highest: null, lowest: null, hasMultipleTrades: false };
  }

  const metric = METRIC_CONFIGS[metricType];
  
  // Create trades with calculated values for sorting
  const tradesWithValues = trades.map(trade => ({
    trade,
    value: metricType === 'pfImpact' 
      ? calculatePfImpact(trade, useCashBasis, isAllTime)
      : metric.getValue(trade)
  }));

  // Sort by value (highest to lowest)
  tradesWithValues.sort((a, b) => b.value - a.value);

  const highest = tradesWithValues[0]?.trade || null;
  const lowest = tradesWithValues[tradesWithValues.length - 1]?.trade || null;

  return {
    highest,
    lowest,
    hasMultipleTrades: trades.length > 1
  };
}

/**
 * Format a metric value for display
 */
export function formatMetricValue(
  value: number, 
  metricType: MetricType, 
  trade?: Trade
): string {
  const metric = METRIC_CONFIGS[metricType];
  return metric.formatValue(value);
}

/**
 * Determine if a value should be displayed as positive (green)
 */
export function isPositiveValue(value: number, metricType: MetricType): boolean {
  switch (metricType) {
    case 'rewardRisk':
      return value > 1; // R:R > 1:1 is good
    default:
      return value > 0;
  }
}

/**
 * Determine if a value should be displayed as negative (red)
 */
export function isNegativeValue(value: number, metricType: MetricType): boolean {
  switch (metricType) {
    case 'rewardRisk':
      return value < 1; // R:R < 1:1 is bad
    default:
      return value < 0;
  }
}
