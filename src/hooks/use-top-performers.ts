import { useMemo } from 'react';
import { Trade } from '../types/trade';
import { useAccountingCalculations } from './use-accounting-calculations';
import { useAccountingMethod } from '../context/AccountingMethodContext';
import { useGlobalFilter } from '../context/GlobalFilterContext';
import { isTradeInGlobalFilter } from '../utils/dateFilterUtils';
import {
  MetricType,
  TopPerformerResult,
  METRIC_CONFIGS,
  getTopPerformers,
  deduplicateTradesForCashBasis,
  calculatePfImpact
} from '../utils/topPerformersUtils';

export interface UseTopPerformersResult {
  topPerformers: TopPerformerResult;
  availableMetrics: MetricType[];
  getMetricLabel: (metricType: MetricType) => string;
  getMetricValue: (trade: Trade, metricType: MetricType) => number;
  getFormattedValue: (trade: Trade, metricType: MetricType) => string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing top performers logic
 */
export function useTopPerformers(
  trades: Trade[],
  selectedMetric: MetricType = 'stockMove'
): UseTopPerformersResult {
  const { accountingMethod } = useAccountingMethod();
  const { filter: globalFilter } = useGlobalFilter();
  const useCashBasis = accountingMethod === 'cash';
  const isAllTime = globalFilter.type === 'all';

  // Filter trades based on global filter and accounting method
  const filteredTrades = useMemo(() => {
    if (!trades?.length) return [];
    
    if (isAllTime) {
      return trades; // No filtering for "All Time"
    }

    return trades.filter(trade => 
      isTradeInGlobalFilter(trade, globalFilter, useCashBasis)
    );
  }, [trades, globalFilter, useCashBasis, isAllTime]);

  // Get trades with accounting calculations
  const { tradesWithAccountingPL } = useAccountingCalculations(filteredTrades);

  // Process trades with portfolio impact calculations
  const processedTrades = useMemo(() => {
    if (!tradesWithAccountingPL?.length) return [];

    // Add calculated portfolio impact to each trade
    const tradesWithPfImpact = tradesWithAccountingPL.map(trade => {
      const calculatedPfImpact = calculatePfImpact(trade, useCashBasis, isAllTime);

      return {
        ...trade,
        _calculatedPfImpact: calculatedPfImpact
      };
    });

    // Deduplicate for cash basis
    return deduplicateTradesForCashBasis(tradesWithPfImpact, useCashBasis);
  }, [tradesWithAccountingPL, useCashBasis, isAllTime]);

  // Calculate top performers for the selected metric
  const topPerformers = useMemo(() => {
    return getTopPerformers(processedTrades, selectedMetric, useCashBasis, isAllTime);
  }, [processedTrades, selectedMetric, useCashBasis, isAllTime]);

  // Available metrics (all metrics are always available)
  const availableMetrics: MetricType[] = ['stockMove', 'pfImpact', 'rewardRisk', 'plRs'];

  // Helper functions
  const getMetricLabel = (metricType: MetricType): string => {
    const config = METRIC_CONFIGS[metricType];
    if (!config) {
      console.warn(`No config found for metric type: ${metricType}`);
      return 'Unknown';
    }
    return config.label || 'Unknown';
  };

  const getMetricValue = (trade: Trade, metricType: MetricType): number => {
    try {
      if (metricType === 'pfImpact') {
        // Use the calculated value from processedTrades
        const calculatedValue = (trade as any)._calculatedPfImpact;
        if (calculatedValue !== undefined) {
          return calculatedValue;
        }
        // Fallback to direct calculation
        return calculatePfImpact(trade, useCashBasis, isAllTime);
      }

      if (metricType === 'plRs') {
        return (trade as any).accountingPL ?? trade.plRs ?? 0;
      }

      const config = METRIC_CONFIGS[metricType];
      if (!config || !config.getValue) {
        return 0;
      }
      return config.getValue(trade);
    } catch (error) {
      console.warn('Error getting metric value:', error);
      return 0;
    }
  };

  const getFormattedValue = (trade: Trade, metricType: MetricType): string => {
    try {
      const value = getMetricValue(trade, metricType);
      const config = METRIC_CONFIGS[metricType];
      if (!config || !config.formatValue) {
        return value.toString();
      }
      return config.formatValue(value);
    } catch (error) {
      console.warn('Error formatting value:', error);
      return '0';
    }
  };

  return {
    topPerformers,
    availableMetrics,
    getMetricLabel,
    getMetricValue,
    getFormattedValue,
    isLoading: false, // Could be extended for async operations
    error: null // Could be extended for error handling
  };
}
