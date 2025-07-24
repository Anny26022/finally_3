/**
 * Chart Data Processing Library
 * Centralized location for all chart data calculations
 */

import { Trade } from '../../../types/trade';
import { calculateTradePL, getTradeDateForAccounting } from '../../../utils/accountingUtils';
import { calculateDailyReturns, calculateStandardDeviation } from '../core/statisticalMetrics';

export interface ChartDataPoint {
  month: string;
  capital: number;
  pl: number;
  plPercentage: number;
  cummPf: number;
  startingCapital?: number;
  capitalChanges?: number;
  indexValue?: number;
  indexPercentage?: number;
}

export interface DrawdownDataPoint extends ChartDataPoint {
  drawdown: number;
}

export interface VolatilityDataPoint extends ChartDataPoint {
  volatility: number;
}

/**
 * Process monthly portfolio data for charts
 */
export function processMonthlyChartData(
  monthlyPortfolios: any[],
  indexData?: Map<string, any>
): ChartDataPoint[] {
  if (!monthlyPortfolios || monthlyPortfolios.length === 0) return [];

  let cummPf = 0; // Start at 0% cumulative profit factor

  return monthlyPortfolios.map(monthData => {
    const monthStr = `${monthData.month} ${monthData.year}`;
    const indexDataPoint = indexData?.get(monthStr);

    // Calculate monthly return percentage
    const monthlyReturn = monthData.startingCapital !== 0 
      ? (monthData.pl / monthData.startingCapital) * 100 
      : 0;

    // Add this month's return to cumulative PF
    cummPf += monthlyReturn;

    return {
      month: monthStr,
      capital: monthData.finalCapital,
      pl: monthData.pl,
      startingCapital: monthData.startingCapital,
      capitalChanges: monthData.capitalChanges,
      plPercentage: monthlyReturn,
      cummPf: cummPf,
      indexValue: indexDataPoint?.close || null,
      indexPercentage: indexDataPoint?.percentage ?? null
    };
  });
}

/**
 * Calculate drawdown data for charts
 */
export function calculateDrawdownData(chartData: ChartDataPoint[]): DrawdownDataPoint[] {
  if (!chartData || chartData.length === 0) return [];

  let runningMax = chartData[0]?.startingCapital || 0;
  
  return chartData.map((d) => {
    if (d.capital > runningMax) runningMax = d.capital;
    const drawdown = runningMax !== 0 ? ((runningMax - d.capital) / runningMax) * 100 : 0;
    
    return { ...d, drawdown };
  });
}

/**
 * Calculate volatility data for charts (rolling standard deviation)
 */
export function calculateVolatilityData(
  chartData: ChartDataPoint[],
  windowSize: number = 3
): VolatilityDataPoint[] {
  if (!chartData || chartData.length === 0) return [];

  function rollingStd(arr: number[], window: number) {
    return arr.map((_, i) => {
      if (i < window - 1) return 0;
      const slice = arr.slice(i - window + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / window;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
      return Math.sqrt(variance);
    });
  }

  const plPercentages = chartData.map(d => d.plPercentage);
  const volatilityArr = rollingStd(plPercentages, windowSize);
  
  return chartData.map((d, i) => ({ ...d, volatility: volatilityArr[i] }));
}

/**
 * Process daily portfolio values for performance calculations
 */
export function calculateDailyPortfolioValues(
  trades: Trade[],
  capitalChanges: any[],
  useCashBasis: boolean = false
): Map<number, number> {
  const dailyValues = new Map<number, number>();
  
  // Get all unique dates from trades and capital changes
  const allDates = new Set<string>();
  
  trades.forEach(trade => {
    const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
    allDates.add(relevantDate);
  });
  
  capitalChanges.forEach(change => {
    allDates.add(change.date);
  });
  
  const sortedDates = Array.from(allDates)
    .map(dateStr => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());

  if (sortedDates.length === 0) {
    dailyValues.set(new Date().setHours(0, 0, 0, 0), 1000);
    return dailyValues;
  }

  let currentCashComponent = 0;

  for (const date of sortedDates) {
    const timestamp = date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0];

    // Add capital changes for this date
    const capitalChangesForDate = capitalChanges.filter(cc => {
      const ccDate = new Date(cc.date);
      return ccDate.toISOString().split('T')[0] === dateStr;
    });

    capitalChangesForDate.forEach(cc => {
      currentCashComponent += cc.amount;
    });

    // Add P/L from trades for this date
    const tradesOnDate = trades.filter(trade => {
      const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
      const tradeDate = new Date(relevantDate);
      return tradeDate.toISOString().split('T')[0] === dateStr;
    });

    // For cash basis, deduplicate trades to avoid double counting
    let uniqueTradesForDate = tradesOnDate;
    if (useCashBasis) {
      const seenTradeIds = new Set();
      uniqueTradesForDate = tradesOnDate.filter(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) return false;
        seenTradeIds.add(originalId);
        return true;
      });
    }

    uniqueTradesForDate.forEach(trade => {
      const accountingPL = calculateTradePL(trade, useCashBasis);
      currentCashComponent += accountingPL;
    });

    dailyValues.set(timestamp, currentCashComponent);
  }

  return dailyValues;
}

/**
 * Calculate cumulative performance curve data
 */
export function calculateCumulativePerformanceCurve(
  trades: Trade[],
  useCashBasis: boolean = false
): Array<{
  date: string;
  symbol: string;
  stockPFImpact: number;
  cummPFImpact: number;
  drawdownFromPeak: number;
  isNewPeak: boolean;
  commentary: string;
  commentaryType: string;
}> {
  if (!trades || trades.length === 0) return [];

  // Sort trades by accounting-aware date
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(getTradeDateForAccounting(a, useCashBasis));
    const dateB = new Date(getTradeDateForAccounting(b, useCashBasis));
    return dateA.getTime() - dateB.getTime();
  });

  let cummPF = 0;
  let peakPF = 0;
  let wasInDrawdown = false;

  return sortedTrades.map((trade, index) => {
    // Calculate stock PF impact
    const stockPFImpact = useCashBasis
      ? (trade._cashPfImpact ?? 0)
      : (trade._accrualPfImpact ?? trade.pfImpact ?? 0);

    // Update cumulative PF
    const previousPF = cummPF;
    cummPF += stockPFImpact;

    // Update peak
    const isNewPeak = cummPF > peakPF;
    if (isNewPeak) {
      peakPF = cummPF;
    }

    // Calculate drawdown
    const drawdownFromPeak = peakPF > 0 ? ((peakPF - cummPF) / peakPF) * 100 : 0;
    const isInDrawdown = drawdownFromPeak > 0;

    // Generate commentary
    let commentary = "";
    let commentaryType = "neutral";

    if (isNewPeak && !wasInDrawdown) {
      commentary = "New peak";
      commentaryType = "positive";
    } else if (isNewPeak && wasInDrawdown) {
      commentary = "Recovery to new peak";
      commentaryType = "recovery";
    } else if (stockPFImpact > 2) {
      commentary = "Strong gain";
      commentaryType = "positive";
    } else if (stockPFImpact < -2) {
      commentary = "Significant loss";
      commentaryType = "negative";
    } else if (drawdownFromPeak > 10) {
      commentary = "Deep drawdown";
      commentaryType = "severe";
    }

    // Update state for next iteration
    if (isInDrawdown) {
      wasInDrawdown = true;
    }

    const displayDate = useCashBasis
      ? (trade.exit1Date || trade.exit2Date || trade.exit3Date || trade.date)
      : trade.date;

    return {
      date: displayDate,
      symbol: trade.name || 'Unknown',
      stockPFImpact,
      cummPFImpact: cummPF,
      drawdownFromPeak,
      isNewPeak,
      commentary,
      commentaryType
    };
  });
}

/**
 * Process index data for comparison charts
 */
export function processIndexData(
  indexTicks: any[],
  baselinePrice: number,
  startDate: Date,
  endDate: Date
): Map<string, { close: number; percentage: number }> {
  const indexData = new Map<string, { close: number; percentage: number }>();

  if (!indexTicks || indexTicks.length === 0) return indexData;

  const processedData = indexTicks
    .filter(tick => {
      const tickDate = new Date(tick[0]);
      return tickDate >= startDate && tickDate <= endDate;
    })
    .map(tick => {
      const dateTime = tick[0];
      const close = tick[4]; // Close price
      const date = new Date(dateTime).toISOString().split('T')[0];
      const percentage = ((close - baselinePrice) / baselinePrice) * 100;

      return { date, close, percentage };
    });

  // Group by month for monthly comparison
  processedData.forEach(data => {
    const date = new Date(data.date);
    const monthKey = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    
    // Use the last data point of each month
    indexData.set(monthKey, {
      close: data.close,
      percentage: data.percentage
    });
  });

  return indexData;
}

/**
 * Calculate performance comparison data
 */
export function calculatePerformanceComparison(
  portfolioData: ChartDataPoint[],
  indexData: Map<string, any>
): Array<{
  month: string;
  portfolioReturn: number;
  indexReturn: number;
  outperformance: number;
}> {
  return portfolioData.map(data => {
    const indexPoint = indexData.get(data.month);
    const indexReturn = indexPoint?.percentage || 0;
    const outperformance = data.plPercentage - indexReturn;

    return {
      month: data.month,
      portfolioReturn: data.plPercentage,
      indexReturn,
      outperformance
    };
  });
}
