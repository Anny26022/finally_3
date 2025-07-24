/**
 * Statistical Metrics Calculation Library
 * Centralized location for all statistical calculations
 */

import { Trade } from '../../../types/trade';
import { calculateTradePL } from '../../../utils/accountingUtils';
import { calcAccountingAwareAverage, calcAbsoluteAverage } from '../utils/mathUtils';

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate downside deviation (volatility of negative returns only)
 */
export function calculateDownsideDeviation(returns: number[], targetReturn: number = 0): number {
  const downsideReturns = returns.filter(r => r < targetReturn);
  if (downsideReturns.length === 0) return 0;
  
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / downsideReturns.length;
  return Math.sqrt(downsideVariance);
}

/**
 * Calculate maximum drawdown from portfolio values
 */
export function calculateMaxDrawdown(portfolioValues: Map<number, number>): number {
  const values = Array.from(portfolioValues.values());
  if (values.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = values[0];
  
  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    
    const drawdown = peak > 0 ? ((peak - value) / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }
  
  return maxDrawdown;
}

/**
 * Calculate daily returns from portfolio values
 */
export function calculateDailyReturns(portfolioValues: Map<number, number>): Map<number, number> {
  const dailyReturns = new Map<number, number>();
  const sortedEntries = Array.from(portfolioValues.entries()).sort((a, b) => a[0] - b[0]);
  
  for (let i = 1; i < sortedEntries.length; i++) {
    const [currentDate, currentValue] = sortedEntries[i];
    const [, previousValue] = sortedEntries[i - 1];
    
    if (previousValue > 0) {
      const dailyReturn = (currentValue - previousValue) / previousValue;
      dailyReturns.set(currentDate, dailyReturn);
    }
  }
  
  return dailyReturns;
}

/**
 * Calculate Sharpe ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0
): number {
  if (returns.length === 0) return 0;
  
  const excessReturns = returns.map(r => r - riskFreeRate);
  const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const stdDev = calculateStandardDeviation(excessReturns);
  
  return stdDev > 0 ? avgExcessReturn / stdDev : 0;
}

/**
 * Calculate Calmar ratio (annual return / max drawdown)
 */
export function calculateCalmarRatio(
  annualizedReturn: number,
  maxDrawdown: number
): number {
  return maxDrawdown > 0 ? annualizedReturn / (maxDrawdown / 100) : 0;
}

/**
 * Calculate Sortino ratio (return / downside deviation)
 */
export function calculateSortinoRatio(
  returns: number[],
  targetReturn: number = 0,
  riskFreeRate: number = 0
): number {
  if (returns.length === 0) return 0;
  
  const excessReturns = returns.map(r => r - riskFreeRate);
  const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const downsideDeviation = calculateDownsideDeviation(returns, targetReturn);
  
  return downsideDeviation > 0 ? avgExcessReturn / downsideDeviation : 0;
}

/**
 * Annualize a metric (typically for volatility)
 */
export function annualizeMetric(dailyMetric: number, periodsPerYear: number = 252): number {
  return dailyMetric * Math.sqrt(periodsPerYear);
}

/**
 * Calculate rolling standard deviation
 */
export function calculateRollingStandardDeviation(
  values: number[],
  windowSize: number
): number[] {
  return values.map((_, i) => {
    if (i < windowSize - 1) return 0;
    
    const slice = values.slice(i - windowSize + 1, i + 1);
    return calculateStandardDeviation(slice);
  });
}

/**
 * Calculate expectancy (average win * win rate - average loss * loss rate)
 */
export function calculateExpectancy(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  if (!trades || trades.length === 0) return 0;

  let tradesWithPL: Array<{ accountingPL: number }>;

  if (useCashBasis) {
    // For cash basis, group by original trade ID
    const realizedTrades = trades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    );

    const tradeGroups = new Map<string, Trade[]>();
    realizedTrades.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (!tradeGroups.has(originalId)) {
        tradeGroups.set(originalId, []);
      }
      tradeGroups.get(originalId)!.push(trade);
    });

    tradesWithPL = Array.from(tradeGroups.entries()).map(([_, trades]) => ({
      accountingPL: trades.reduce((sum, trade) => sum + calculateTradePL(trade, true), 0)
    }));
  } else {
    tradesWithPL = trades
      .filter(trade => trade.positionStatus !== 'Open')
      .map(trade => ({
        accountingPL: calculateTradePL(trade, false)
      }));
  }

  if (tradesWithPL.length === 0) return 0;

  const winningTrades = tradesWithPL.filter(t => t.accountingPL > 0);
  const losingTrades = tradesWithPL.filter(t => t.accountingPL < 0);

  const winRate = winningTrades.length / tradesWithPL.length;
  const lossRate = losingTrades.length / tradesWithPL.length;

  // Use centralized average calculation functions
  const avgWin = calcAccountingAwareAverage(tradesWithPL, true);
  const avgLoss = calcAbsoluteAverage(tradesWithPL);

  return (avgWin * winRate) - (avgLoss * lossRate);
}

/**
 * Calculate profit factor (total profits / total losses)
 */
export function calculateProfitFactor(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  if (!trades || trades.length === 0) return 0;

  let tradesWithPL: Array<{ accountingPL: number }>;

  if (useCashBasis) {
    // For cash basis, group by original trade ID
    const realizedTrades = trades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    );

    const tradeGroups = new Map<string, Trade[]>();
    realizedTrades.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (!tradeGroups.has(originalId)) {
        tradeGroups.set(originalId, []);
      }
      tradeGroups.get(originalId)!.push(trade);
    });

    tradesWithPL = Array.from(tradeGroups.entries()).map(([_, trades]) => ({
      accountingPL: trades.reduce((sum, trade) => sum + calculateTradePL(trade, true), 0)
    }));
  } else {
    tradesWithPL = trades
      .filter(trade => trade.positionStatus !== 'Open')
      .map(trade => ({
        accountingPL: calculateTradePL(trade, false)
      }));
  }

  const totalProfits = tradesWithPL
    .filter(t => t.accountingPL > 0)
    .reduce((sum, t) => sum + t.accountingPL, 0);

  const totalLosses = Math.abs(tradesWithPL
    .filter(t => t.accountingPL < 0)
    .reduce((sum, t) => sum + t.accountingPL, 0));

  return totalLosses > 0 ? totalProfits / totalLosses : (totalProfits > 0 ? Infinity : 0);
}

/**
 * Calculate win/loss streaks
 */
export function calculateStreaks(
  trades: Trade[],
  useCashBasis: boolean = false
): { maxWinStreak: number; maxLossStreak: number } {
  if (!trades || trades.length === 0) return { maxWinStreak: 0, maxLossStreak: 0 };

  let tradesWithPL: Array<{ accountingPL: number; date: string }>;

  if (useCashBasis) {
    // For cash basis, group by original trade ID
    const realizedTrades = trades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    );

    const tradeGroups = new Map<string, Trade[]>();
    realizedTrades.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (!tradeGroups.has(originalId)) {
        tradeGroups.set(originalId, []);
      }
      tradeGroups.get(originalId)!.push(trade);
    });

    tradesWithPL = Array.from(tradeGroups.entries()).map(([_, trades]) => ({
      accountingPL: trades.reduce((sum, trade) => sum + calculateTradePL(trade, true), 0),
      date: trades[0].date
    }));
  } else {
    tradesWithPL = trades
      .filter(trade => trade.positionStatus !== 'Open')
      .map(trade => ({
        accountingPL: calculateTradePL(trade, false),
        date: trade.date
      }));
  }

  // Sort by date
  tradesWithPL.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  for (const trade of tradesWithPL) {
    if (trade.accountingPL > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else if (trade.accountingPL < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  }

  return { maxWinStreak, maxLossStreak };
}
