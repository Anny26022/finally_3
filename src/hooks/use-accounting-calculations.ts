import { useMemo, useCallback } from 'react';
import { Trade } from '../types/trade';
import { useAccountingMethod } from '../context/AccountingMethodContext';
import { calculateTradePL, getTradeDateForAccounting } from '../utils/accountingUtils';
import { calcHoldingDays, calcWeightedRewardRisk } from "../lib/calculations";
import {
  getTradesWithAccountingPL,
  calcPerformanceMetrics,
  safeCalculation
} from '../lib/calculations';

/**
 * Shared hook for accounting-aware P/L calculations
 * Eliminates redundant calculations across components
 */
export const useAccountingCalculations = (trades: Trade[]) => {
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';

  // Memoized P/L calculation function
  const calculateAccountingPL = useCallback((trade: Trade) => {
    // For cash basis with expanded trades, sum up all the individual exit P/Ls
    if (useCashBasis && trade._expandedTrades && trade._expandedTrades.length > 0) {
      return trade._expandedTrades.reduce((sum, expandedTrade) => {
        return sum + calculateTradePL(expandedTrade, true);
      }, 0);
    }
    return calculateTradePL(trade, useCashBasis);
  }, [useCashBasis]);

  // Memoized calculations to prevent unnecessary re-computations
  const calculations = useMemo(() => {
    // Handle edge cases
    if (!trades || trades.length === 0) {
      return {
        tradesWithAccountingPL: [],
        totalTrades: 0,
        winningTrades: [],
        losingTrades: [],
        winRate: 0,
        grossPL: 0,
        avgGain: 0,
        avgLoss: 0,
        avgPosMove: 0,
        avgNegMove: 0,
        avgPositionSize: 0,
        avgHoldingDays: 0,
        avgR: 0,
        planFollowed: 0,
        openPositions: 0,
        useCashBasis,
        accountingMethod
      };
    }

    // Use centralized accounting-aware trade calculations
    const tradesWithAccountingPL = safeCalculation(
      () => getTradesWithAccountingPL(trades, useCashBasis),
      [],
      'Failed to get trades with accounting P/L'
    );

    // Use centralized performance metrics calculation
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

    // Extract values from centralized calculations
    const totalTrades = performanceMetrics.totalTrades;
    const winningTrades = tradesWithAccountingPL.filter(t => t.accountingPL > 0);
    const losingTrades = tradesWithAccountingPL.filter(t => t.accountingPL < 0);
    const winRate = performanceMetrics.winRate;
    const grossPL = tradesWithAccountingPL.reduce((sum, trade) => sum + trade.accountingPL, 0);
    const avgGain = performanceMetrics.avgGain;
    const avgLoss = performanceMetrics.avgLoss;
    const avgPosMove = performanceMetrics.avgPosMove;
    const avgNegMove = performanceMetrics.avgNegMove;
    const avgPositionSize = performanceMetrics.avgPositionSize;

    // Use centralized performance metrics for remaining calculations
    const avgHoldingDays = performanceMetrics.avgHoldingDays;
    const avgR = performanceMetrics.avgR;
    const planFollowed = performanceMetrics.planFollowed;

    // Use centralized performance metrics for open positions
    const openPositions = performanceMetrics.openPositions;

    return {
      tradesWithAccountingPL,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      grossPL,
      avgGain,
      avgLoss,
      avgPosMove,
      avgNegMove,
      avgPositionSize,
      avgHoldingDays,
      avgR,
      planFollowed,
      openPositions,
      useCashBasis,
      accountingMethod
    };
  }, [trades, useCashBasis, accountingMethod]);

  return calculations;
};

/**
 * Hook for getting accounting method display information
 */
export const useAccountingMethodDisplay = () => {
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';

  return {
    accountingMethod,
    useCashBasis,
    displayName: useCashBasis ? 'Cash Basis' : 'Accrual Basis',
    description: useCashBasis
      ? 'P/L attributed to exit dates'
      : 'P/L attributed to entry dates',
    shortDescription: useCashBasis ? 'Exit-based' : 'Entry-based'
  };
};
