/**
 * Centralized Calculations Library
 * Single entry point for all calculation functions
 */

// Core Trade Metrics
export {
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcSLPercent,
  calcOpenQty,
  calcExitedQty,
  calcAvgExitPrice,
  calcStockMove,
  calcRealisedAmount,
  calcPLRs,
  calcPFImpact,
  calcCummPf,
  calcUnrealizedPL,
  calcIndividualMoves,
  calcRealizedPL_FIFO,
  calcRewardRisk,
  calcWeightedRewardRisk,
  isRiskyPosition
} from './core/tradeMetrics';

// Portfolio Metrics
export {
  calcTradeOpenHeat,
  calcOpenHeat,
  calcPortfolioAllocation,
  calcCashPercentage,
  calcTotalInvestedAmount,
  calcPercentInvested,
  calcTotalUnrealizedPL,
  calcTotalRealizedPL,
  calcUnrealizedPFImpact,
  calcRealizedPFImpact,
  calcWinRate,
  calcTotalTrades,
  calcOpenPositionsCount
} from './core/portfolioMetrics';

// Statistical Metrics
export {
  calculateStandardDeviation,
  calculateDownsideDeviation,
  calculateMaxDrawdown,
  calculateDailyReturns,
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateSortinoRatio,
  annualizeMetric,
  calculateRollingStandardDeviation,
  calculateExpectancy,
  calculateProfitFactor,
  calculateStreaks
} from './core/statisticalMetrics';

// Accounting Calculations
export {
  groupTradesByMonth,
  calcAccountingAwarePL,
  getAccountingAwareDate,
  expandTradesForCashBasis,
  deduplicateTradesForCashBasis,
  calcGroupedCashBasisPL,
  getTradesWithAccountingPL,
  calcMonthlyPL,
  filterTradesByDateRange,
  calcAccountingAwarePFImpact,
  getUniqueTradingDates,
  calcCumulativePL
} from './core/accountingCalculations';

// Performance Analytics
export {
  calcPerformanceMetrics,
  calcSetupPerformance,
  calcMonthlyPerformance,
  calcTopPerformers,
  calcXIRR
} from './analytics/performanceAnalytics';

// Chart Data Processors
export {
  processMonthlyChartData,
  calculateDrawdownData,
  calculateVolatilityData,
  calculateDailyPortfolioValues,
  calculateCumulativePerformanceCurve,
  processIndexData,
  calculatePerformanceComparison
} from './analytics/chartDataProcessors';

// Date Utilities
export {

  calculateDaysBetween,
  calculateWeightedHoldingDays,
  calcHoldingDays,
  formatDate,
  getMonthYear,
  isDateInMonth,
  getMonthsBetween,
  normalizeMonthName,
  getFinancialYearDates,
  getCalendarYearDates,
  isDateInRange,
  daysToYears,
  getTradingDaysBetween,
  getLastDayOfMonth,
  getFirstDayOfMonth,
  getUniqueSortedDates
} from './utils/dateUtils';

// Formatters
export {
  formatCurrency,
  formatCurrencyWithPrecision,
  formatPercentage,
  formatPercentageWithSign,
  formatIndianNumber,
  formatLargeNumber,
  formatRiskRewardRatio,
  formatPLWithSign,
  formatStockMove,
  formatAllocation,
  formatHoldingDays,
  formatQuantity,
  formatPrice,
  formatMetricValue,
  formatCompactNumber,
  formatDecimal,
  formatNumberWithSeparator,
  formatReturn,
  formatVolatility,
  formatDrawdown,
  formatSharpeRatio,
  formatWinRate,
  formatExpectancy,
  formatProfitFactor,
  getPLColorClass,
  getPercentageColorClass
} from './utils/formatters';

// Mathematical Utilities
export {
  safeDivide,
  calcSafePercentage,
  calcSafeAverage,
  calcAccountingAwareAverage,
  calcAbsoluteAverage,
  roundToDecimals,
  clamp,
  calcPercentageChange,
  calcPercentageOf,
  calcStockMovePercentage,
  calcAllocationPercentage
} from './utils/mathUtils';

// Type definitions for chart data
export type {
  ChartDataPoint,
  DrawdownDataPoint,
  VolatilityDataPoint
} from './analytics/chartDataProcessors';

// Re-export commonly used types from existing utils
export { calculateTradePL, getTradeDateForAccounting } from '../../utils/accountingUtils';
// calcWeightedRewardRisk is already exported from core/tradeMetrics above

/**
 * Calculation Library Configuration
 */
export const CALCULATION_CONFIG = {
  // Default values
  DEFAULT_PORTFOLIO_SIZE: 100000,
  DEFAULT_RISK_FREE_RATE: 0.05, // 5% annual
  TRADING_DAYS_PER_YEAR: 252,
  
  // Formatting defaults
  DEFAULT_CURRENCY_DECIMALS: 2,
  DEFAULT_PERCENTAGE_DECIMALS: 2,
  DEFAULT_RATIO_DECIMALS: 2,
  
  // Chart defaults
  DEFAULT_VOLATILITY_WINDOW: 3,
  DEFAULT_ROLLING_WINDOW: 12,
  
  // Performance thresholds
  STRONG_GAIN_THRESHOLD: 2,
  SIGNIFICANT_LOSS_THRESHOLD: -2,
  DEEP_DRAWDOWN_THRESHOLD: 10
} as const;

/**
 * Utility function to validate calculation inputs
 */
export function validateCalculationInputs(
  trades: any[],
  portfolioSize?: number
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!Array.isArray(trades)) {
    errors.push('Trades must be an array');
  }
  
  if (trades.length === 0) {
    errors.push('Trades array cannot be empty');
  }
  
  if (portfolioSize !== undefined && (portfolioSize <= 0 || isNaN(portfolioSize))) {
    errors.push('Portfolio size must be a positive number');
  }
  
  // Validate individual trades
  trades.forEach((trade, index) => {
    if (!trade.id) {
      errors.push(`Trade at index ${index} missing required id field`);
    }
    
    if (!trade.date) {
      errors.push(`Trade at index ${index} missing required date field`);
    }
    
    if (trade.entry && (trade.entry <= 0 || isNaN(trade.entry))) {
      errors.push(`Trade at index ${index} has invalid entry price`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Utility function to safely execute calculations with error handling
 */
export function safeCalculation<T>(
  calculationFn: () => T,
  fallbackValue: T,
  errorMessage?: string
): T {
  try {
    return calculationFn();
  } catch (error) {
    if (errorMessage) {
      console.warn(`Calculation error: ${errorMessage}`, error);
    }
    return fallbackValue;
  }
}

/**
 * Batch calculation utility for processing large datasets
 */
export function batchCalculation<T, R>(
  items: T[],
  calculationFn: (item: T) => R,
  batchSize: number = 100
): R[] {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = batch.map(calculationFn);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Memoization utility for expensive calculations
 */
export function memoizeCalculation<T extends any[], R>(
  fn: (...args: T) => R,
  keyGenerator?: (...args: T) => string
): (...args: T) => R {
  const cache = new Map<string, R>();
  
  return (...args: T): R => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Limit cache size to prevent memory leaks
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
}
