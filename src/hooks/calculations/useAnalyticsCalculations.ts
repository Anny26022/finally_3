/**
 * Analytics Calculations Hook
 * Centralized hook for all analytics calculations
 */

import { useMemo } from 'react';
import { Trade } from '../../types/trade';
import {
  calcPerformanceMetrics,
  calcSetupPerformance,
  calcMonthlyPerformance,
  calcTopPerformers,
  calculateStandardDeviation,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateSortinoRatio,
  calculateExpectancy,
  calculateProfitFactor,
  calculateStreaks,
  calculateDailyPortfolioValues,
  calculateDailyReturns,
  annualizeMetric,
  safeCalculation
} from '../../lib/calculations';

export interface AnalyticsCalculationResult {
  performanceMetrics: {
    totalTrades: number;
    winRate: number;
    avgGain: number;
    avgLoss: number;
    avgPosMove: number;
    avgNegMove: number;
    avgPositionSize: number;
    avgHoldingDays: number;
    avgR: number;
    planFollowed: number;
    openPositions: number;
    expectancy: number;
    profitFactor: number;
    maxWinStreak: number;
    maxLossStreak: number;
  };
  riskMetrics: {
    maxDrawdown: number;
    volatility: number;
    sharpeRatio: number;
    calmarRatio: number;
    sortinoRatio: number;
    annualizedReturn: number;
    annualizedVolatility: number;
  };
  setupPerformance: Array<{
    setupName: string;
    totalTrades: number;
    winRate: number;
    totalPfImpact: number;
    avgPfImpact: number;
  }>;
  topPerformers: {
    byStockMove: { highest: Trade | null; lowest: Trade | null; hasMultipleTrades: boolean };
    byPfImpact: { highest: Trade | null; lowest: Trade | null; hasMultipleTrades: boolean };
    byRewardRisk: { highest: Trade | null; lowest: Trade | null; hasMultipleTrades: boolean };
    byPlRs: { highest: Trade | null; lowest: Trade | null; hasMultipleTrades: boolean };
  };
}

export function useAnalyticsCalculations(
  trades: Trade[],
  capitalChanges: any[] = [],
  portfolioSize: number = 100000,
  useCashBasis: boolean = false,
  riskFreeRate: number = 0.05
): AnalyticsCalculationResult {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        performanceMetrics: {
          totalTrades: 0,
          winRate: 0,
          avgGain: 0,
          avgLoss: 0,
          avgPosMove: 0,
          avgNegMove: 0,
          avgPositionSize: 0,
          avgHoldingDays: 0,
          avgR: 0,
          planFollowed: 0,
          openPositions: 0,
          expectancy: 0,
          profitFactor: 0,
          maxWinStreak: 0,
          maxLossStreak: 0
        },
        riskMetrics: {
          maxDrawdown: 0,
          volatility: 0,
          sharpeRatio: 0,
          calmarRatio: 0,
          sortinoRatio: 0,
          annualizedReturn: 0,
          annualizedVolatility: 0
        },
        setupPerformance: [],
        topPerformers: {
          byStockMove: { highest: null, lowest: null, hasMultipleTrades: false },
          byPfImpact: { highest: null, lowest: null, hasMultipleTrades: false },
          byRewardRisk: { highest: null, lowest: null, hasMultipleTrades: false },
          byPlRs: { highest: null, lowest: null, hasMultipleTrades: false }
        }
      };
    }

    try {
      // Performance metrics
      const performanceMetrics = safeCalculation(
        () => calcPerformanceMetrics(trades, useCashBasis),
        {
          totalTrades: 0,
          winRate: 0,
          avgGain: 0,
          avgLoss: 0,
          avgPosMove: 0,
          avgNegMove: 0,
          avgPositionSize: 0,
          avgHoldingDays: 0,
          avgR: 0,
          planFollowed: 0,
          openPositions: 0,
          expectancy: 0,
          profitFactor: 0,
          maxWinStreak: 0,
          maxLossStreak: 0
        },
        'Failed to calculate performance metrics'
      );

      // Risk metrics calculation
      const dailyPortfolioValues = safeCalculation(
        () => calculateDailyPortfolioValues(trades, capitalChanges, useCashBasis),
        new Map(),
        'Failed to calculate daily portfolio values'
      );

      const maxDrawdown = safeCalculation(
        () => calculateMaxDrawdown(dailyPortfolioValues),
        0,
        'Failed to calculate max drawdown'
      );

      const dailyReturns = safeCalculation(
        () => calculateDailyReturns(dailyPortfolioValues),
        new Map(),
        'Failed to calculate daily returns'
      );

      const returnsArray = Array.from(dailyReturns.values());
      
      const volatility = safeCalculation(
        () => calculateStandardDeviation(returnsArray),
        0,
        'Failed to calculate volatility'
      );

      const annualizedVolatility = safeCalculation(
        () => annualizeMetric(volatility),
        0,
        'Failed to annualize volatility'
      );

      const avgDailyReturn = returnsArray.length > 0 
        ? returnsArray.reduce((sum, r) => sum + r, 0) / returnsArray.length 
        : 0;
      
      const annualizedReturn = avgDailyReturn * 252 * 100; // Convert to percentage

      const sharpeRatio = safeCalculation(
        () => calculateSharpeRatio(returnsArray, riskFreeRate / 252),
        0,
        'Failed to calculate Sharpe ratio'
      );

      const calmarRatio = safeCalculation(
        () => calculateCalmarRatio(annualizedReturn, maxDrawdown),
        0,
        'Failed to calculate Calmar ratio'
      );

      const sortinoRatio = safeCalculation(
        () => calculateSortinoRatio(returnsArray, 0, riskFreeRate / 252),
        0,
        'Failed to calculate Sortino ratio'
      );

      const riskMetrics = {
        maxDrawdown,
        volatility: volatility * 100, // Convert to percentage
        sharpeRatio,
        calmarRatio,
        sortinoRatio,
        annualizedReturn,
        annualizedVolatility: annualizedVolatility * 100 // Convert to percentage
      };

      // Setup performance
      const setupPerformance = safeCalculation(
        () => calcSetupPerformance(trades, useCashBasis),
        [],
        'Failed to calculate setup performance'
      );

      // Top performers
      const topPerformers = {
        byStockMove: safeCalculation(
          () => calcTopPerformers(trades, 'stockMove', useCashBasis),
          { highest: null, lowest: null, hasMultipleTrades: false },
          'Failed to calculate top performers by stock move'
        ),
        byPfImpact: safeCalculation(
          () => calcTopPerformers(trades, 'pfImpact', useCashBasis),
          { highest: null, lowest: null, hasMultipleTrades: false },
          'Failed to calculate top performers by PF impact'
        ),
        byRewardRisk: safeCalculation(
          () => calcTopPerformers(trades, 'rewardRisk', useCashBasis),
          { highest: null, lowest: null, hasMultipleTrades: false },
          'Failed to calculate top performers by reward-risk'
        ),
        byPlRs: safeCalculation(
          () => calcTopPerformers(trades, 'plRs', useCashBasis),
          { highest: null, lowest: null, hasMultipleTrades: false },
          'Failed to calculate top performers by P&L'
        )
      };

      return {
        performanceMetrics,
        riskMetrics,
        setupPerformance,
        topPerformers
      };
    } catch (error) {
      console.error('Error in useAnalyticsCalculations:', error);
      return {
        performanceMetrics: {
          totalTrades: 0,
          winRate: 0,
          avgGain: 0,
          avgLoss: 0,
          avgPosMove: 0,
          avgNegMove: 0,
          avgPositionSize: 0,
          avgHoldingDays: 0,
          avgR: 0,
          planFollowed: 0,
          openPositions: 0,
          expectancy: 0,
          profitFactor: 0,
          maxWinStreak: 0,
          maxLossStreak: 0
        },
        riskMetrics: {
          maxDrawdown: 0,
          volatility: 0,
          sharpeRatio: 0,
          calmarRatio: 0,
          sortinoRatio: 0,
          annualizedReturn: 0,
          annualizedVolatility: 0
        },
        setupPerformance: [],
        topPerformers: {
          byStockMove: { highest: null, lowest: null, hasMultipleTrades: false },
          byPfImpact: { highest: null, lowest: null, hasMultipleTrades: false },
          byRewardRisk: { highest: null, lowest: null, hasMultipleTrades: false },
          byPlRs: { highest: null, lowest: null, hasMultipleTrades: false }
        }
      };
    }
  }, [trades, capitalChanges, portfolioSize, useCashBasis, riskFreeRate]);
}

/**
 * Hook for monthly performance analysis
 */
export function useMonthlyPerformanceAnalysis(
  trades: Trade[],
  monthlyPortfolios: any[],
  useCashBasis: boolean = false
): Array<{
  month: string;
  year: number;
  trades: number;
  winPercentage: number;
  avgGain: number;
  avgLoss: number;
  avgRR: number;
  avgHoldingDays: number;
  pl: number;
  plPercentage: number;
}> {
  return useMemo(() => {
    return safeCalculation(
      () => calcMonthlyPerformance(trades, monthlyPortfolios, useCashBasis),
      [],
      'Failed to calculate monthly performance'
    );
  }, [trades, monthlyPortfolios, useCashBasis]);
}

/**
 * Hook for advanced risk analytics
 */
export function useAdvancedRiskAnalytics(
  trades: Trade[],
  capitalChanges: any[] = [],
  portfolioSize: number = 100000,
  useCashBasis: boolean = false
): {
  valueAtRisk: number;
  conditionalValueAtRisk: number;
  ulcerIndex: number;
  painIndex: number;
  recoveryFactor: number;
} {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        valueAtRisk: 0,
        conditionalValueAtRisk: 0,
        ulcerIndex: 0,
        painIndex: 0,
        recoveryFactor: 0
      };
    }

    try {
      const dailyPortfolioValues = calculateDailyPortfolioValues(trades, capitalChanges, useCashBasis);
      const dailyReturns = calculateDailyReturns(dailyPortfolioValues);
      const returnsArray = Array.from(dailyReturns.values()).sort((a, b) => a - b);

      // Value at Risk (5th percentile)
      const valueAtRisk = returnsArray.length > 0 
        ? Math.abs(returnsArray[Math.floor(returnsArray.length * 0.05)] * 100)
        : 0;

      // Conditional Value at Risk (average of worst 5%)
      const worstReturns = returnsArray.slice(0, Math.floor(returnsArray.length * 0.05));
      const conditionalValueAtRisk = worstReturns.length > 0
        ? Math.abs(worstReturns.reduce((sum, r) => sum + r, 0) / worstReturns.length * 100)
        : 0;

      // Ulcer Index (square root of mean squared drawdown)
      const portfolioValues = Array.from(dailyPortfolioValues.values());
      let runningMax = portfolioValues[0] || portfolioSize;
      let sumSquaredDrawdowns = 0;
      
      portfolioValues.forEach(value => {
        if (value > runningMax) runningMax = value;
        const drawdown = runningMax > 0 ? (runningMax - value) / runningMax : 0;
        sumSquaredDrawdowns += drawdown * drawdown;
      });
      
      const ulcerIndex = portfolioValues.length > 0 
        ? Math.sqrt(sumSquaredDrawdowns / portfolioValues.length) * 100
        : 0;

      // Pain Index (average drawdown)
      let sumDrawdowns = 0;
      runningMax = portfolioValues[0] || portfolioSize;
      
      portfolioValues.forEach(value => {
        if (value > runningMax) runningMax = value;
        const drawdown = runningMax > 0 ? (runningMax - value) / runningMax : 0;
        sumDrawdowns += drawdown;
      });
      
      const painIndex = portfolioValues.length > 0 
        ? (sumDrawdowns / portfolioValues.length) * 100
        : 0;

      // Recovery Factor (total return / max drawdown)
      const totalReturn = portfolioValues.length > 1
        ? ((portfolioValues[portfolioValues.length - 1] - portfolioValues[0]) / portfolioValues[0]) * 100
        : 0;
      
      const maxDrawdown = calculateMaxDrawdown(dailyPortfolioValues);
      const recoveryFactor = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;

      return {
        valueAtRisk,
        conditionalValueAtRisk,
        ulcerIndex,
        painIndex,
        recoveryFactor
      };
    } catch (error) {
      console.error('Error in useAdvancedRiskAnalytics:', error);
      return {
        valueAtRisk: 0,
        conditionalValueAtRisk: 0,
        ulcerIndex: 0,
        painIndex: 0,
        recoveryFactor: 0
      };
    }
  }, [trades, capitalChanges, portfolioSize, useCashBasis]);
}

/**
 * Hook for trade distribution analysis
 */
export function useTradeDistributionAnalysis(
  trades: Trade[],
  useCashBasis: boolean = false
): {
  plDistribution: Array<{ range: string; count: number; percentage: number }>;
  holdingDaysDistribution: Array<{ range: string; count: number; percentage: number }>;
  setupDistribution: Array<{ setup: string; count: number; percentage: number }>;
  sizeDistribution: Array<{ range: string; count: number; percentage: number }>;
} {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        plDistribution: [],
        holdingDaysDistribution: [],
        setupDistribution: [],
        sizeDistribution: []
      };
    }

    try {
      // P&L Distribution
      const plRanges = [
        { min: -Infinity, max: -10, label: '< -10%' },
        { min: -10, max: -5, label: '-10% to -5%' },
        { min: -5, max: -2, label: '-5% to -2%' },
        { min: -2, max: 0, label: '-2% to 0%' },
        { min: 0, max: 2, label: '0% to 2%' },
        { min: 2, max: 5, label: '2% to 5%' },
        { min: 5, max: 10, label: '5% to 10%' },
        { min: 10, max: Infinity, label: '> 10%' }
      ];

      const plDistribution = plRanges.map(range => {
        const count = trades.filter(trade => {
          const stockMove = trade.stockMove || 0;
          return stockMove > range.min && stockMove <= range.max;
        }).length;
        
        return {
          range: range.label,
          count,
          percentage: trades.length > 0 ? (count / trades.length) * 100 : 0
        };
      });

      // Holding Days Distribution
      const holdingRanges = [
        { min: 0, max: 1, label: '1 day' },
        { min: 1, max: 7, label: '2-7 days' },
        { min: 7, max: 30, label: '1-4 weeks' },
        { min: 30, max: 90, label: '1-3 months' },
        { min: 90, max: Infinity, label: '> 3 months' }
      ];

      const holdingDaysDistribution = holdingRanges.map(range => {
        const count = trades.filter(trade => {
          const holdingDays = trade.holdingDays || 0;
          return holdingDays > range.min && holdingDays <= range.max;
        }).length;
        
        return {
          range: range.label,
          count,
          percentage: trades.length > 0 ? (count / trades.length) * 100 : 0
        };
      });

      // Setup Distribution
      const setupCounts = trades.reduce((acc, trade) => {
        const setup = trade.setup || 'Unknown';
        acc[setup] = (acc[setup] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const setupDistribution = Object.entries(setupCounts).map(([setup, count]) => ({
        setup,
        count,
        percentage: trades.length > 0 ? (count / trades.length) * 100 : 0
      }));

      // Position Size Distribution
      const sizeRanges = [
        { min: 0, max: 2, label: '< 2%' },
        { min: 2, max: 5, label: '2-5%' },
        { min: 5, max: 10, label: '5-10%' },
        { min: 10, max: 15, label: '10-15%' },
        { min: 15, max: Infinity, label: '> 15%' }
      ];

      const sizeDistribution = sizeRanges.map(range => {
        const count = trades.filter(trade => {
          const allocation = trade.allocation || 0;
          return allocation > range.min && allocation <= range.max;
        }).length;
        
        return {
          range: range.label,
          count,
          percentage: trades.length > 0 ? (count / trades.length) * 100 : 0
        };
      });

      return {
        plDistribution,
        holdingDaysDistribution,
        setupDistribution,
        sizeDistribution
      };
    } catch (error) {
      console.error('Error in useTradeDistributionAnalysis:', error);
      return {
        plDistribution: [],
        holdingDaysDistribution: [],
        setupDistribution: [],
        sizeDistribution: []
      };
    }
  }, [trades, useCashBasis]);
}
