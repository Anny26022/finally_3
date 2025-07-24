/**
 * Portfolio Calculations Hook
 * Centralized hook for all portfolio-level calculations
 */

import { useMemo } from 'react';
import { Trade } from '../../types/trade';
import {
  calcOpenHeat,
  calcTradeOpenHeat,
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
  calcOpenPositionsCount,
  safeCalculation
} from '../../lib/calculations';

export interface PortfolioCalculationResult {
  totalOpenHeat: number;
  totalInvestedAmount: number;
  percentInvested: number;
  cashPercentage: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
  unrealizedPFImpact: number;
  realizedPFImpact: number;
  winRate: number;
  totalTrades: number;
  openPositionsCount: number;
  totalPortfolioValue: number;
  netPL: number;
  netPFImpact: number;
}

export function usePortfolioCalculations(
  trades: Trade[],
  portfolioSize: number = 100000,
  useCashBasis: boolean = false,
  getPortfolioSize?: (month: string, year: number) => number
): PortfolioCalculationResult {
  return useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        totalOpenHeat: 0,
        totalInvestedAmount: 0,
        percentInvested: 0,
        cashPercentage: 100,
        totalUnrealizedPL: 0,
        totalRealizedPL: 0,
        unrealizedPFImpact: 0,
        realizedPFImpact: 0,
        winRate: 0,
        totalTrades: 0,
        openPositionsCount: 0,
        totalPortfolioValue: portfolioSize,
        netPL: 0,
        netPFImpact: 0
      };
    }

    try {
      // Open heat calculation
      const totalOpenHeat = safeCalculation(
        () => calcOpenHeat(trades, portfolioSize, getPortfolioSize),
        0,
        'Failed to calculate total open heat'
      );

      // Investment calculations
      const totalInvestedAmount = safeCalculation(
        () => calcTotalInvestedAmount(trades),
        0,
        'Failed to calculate total invested amount'
      );

      const percentInvested = safeCalculation(
        () => calcPercentInvested(trades, portfolioSize),
        0,
        'Failed to calculate percent invested'
      );

      const openTrades = trades.filter(t => 
        t.positionStatus === 'Open' || t.positionStatus === 'Partial'
      );

      const cashPercentage = safeCalculation(
        () => calcCashPercentage(openTrades, portfolioSize, getPortfolioSize),
        100,
        'Failed to calculate cash percentage'
      );

      // P&L calculations
      const totalUnrealizedPL = safeCalculation(
        () => calcTotalUnrealizedPL(trades, useCashBasis),
        0,
        'Failed to calculate total unrealized P&L'
      );

      const totalRealizedPL = safeCalculation(
        () => calcTotalRealizedPL(trades, useCashBasis),
        0,
        'Failed to calculate total realized P&L'
      );

      const unrealizedPFImpact = safeCalculation(
        () => calcUnrealizedPFImpact(trades, portfolioSize, useCashBasis),
        0,
        'Failed to calculate unrealized PF impact'
      );

      const realizedPFImpact = safeCalculation(
        () => calcRealizedPFImpact(trades, portfolioSize, useCashBasis),
        0,
        'Failed to calculate realized PF impact'
      );

      // Statistics
      const winRate = safeCalculation(
        () => calcWinRate(trades, useCashBasis),
        0,
        'Failed to calculate win rate'
      );

      const totalTrades = safeCalculation(
        () => calcTotalTrades(trades, useCashBasis),
        0,
        'Failed to calculate total trades'
      );

      const openPositionsCount = safeCalculation(
        () => calcOpenPositionsCount(trades),
        0,
        'Failed to calculate open positions count'
      );

      // Derived calculations
      const netPL = totalRealizedPL + totalUnrealizedPL;
      const netPFImpact = realizedPFImpact + unrealizedPFImpact;
      const totalPortfolioValue = portfolioSize + netPL;

      return {
        totalOpenHeat,
        totalInvestedAmount,
        percentInvested,
        cashPercentage,
        totalUnrealizedPL,
        totalRealizedPL,
        unrealizedPFImpact,
        realizedPFImpact,
        winRate,
        totalTrades,
        openPositionsCount,
        totalPortfolioValue,
        netPL,
        netPFImpact
      };
    } catch (error) {
      console.error('Error in usePortfolioCalculations:', error);
      return {
        totalOpenHeat: 0,
        totalInvestedAmount: 0,
        percentInvested: 0,
        cashPercentage: 100,
        totalUnrealizedPL: 0,
        totalRealizedPL: 0,
        unrealizedPFImpact: 0,
        realizedPFImpact: 0,
        winRate: 0,
        totalTrades: 0,
        openPositionsCount: 0,
        totalPortfolioValue: portfolioSize,
        netPL: 0,
        netPFImpact: 0
      };
    }
  }, [trades, portfolioSize, useCashBasis, getPortfolioSize]);
}

/**
 * Hook for individual trade heat calculations
 */
export function useTradeHeatCalculations(
  trades: Trade[],
  portfolioSize: number = 100000,
  getPortfolioSize?: (month: string, year: number) => number
): Map<string, number> {
  return useMemo(() => {
    const heatMap = new Map<string, number>();
    
    trades.forEach(trade => {
      const heat = safeCalculation(
        () => calcTradeOpenHeat(trade, portfolioSize, getPortfolioSize),
        0,
        `Failed to calculate heat for trade ${trade.id}`
      );
      heatMap.set(trade.id, heat);
    });
    
    return heatMap;
  }, [trades, portfolioSize, getPortfolioSize]);
}

/**
 * Hook for portfolio allocation breakdown
 */
export function usePortfolioAllocationBreakdown(
  trades: Trade[],
  portfolioSize: number = 100000,
  getPortfolioSize?: (month: string, year: number) => number
): {
  allocations: Array<{
    tradeId: string;
    symbol: string;
    allocation: number;
    positionSize: number;
    status: string;
  }>;
  totalAllocation: number;
  cashAllocation: number;
} {
  return useMemo(() => {
    const allocations = trades
      .filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial')
      .map(trade => {
        const allocation = safeCalculation(
          () => calcPortfolioAllocation(trade, portfolioSize, getPortfolioSize),
          0,
          `Failed to calculate allocation for trade ${trade.id}`
        );

        let positionSize = 0;
        if (trade.positionStatus === 'Partial') {
          positionSize = (trade.openQty || 0) * (trade.avgEntry || 0);
        } else {
          positionSize = trade.positionSize || 0;
        }

        return {
          tradeId: trade.id,
          symbol: trade.name || 'Unknown',
          allocation,
          positionSize,
          status: trade.positionStatus || 'Unknown'
        };
      });

    const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0);
    const cashAllocation = Math.max(0, 100 - totalAllocation);

    return {
      allocations,
      totalAllocation,
      cashAllocation
    };
  }, [trades, portfolioSize, getPortfolioSize]);
}

/**
 * Hook for portfolio performance over time
 */
export function usePortfolioPerformanceOverTime(
  trades: Trade[],
  portfolioSize: number = 100000,
  useCashBasis: boolean = false
): Array<{
  date: string;
  cumulativePL: number;
  cumulativePFImpact: number;
  portfolioValue: number;
}> {
  return useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Sort trades by accounting-aware date
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = useCashBasis 
        ? new Date(a.exit1Date || a.exit2Date || a.exit3Date || a.date)
        : new Date(a.date);
      const dateB = useCashBasis 
        ? new Date(b.exit1Date || b.exit2Date || b.exit3Date || b.date)
        : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    let cumulativePL = 0;
    const performance: Array<{
      date: string;
      cumulativePL: number;
      cumulativePFImpact: number;
      portfolioValue: number;
    }> = [];

    sortedTrades.forEach(trade => {
      // Calculate trade P&L based on accounting method
      let tradePL = 0;
      if (useCashBasis) {
        // For cash basis, only count realized P&L
        if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
          tradePL = trade.plRs || 0;
        }
      } else {
        // For accrual basis, count all P&L
        tradePL = trade.plRs || 0;
      }

      cumulativePL += tradePL;
      const cumulativePFImpact = portfolioSize > 0 ? (cumulativePL / portfolioSize) * 100 : 0;
      const portfolioValue = portfolioSize + cumulativePL;

      const relevantDate = useCashBasis 
        ? (trade.exit1Date || trade.exit2Date || trade.exit3Date || trade.date)
        : trade.date;

      performance.push({
        date: relevantDate,
        cumulativePL,
        cumulativePFImpact,
        portfolioValue
      });
    });

    return performance;
  }, [trades, portfolioSize, useCashBasis]);
}

/**
 * Hook for portfolio risk metrics
 */
export function usePortfolioRiskMetrics(
  trades: Trade[],
  portfolioSize: number = 100000
): {
  totalRisk: number;
  riskPercentage: number;
  averageRiskPerTrade: number;
  maxSingleTradeRisk: number;
  riskConcentration: number;
} {
  return useMemo(() => {
    const openTrades = trades.filter(t => 
      t.positionStatus === 'Open' || t.positionStatus === 'Partial'
    );

    if (openTrades.length === 0) {
      return {
        totalRisk: 0,
        riskPercentage: 0,
        averageRiskPerTrade: 0,
        maxSingleTradeRisk: 0,
        riskConcentration: 0
      };
    }

    const tradeRisks = openTrades.map(trade => {
      const entryPrice = trade.avgEntry || trade.entry || 0;
      const qty = trade.openQty || 0;
      const stop = trade.tsl || trade.sl || 0;
      const buySell = trade.buySell || 'Buy';

      if (entryPrice <= 0 || qty <= 0 || stop <= 0) return 0;

      let risk = 0;
      if (buySell === 'Buy') {
        if (stop >= entryPrice) return 0;
        risk = (entryPrice - stop) * qty;
      } else {
        if (stop <= entryPrice) return 0;
        risk = (stop - entryPrice) * qty;
      }

      return Math.max(0, risk);
    });

    const totalRisk = tradeRisks.reduce((sum, risk) => sum + risk, 0);
    const riskPercentage = portfolioSize > 0 ? (totalRisk / portfolioSize) * 100 : 0;
    const averageRiskPerTrade = tradeRisks.length > 0 ? totalRisk / tradeRisks.length : 0;
    const maxSingleTradeRisk = Math.max(...tradeRisks, 0);
    
    // Risk concentration (max single trade risk as % of total risk)
    const riskConcentration = totalRisk > 0 ? (maxSingleTradeRisk / totalRisk) * 100 : 0;

    return {
      totalRisk,
      riskPercentage,
      averageRiskPerTrade,
      maxSingleTradeRisk,
      riskConcentration
    };
  }, [trades, portfolioSize]);
}
