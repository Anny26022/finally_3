/**
 * Performance Analytics Calculation Library
 * Centralized location for all performance analytics calculations
 */

import { Trade } from '../../../types/trade';
import { calculateTradePL } from '../../../utils/accountingUtils';
import { calcHoldingDays } from '../utils/dateUtils';
import { calcWeightedRewardRisk } from '../core/tradeMetrics';
import { getTradesWithAccountingPL } from '../core/accountingCalculations';
import { calculateStandardDeviation, calculateExpectancy, calculateProfitFactor, calculateStreaks } from '../core/statisticalMetrics';
import { calcWinRate } from '../core/portfolioMetrics';
import { calcAccountingAwareAverage, calcAbsoluteAverage } from '../utils/mathUtils';

/**
 * XIRR calculation helper functions
 */
function daysToYears(days: number): number {
  return days / 365;
}

function calculateNPV(rate: number, dates: Date[], cashFlows: number[]): number {
  return cashFlows.reduce((npv, cashFlow, i) => {
    const yearFraction = daysToYears((dates[i].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24));
    return npv + cashFlow / Math.pow(1 + rate, yearFraction);
  }, 0);
}

function calculateXIRR(dates: Date[], cashFlows: number[], guess = 0.1): number {
  const EPSILON = 0.0000001;
  const MAX_ITERATIONS = 100;

  // Check if we have valid inputs
  if (dates.length !== cashFlows.length || dates.length < 2) {
    return 0;
  }

  // Verify that we have at least one positive and one negative cash flow
  const hasPositive = cashFlows.some(cf => cf > 0);
  const hasNegative = cashFlows.some(cf => cf < 0);
  if (!hasPositive || !hasNegative) {
    return 0;
  }

  let rate = guess;

  // Newton's method implementation
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const npv = calculateNPV(rate, dates, cashFlows);

    if (Math.abs(npv) < EPSILON) {
      return rate;
    }

    // Calculate derivative of NPV
    const derivative = cashFlows.reduce((sum, cashFlow, j) => {
      const yearFraction = daysToYears((dates[j].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24));
      return sum - yearFraction * cashFlow / Math.pow(1 + rate, yearFraction + 1);
    }, 0);

    // Update rate using Newton's method
    const newRate = rate - npv / derivative;

    if (Math.abs(newRate - rate) < EPSILON) {
      return newRate;
    }

    rate = newRate;
  }

  return rate;
}

/**
 * Calculate XIRR (Extended Internal Rate of Return)
 */
export function calcXIRR(
  startDate: Date,
  startingCapital: number,
  endDate: Date,
  endingCapital: number,
  capitalChanges: { date: Date; amount: number }[]
): number {
  // Sort all cash flows by date
  const allFlows = [
    { date: startDate, amount: -startingCapital }, // Initial investment is negative
    ...capitalChanges,
    { date: endDate, amount: endingCapital } // Final value is positive
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const dates = allFlows.map(flow => flow.date);
  const cashFlows = allFlows.map(flow => flow.amount);

  return calculateXIRR(dates, cashFlows) * 100; // Convert to percentage
}

/**
 * Calculate comprehensive performance metrics
 */
export function calcPerformanceMetrics(
  trades: Trade[],
  useCashBasis: boolean = false
): {
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
} {


  if (!trades || trades.length === 0) {
    return {
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
    };
  }

  // Process trades with corrected holding days first (same logic as Deep Analytics)
  let processedTrades = trades;

  if (!useCashBasis) {
    // For accrual basis: recalculate holding days using first exit date
    processedTrades = trades.map(trade => {
      if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
        // Find the first exit date for accrual basis
        const exitDates = [trade.exit1Date, trade.exit2Date, trade.exit3Date]
          .filter(Boolean) as string[];

        if (exitDates.length > 0 && trade.date) {
          try {
            // For accrual basis, use the FIRST exit date (when trade was initiated to be closed)
            const firstExitDate = exitDates.sort((a, b) =>
              new Date(a).getTime() - new Date(b).getTime()
            )[0];

            // Calculate days between entry and first exit
            const entryDate = new Date(trade.date);
            const exitDate = new Date(firstExitDate);
            const calculatedHoldingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

            return {
              ...trade,
              holdingDays: Math.max(0, calculatedHoldingDays) // Ensure non-negative
            };
          } catch (error) {
            // Keep original holdingDays as fallback
            return trade;
          }
        }
      }
      // For open positions or trades without exit dates, keep original
      return trade;
    });
  } else {
    // For cash basis: expand trades into individual exit entries (same logic as Deep Analytics)
    const expanded: any[] = [];

    trades.forEach(trade => {
      if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
        // Import the getExitDatesWithFallback function
        const exits = trade.exit1Date || trade.exit2Date || trade.exit3Date ? [
          ...(trade.exit1Date ? [{ date: trade.exit1Date, qty: trade.exit1Qty || 0, price: trade.exit1Price || 0 }] : []),
          ...(trade.exit2Date ? [{ date: trade.exit2Date, qty: trade.exit2Qty || 0, price: trade.exit2Price || 0 }] : []),
          ...(trade.exit3Date ? [{ date: trade.exit3Date, qty: trade.exit3Qty || 0, price: trade.exit3Price || 0 }] : [])
        ] : [];

        if (exits.length > 0) {
          // Create separate entries for each exit with calculated holding days
          exits.forEach((exit, index) => {
            // Calculate holding days from entry to this specific exit date
            let calculatedHoldingDays = (trade.holdingDays && !isNaN(trade.holdingDays)) ? trade.holdingDays : 0; // fallback to 0 if NaN

            if (trade.date && exit.date) {
              try {
                const entryDate = new Date(trade.date);
                const exitDate = new Date(exit.date);
                calculatedHoldingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
                calculatedHoldingDays = Math.max(0, calculatedHoldingDays); // Ensure non-negative


              } catch (error) {
                // Keep original holdingDays as fallback
              }
            }

            const expandedTrade = {
              ...trade,
              id: `${trade.id}_exit_${index}`, // Unique ID for each exit
              holdingDays: calculatedHoldingDays, // Use calculated holding days for this exit
              _cashBasisExit: {
                date: exit.date,
                qty: exit.qty,
                price: exit.price
              }
            };
            expanded.push(expandedTrade);
          });
        } else {
          // No exit data, include original trade
          expanded.push(trade);
        }
      } else {
        // Open positions - include as-is
        expanded.push(trade);
      }
    });

    processedTrades = expanded.length > 0 ? expanded : trades; // Fallback to original if expansion failed
  }

  // Get trades with accounting-aware P/L using processed trades
  const tradesWithAccountingPL = getTradesWithAccountingPL(processedTrades, useCashBasis);



  // Basic statistics
  const totalTrades = tradesWithAccountingPL.length;
  const winningTrades = tradesWithAccountingPL.filter(t => t.accountingPL > 0);
  const losingTrades = tradesWithAccountingPL.filter(t => t.accountingPL < 0);



  // Use centralized win rate calculation for consistency
  const winRate = calcWinRate(trades, useCashBasis);

  // P/L calculations using centralized functions
  const avgGain = calcAccountingAwareAverage(tradesWithAccountingPL, true);
  const avgLoss = calcAbsoluteAverage(tradesWithAccountingPL);

  // Stock move calculations
  const avgPosMove = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + (t.stockMove || 0), 0) / winningTrades.length
    : 0;
  const avgNegMove = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + (t.stockMove || 0), 0) / losingTrades.length
    : 0;

  // Position size calculation
  const avgPositionSize = totalTrades > 0
    ? tradesWithAccountingPL.reduce((sum, t) => sum + (t.allocation || 0), 0) / totalTrades
    : 0;

  // Holding days calculation - use corrected holding days from processed trades
  const avgHoldingDays = totalTrades > 0
    ? tradesWithAccountingPL.reduce((sum, trade) => {
        // Use the corrected holdingDays from processed trades, handle NaN properly
        const holdingDays = (trade.holdingDays && !isNaN(trade.holdingDays)) ? trade.holdingDays : 0;
        return sum + holdingDays;
      }, 0) / totalTrades
    : 0;

  // Risk-reward calculations
  const avgR = totalTrades > 0
    ? tradesWithAccountingPL.reduce((sum, trade) => {
        const weightedRR = calcWeightedRewardRisk(trade);
        return sum + weightedRR;
      }, 0) / totalTrades
    : 0;

  // Plan adherence
  const planFollowed = totalTrades > 0
    ? (tradesWithAccountingPL.filter(t => t.planFollowed).length / totalTrades) * 100
    : 0;

  // Open positions
  const openPositions = tradesWithAccountingPL.filter(t =>
    t.positionStatus === 'Open' || t.positionStatus === 'Partial'
  ).length;

  // Advanced metrics
  const expectancy = calculateExpectancy(trades, useCashBasis);
  const profitFactor = calculateProfitFactor(trades, useCashBasis);
  const { maxWinStreak, maxLossStreak } = calculateStreaks(trades, useCashBasis);

  return {
    totalTrades,
    winRate,
    avgGain,
    avgLoss,
    avgPosMove,
    avgNegMove,
    avgPositionSize,
    avgHoldingDays,
    avgR,
    planFollowed,
    openPositions,
    expectancy,
    profitFactor,
    maxWinStreak,
    maxLossStreak
  };
}

/**
 * Calculate setup-wise performance statistics
 */
export function calcSetupPerformance(
  trades: Trade[],
  useCashBasis: boolean = false
): Array<{
  setupName: string;
  totalTrades: number;
  winRate: number;
  totalPfImpact: number;
  avgPfImpact: number;
}> {
  if (!trades || trades.length === 0) return [];

  // Group trades by setup
  const tradesBySetup = trades.reduce((acc, trade) => {
    const setup = trade.setup || 'Unknown';
    if (!acc[setup]) acc[setup] = [];
    acc[setup].push(trade);
    return acc;
  }, {} as Record<string, Trade[]>);

  return Object.entries(tradesBySetup).map(([setupName, setupTrades]) => {
    const totalTrades = setupTrades.length;

    // Calculate P/L based on accounting method
    const tradesWithAccountingPL = setupTrades.map(trade => ({
      ...trade,
      accountingPL: calculateTradePL(trade, useCashBasis)
    }));

    const winningTrades = tradesWithAccountingPL.filter(t => t.accountingPL > 0).length;
    // Use centralized win rate calculation for consistency
    const winRate = calcWinRate(setupTrades, useCashBasis);

    // Use accounting-method-aware PF Impact
    const totalPfImpact = setupTrades.reduce((sum, trade) => {
      const pfImpact = useCashBasis
        ? (trade._cashPfImpact ?? 0)
        : (trade._accrualPfImpact ?? trade.pfImpact ?? 0);
      return sum + pfImpact;
    }, 0);

    const avgPfImpact = totalTrades > 0 ? totalPfImpact / totalTrades : 0;

    return {
      setupName,
      totalTrades,
      winRate,
      totalPfImpact,
      avgPfImpact
    };
  });
}

/**
 * Calculate monthly performance data
 */
export function calcMonthlyPerformance(
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
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Group trades by month based on accounting method
  const tradesByMonth = trades.reduce((acc, trade) => {
    const relevantDate = useCashBasis 
      ? (trade.exit1Date || trade.exit2Date || trade.exit3Date || trade.date)
      : trade.date;
    
    if (relevantDate) {
      const date = new Date(relevantDate);
      const month = date.toLocaleString('default', { month: 'short' });
      if (!acc[month]) acc[month] = [];
      acc[month].push(trade);
    }
    return acc;
  }, {} as Record<string, Trade[]>);

  return monthOrder.map((month) => {
    const monthTrades = tradesByMonth[month] || [];
    const tradesCount = monthTrades.length;
    let winCount = 0;
    let totalGain = 0;
    let totalLoss = 0;
    let totalHoldingDays = 0;

    monthTrades.forEach(trade => {
      const accountingPL = calculateTradePL(trade, useCashBasis);
      const stockMove = trade.stockMove || 0;

      if (accountingPL > 0) {
        winCount++;
        totalGain += stockMove;
      } else if (accountingPL < 0) {
        totalLoss += stockMove;
      }

      // Calculate holding days based on accounting method
      let tradeHoldingDays = trade.holdingDays || 0; // fallback to original

      if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
        const validExitDates = [trade.exit1Date, trade.exit2Date, trade.exit3Date]
          .filter(Boolean) as string[];

        if (validExitDates.length > 0 && trade.date) {
          try {
            let primaryExitDate: string;

            if (useCashBasis) {
              // Cash basis: Use LATEST exit date (when cash was last received)
              primaryExitDate = validExitDates.sort((a, b) =>
                new Date(b).getTime() - new Date(a).getTime()
              )[0];
            } else {
              // Accrual basis: Use FIRST exit date (when trade was first realized)
              primaryExitDate = validExitDates.sort((a, b) =>
                new Date(a).getTime() - new Date(b).getTime()
              )[0];
            }

            // Calculate days between entry and primary exit
            const entryDate = new Date(trade.date);
            const exitDate = new Date(primaryExitDate);
            tradeHoldingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
            tradeHoldingDays = Math.max(0, tradeHoldingDays); // Ensure non-negative
          } catch (error) {
            // Keep original holdingDays as fallback
          }
        }
      }

      totalHoldingDays += tradeHoldingDays;
    });

    const winPercentage = tradesCount > 0 ? (winCount / tradesCount) * 100 : 0;
    const avgGain = winCount > 0 ? totalGain / winCount : 0;
    const avgLoss = (tradesCount - winCount) > 0 ? totalLoss / (tradesCount - winCount) : 0;

    // Calculate weighted R:R
    const avgRR = tradesCount > 0
      ? monthTrades.reduce((sum, trade) => sum + calcWeightedRewardRisk(trade), 0) / tradesCount
      : 0;

    const avgHoldingDays = tradesCount > 0 ? totalHoldingDays / tradesCount : 0;

    // Get portfolio data for this month
    const monthPortfolio = monthlyPortfolios.find(mp => mp.month === month) ||
      { month, pl: 0, startingCapital: 0 };

    const pl = monthPortfolio.pl || 0;
    const plPercentage = monthPortfolio.startingCapital > 0 
      ? (pl / monthPortfolio.startingCapital) * 100 
      : 0;

    return {
      month,
      year: new Date().getFullYear(), // You might want to pass this as parameter
      trades: tradesCount,
      winPercentage: tradesCount > 0 ? winPercentage : 0,
      avgGain: tradesCount > 0 ? avgGain : 0,
      avgLoss: tradesCount > 0 ? avgLoss : 0,
      avgRR: tradesCount > 0 ? avgRR : 0,
      avgHoldingDays: tradesCount > 0 ? avgHoldingDays : 0,
      pl,
      plPercentage
    };
  });
}

/**
 * Calculate top and bottom performers by various metrics
 */
export function calcTopPerformers(
  trades: Trade[],
  metricType: 'stockMove' | 'pfImpact' | 'rewardRisk' | 'plRs' = 'stockMove',
  useCashBasis: boolean = false
): {
  highest: Trade | null;
  lowest: Trade | null;
  hasMultipleTrades: boolean;
} {
  if (!trades || trades.length === 0) {
    return { highest: null, lowest: null, hasMultipleTrades: false };
  }

  // Deduplicate for cash basis if needed
  let processedTrades = trades;
  if (useCashBasis) {
    const seenTradeIds = new Set();
    processedTrades = trades.filter(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (seenTradeIds.has(originalId)) return false;
      seenTradeIds.add(originalId);
      return true;
    });
  }

  // Get metric value for each trade
  const tradesWithValues = processedTrades.map(trade => {
    let value: number;
    
    switch (metricType) {
      case 'stockMove':
        value = trade.stockMove || 0;
        break;
      case 'pfImpact':
        value = useCashBasis 
          ? (trade._cashPfImpact ?? trade.pfImpact ?? 0)
          : (trade._accrualPfImpact ?? trade.pfImpact ?? 0);
        break;
      case 'rewardRisk':
        value = calcWeightedRewardRisk(trade);
        break;
      case 'plRs':
        value = trade.plRs || 0;
        break;
      default:
        value = 0;
    }
    
    return { trade, value };
  });

  // Sort by value (highest to lowest)
  tradesWithValues.sort((a, b) => b.value - a.value);

  return {
    highest: tradesWithValues[0]?.trade || null,
    lowest: tradesWithValues[tradesWithValues.length - 1]?.trade || null,
    hasMultipleTrades: tradesWithValues.length > 1
  };
}
