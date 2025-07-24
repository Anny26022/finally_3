/**
 * Performance Metrics Hook
 * Centralized hook for performance metrics calculations
 */

import { useMemo } from 'react';
import { Trade } from '../../types/trade';
import {
  processMonthlyChartData,
  calculateDrawdownData,
  calculateVolatilityData,
  calculateCumulativePerformanceCurve,
  processIndexData,
  calculatePerformanceComparison,
  safeCalculation
} from '../../lib/calculations';

export interface PerformanceMetricsResult {
  monthlyChartData: Array<{
    month: string;
    capital: number;
    pl: number;
    plPercentage: number;
    cummPf: number;
    startingCapital?: number;
    capitalChanges?: number;
    indexValue?: number;
    indexPercentage?: number;
  }>;
  drawdownData: Array<{
    month: string;
    capital: number;
    pl: number;
    plPercentage: number;
    cummPf: number;
    drawdown: number;
  }>;
  volatilityData: Array<{
    month: string;
    capital: number;
    pl: number;
    plPercentage: number;
    cummPf: number;
    volatility: number;
  }>;
  cumulativePerformance: Array<{
    date: string;
    symbol: string;
    stockPFImpact: number;
    cummPFImpact: number;
    drawdownFromPeak: number;
    isNewPeak: boolean;
    commentary: string;
    commentaryType: string;
  }>;
  performanceComparison?: Array<{
    month: string;
    portfolioReturn: number;
    indexReturn: number;
    outperformance: number;
  }>;
}

export function usePerformanceMetrics(
  trades: Trade[],
  monthlyPortfolios: any[],
  indexTicks?: any[],
  baselinePrice?: number,
  startDate?: Date,
  endDate?: Date,
  useCashBasis: boolean = false,
  volatilityWindow: number = 3
): PerformanceMetricsResult {
  return useMemo(() => {
    if (!monthlyPortfolios || monthlyPortfolios.length === 0) {
      return {
        monthlyChartData: [],
        drawdownData: [],
        volatilityData: [],
        cumulativePerformance: [],
        performanceComparison: []
      };
    }

    try {
      // Process index data if available
      let indexData: Map<string, any> | undefined;
      if (indexTicks && baselinePrice && startDate && endDate) {
        indexData = safeCalculation(
          () => processIndexData(indexTicks, baselinePrice, startDate, endDate),
          new Map(),
          'Failed to process index data'
        );
      }

      // Process monthly chart data
      const monthlyChartData = safeCalculation(
        () => processMonthlyChartData(monthlyPortfolios, indexData),
        [],
        'Failed to process monthly chart data'
      );

      // Calculate drawdown data
      const drawdownData = safeCalculation(
        () => calculateDrawdownData(monthlyChartData),
        [],
        'Failed to calculate drawdown data'
      );

      // Calculate volatility data
      const volatilityData = safeCalculation(
        () => calculateVolatilityData(monthlyChartData, volatilityWindow),
        [],
        'Failed to calculate volatility data'
      );

      // Calculate cumulative performance curve
      const cumulativePerformance = safeCalculation(
        () => calculateCumulativePerformanceCurve(trades, useCashBasis),
        [],
        'Failed to calculate cumulative performance curve'
      );

      // Calculate performance comparison if index data is available
      let performanceComparison: Array<{
        month: string;
        portfolioReturn: number;
        indexReturn: number;
        outperformance: number;
      }> | undefined;

      if (indexData) {
        performanceComparison = safeCalculation(
          () => calculatePerformanceComparison(monthlyChartData, indexData!),
          [],
          'Failed to calculate performance comparison'
        );
      }

      return {
        monthlyChartData,
        drawdownData,
        volatilityData,
        cumulativePerformance,
        performanceComparison
      };
    } catch (error) {
      console.error('Error in usePerformanceMetrics:', error);
      return {
        monthlyChartData: [],
        drawdownData: [],
        volatilityData: [],
        cumulativePerformance: [],
        performanceComparison: []
      };
    }
  }, [trades, monthlyPortfolios, indexTicks, baselinePrice, startDate, endDate, useCashBasis, volatilityWindow]);
}

/**
 * Hook for performance summary statistics
 */
export function usePerformanceSummary(
  monthlyChartData: Array<{
    month: string;
    capital: number;
    pl: number;
    plPercentage: number;
    cummPf: number;
  }>
): {
  totalReturn: number;
  annualizedReturn: number;
  bestMonth: { month: string; return: number } | null;
  worstMonth: { month: string; return: number } | null;
  positiveMonths: number;
  negativeMonths: number;
  winRate: number;
  averageMonthlyReturn: number;
  volatility: number;
  maxDrawdown: number;
  currentDrawdown: number;
} {
  return useMemo(() => {
    if (!monthlyChartData || monthlyChartData.length === 0) {
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        bestMonth: null,
        worstMonth: null,
        positiveMonths: 0,
        negativeMonths: 0,
        winRate: 0,
        averageMonthlyReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      };
    }

    try {
      const returns = monthlyChartData.map(d => d.plPercentage);
      
      // Total and annualized return
      const totalReturn = monthlyChartData[monthlyChartData.length - 1]?.cummPf || 0;
      const monthsCount = monthlyChartData.length;
      const annualizedReturn = monthsCount > 0 
        ? Math.pow(1 + totalReturn / 100, 12 / monthsCount) - 1
        : 0;

      // Best and worst months
      const sortedReturns = [...returns].sort((a, b) => b - a);
      const bestMonthReturn = sortedReturns[0] || 0;
      const worstMonthReturn = sortedReturns[sortedReturns.length - 1] || 0;

      const bestMonth = monthlyChartData.find(d => d.plPercentage === bestMonthReturn);
      const worstMonth = monthlyChartData.find(d => d.plPercentage === worstMonthReturn);

      // Win/loss statistics
      const positiveMonths = returns.filter(r => r > 0).length;
      const negativeMonths = returns.filter(r => r < 0).length;
      const winRate = monthsCount > 0 ? (positiveMonths / monthsCount) * 100 : 0;

      // Average monthly return
      const averageMonthlyReturn = returns.length > 0 
        ? returns.reduce((sum, r) => sum + r, 0) / returns.length 
        : 0;

      // Volatility (standard deviation of monthly returns)
      const mean = averageMonthlyReturn;
      const variance = returns.length > 0
        ? returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
        : 0;
      const volatility = Math.sqrt(variance);

      // Drawdown calculations
      let maxDrawdown = 0;
      let peak = monthlyChartData[0]?.capital || 0;
      let currentDrawdown = 0;

      monthlyChartData.forEach(data => {
        if (data.capital > peak) {
          peak = data.capital;
        }
        
        const drawdown = peak > 0 ? ((peak - data.capital) / peak) * 100 : 0;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      });

      // Current drawdown (from latest peak)
      const latestCapital = monthlyChartData[monthlyChartData.length - 1]?.capital || 0;
      currentDrawdown = peak > 0 ? ((peak - latestCapital) / peak) * 100 : 0;

      return {
        totalReturn,
        annualizedReturn: annualizedReturn * 100, // Convert to percentage
        bestMonth: bestMonth ? { month: bestMonth.month, return: bestMonth.plPercentage } : null,
        worstMonth: worstMonth ? { month: worstMonth.month, return: worstMonth.plPercentage } : null,
        positiveMonths,
        negativeMonths,
        winRate,
        averageMonthlyReturn,
        volatility,
        maxDrawdown,
        currentDrawdown
      };
    } catch (error) {
      console.error('Error in usePerformanceSummary:', error);
      return {
        totalReturn: 0,
        annualizedReturn: 0,
        bestMonth: null,
        worstMonth: null,
        positiveMonths: 0,
        negativeMonths: 0,
        winRate: 0,
        averageMonthlyReturn: 0,
        volatility: 0,
        maxDrawdown: 0,
        currentDrawdown: 0
      };
    }
  }, [monthlyChartData]);
}

/**
 * Hook for performance benchmarking
 */
export function usePerformanceBenchmarking(
  portfolioData: Array<{
    month: string;
    plPercentage: number;
    cummPf: number;
  }>,
  indexData?: Map<string, { percentage: number }>
): {
  outperformanceMonths: number;
  underperformanceMonths: number;
  averageOutperformance: number;
  trackingError: number;
  informationRatio: number;
  beta: number;
  alpha: number;
} {
  return useMemo(() => {
    if (!portfolioData || portfolioData.length === 0 || !indexData) {
      return {
        outperformanceMonths: 0,
        underperformanceMonths: 0,
        averageOutperformance: 0,
        trackingError: 0,
        informationRatio: 0,
        beta: 0,
        alpha: 0
      };
    }

    try {
      const comparisons = portfolioData
        .map(data => {
          const indexPoint = indexData.get(data.month);
          if (!indexPoint) return null;
          
          return {
            portfolioReturn: data.plPercentage,
            indexReturn: indexPoint.percentage,
            outperformance: data.plPercentage - indexPoint.percentage
          };
        })
        .filter(Boolean) as Array<{
          portfolioReturn: number;
          indexReturn: number;
          outperformance: number;
        }>;

      if (comparisons.length === 0) {
        return {
          outperformanceMonths: 0,
          underperformanceMonths: 0,
          averageOutperformance: 0,
          trackingError: 0,
          informationRatio: 0,
          beta: 0,
          alpha: 0
        };
      }

      // Outperformance statistics
      const outperformanceMonths = comparisons.filter(c => c.outperformance > 0).length;
      const underperformanceMonths = comparisons.filter(c => c.outperformance < 0).length;
      const averageOutperformance = comparisons.reduce((sum, c) => sum + c.outperformance, 0) / comparisons.length;

      // Tracking error (standard deviation of outperformance)
      const outperformanceVariance = comparisons.reduce((sum, c) => 
        sum + Math.pow(c.outperformance - averageOutperformance, 2), 0
      ) / comparisons.length;
      const trackingError = Math.sqrt(outperformanceVariance);

      // Information ratio
      const informationRatio = trackingError > 0 ? averageOutperformance / trackingError : 0;

      // Beta calculation (covariance / variance of index)
      const portfolioReturns = comparisons.map(c => c.portfolioReturn);
      const indexReturns = comparisons.map(c => c.indexReturn);
      
      const avgPortfolioReturn = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
      const avgIndexReturn = indexReturns.reduce((sum, r) => sum + r, 0) / indexReturns.length;

      let covariance = 0;
      let indexVariance = 0;

      comparisons.forEach(c => {
        covariance += (c.portfolioReturn - avgPortfolioReturn) * (c.indexReturn - avgIndexReturn);
        indexVariance += Math.pow(c.indexReturn - avgIndexReturn, 2);
      });

      covariance /= comparisons.length;
      indexVariance /= comparisons.length;

      const beta = indexVariance > 0 ? covariance / indexVariance : 0;

      // Alpha (portfolio return - risk-free rate - beta * (index return - risk-free rate))
      // Simplified: alpha = average portfolio return - beta * average index return
      const alpha = avgPortfolioReturn - beta * avgIndexReturn;

      return {
        outperformanceMonths,
        underperformanceMonths,
        averageOutperformance,
        trackingError,
        informationRatio,
        beta,
        alpha
      };
    } catch (error) {
      console.error('Error in usePerformanceBenchmarking:', error);
      return {
        outperformanceMonths: 0,
        underperformanceMonths: 0,
        averageOutperformance: 0,
        trackingError: 0,
        informationRatio: 0,
        beta: 0,
        alpha: 0
      };
    }
  }, [portfolioData, indexData]);
}
