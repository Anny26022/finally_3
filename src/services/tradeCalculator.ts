import { Trade } from '../types/trade';
import { calculateTradePL, getTradeDateForAccounting } from '../utils/accountingUtils';
import {
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcSLPercent,
  calcOpenQty,
  calcExitedQty,
  calcAvgExitPrice,
  calcStockMove,
  calcRewardRisk,
  calcHoldingDays,
  calcRealisedAmount,
  calcPFImpact,
  calcRealizedPL_FIFO
} from '../lib/calculations';

/**
 * WORLD-CLASS TRADE CALCULATOR
 * 
 * Pure calculation functions for the processing pipeline:
 * - No side effects
 * - Highly optimized
 * - Easy to test
 * - Cacheable results
 */

/**
 * PROCESS TRADES: ENTERPRISE-SCALE calculation pipeline with performance optimizations
 */
export function processTrades(
  trades: Trade[],
  getPortfolioSize: (month: string, year: number) => number
): Trade[] {
  if (!trades || trades.length === 0) return [];

  const startTime = performance.now();

  // PERFORMANCE OPTIMIZATION: Pre-sort trades chronologically for proper calculations
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  // PERFORMANCE OPTIMIZATION: Batch processing for large datasets
  if (trades.length > 500) {

    const BATCH_SIZE = 100;
    const results: Trade[] = [];

    for (let i = 0; i < sortedTrades.length; i += BATCH_SIZE) {
      const batch = sortedTrades.slice(i, i + BATCH_SIZE);
      const batchResults = batch.map(trade => calculateTrade(trade, getPortfolioSize));
      results.push(...batchResults);


    }

    const processingTime = performance.now() - startTime;

    return results;
  } else {
    // Standard processing for smaller datasets
    const results = sortedTrades.map(trade => calculateTrade(trade, getPortfolioSize));
    const processingTime = performance.now() - startTime;

    return results;
  }
}

/**
 * CALCULATE TRADE: Process individual trade calculations
 */
function calculateTrade(
  trade: Trade,
  getPortfolioSize: (month: string, year: number) => number
): Trade {
  try {
    // Calculate entry metrics
    const allEntries = getValidEntries(trade);
    const avgEntry = calcAvgEntry(allEntries);
    const totalInitialQty = allEntries.reduce((sum, e) => sum + e.qty, 0);
    const positionSize = calcPositionSize(avgEntry, totalInitialQty);

    // Get portfolio size for allocation calculation
    const portfolioSize = getPortfolioSizeForTrade(trade, getPortfolioSize);
    const allocation = trade.allocation || calcAllocation(positionSize, portfolioSize);
    const slPercent = calcSLPercent(trade.sl, trade.entry);

    // Calculate exit metrics
    const allExits = getValidExits(trade);
    const exitedQty = allExits.reduce((sum, e) => sum + e.qty, 0);
    const openQty = Math.max(0, totalInitialQty - exitedQty);
    const avgExitPrice = calcAvgExitPrice(allExits);

    // Calculate performance metrics
    const stockMove = calcStockMove(
      avgEntry, avgExitPrice, trade.cmp, openQty, exitedQty, trade.positionStatus, trade.buySell
    );

    const holdingDays = calculateHoldingDays(trade, allExits);
    const realisedAmount = calcRealisedAmount(exitedQty, avgExitPrice);
    const plRs = calculatePL(allEntries, allExits, trade.buySell as 'Buy' | 'Sell');
    
    // Calculate portfolio impact
    const pfImpact = calcPFImpact(plRs, portfolioSize);

    return {
      ...trade,
      name: (trade.name || '').toUpperCase(),
      avgEntry,
      positionSize,
      allocation,
      slPercent,
      openQty,
      exitedQty,
      avgExitPrice,
      stockMove,
      holdingDays,
      realisedAmount,
      plRs,
      pfImpact,
      // Store both accounting method values for later use
      _accrualPL: plRs,
      _cashPL: calculateTradePL(trade, true),
      _accrualPfImpact: pfImpact,
      _cashPfImpact: calcPFImpact(calculateTradePL(trade, true), portfolioSize)
    };
  } catch (error) {
    console.error('❌ Error calculating trade:', trade.id, error);
    return trade; // Return original trade on error
  }
}

/**
 * APPLY CUMULATIVE PROFIT: Final step in the pipeline
 */
export function applyCumulativeProfit(trades: Trade[], useCashBasis: boolean): Trade[] {
  if (!trades || trades.length === 0) return [];

  // Sort chronologically for cumulative calculation
  const chronological = [...trades].sort(getChronologicalSortComparator());
  
  let runningCummPf = 0;
  const cummPfMap = new Map<string, number>();

  chronological.forEach(trade => {
    const pfImpact = useCashBasis 
      ? (trade._cashPfImpact ?? 0)
      : (trade._accrualPfImpact ?? trade.pfImpact ?? 0);

    // Only include closed/partial trades in cumulative calculation
    if (trade.positionStatus !== 'Open') {
      runningCummPf += pfImpact;
    }

    cummPfMap.set(trade.id, runningCummPf);
  });

  // Apply cumulative values to original order
  return trades.map(trade => ({
    ...trade,
    cummPf: cummPfMap.get(trade.id) || 0
  }));
}

/**
 * CHRONOLOGICAL SORT COMPARATOR: For consistent ordering
 */
export function getChronologicalSortComparator() {
  return (a: Trade, b: Trade) => {
    const tradeNoA = Number(a.tradeNo) || 0;
    const tradeNoB = Number(b.tradeNo) || 0;

    if (tradeNoA !== tradeNoB) {
      return tradeNoA - tradeNoB;
    }

    if (a.date && b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }

    return 0;
  };
}

/**
 * HELPER FUNCTIONS
 */

function getValidEntries(trade: Trade) {
  return [
    { price: Number(trade.entry || 0), qty: Number(trade.initialQty || 0) },
    { price: Number(trade.pyramid1Price || 0), qty: Number(trade.pyramid1Qty || 0) },
    { price: Number(trade.pyramid2Price || 0), qty: Number(trade.pyramid2Qty || 0) }
  ].filter(e => e.qty > 0 && e.price > 0);
}

function getValidExits(trade: Trade) {
  return [
    { price: Number(trade.exit1Price || 0), qty: Number(trade.exit1Qty || 0) },
    { price: Number(trade.exit2Price || 0), qty: Number(trade.exit2Qty || 0) },
    { price: Number(trade.exit3Price || 0), qty: Number(trade.exit3Qty || 0) }
  ].filter(e => e.qty > 0 && e.price > 0);
}

function getPortfolioSizeForTrade(
  trade: Trade,
  getPortfolioSize: (month: string, year: number) => number
): number {
  if (!trade.date) return 100000;

  try {
    const date = new Date(trade.date);
    const rawMonth = date.toLocaleString('default', { month: 'short' });
    // Normalize month to handle "Sept" -> "Sep" conversion
    const month = normalizeMonthForPortfolio(rawMonth);
    const year = date.getFullYear();
    return getPortfolioSize(month, year) || 100000;
  } catch {
    return 100000;
  }
}

// Helper function to normalize month names for portfolio calculations
function normalizeMonthForPortfolio(month: string): string {
  const monthMap: Record<string, string> = {
    'Sept': 'Sep',
    'September': 'Sep',
    'January': 'Jan',
    'February': 'Feb',
    'March': 'Mar',
    'April': 'Apr',
    'May': 'May',
    'June': 'Jun',
    'July': 'Jul',
    'August': 'Aug',
    'October': 'Oct',
    'November': 'Nov',
    'December': 'Dec'
  };

  return monthMap[month] || month;
}

function calculateHoldingDays(trade: Trade, allExits: any[]): number {
  const pyramidDates = [];
  if (trade.pyramid1Date && trade.pyramid1Qty) pyramidDates.push({ date: trade.pyramid1Date, qty: trade.pyramid1Qty });
  if (trade.pyramid2Date && trade.pyramid2Qty) pyramidDates.push({ date: trade.pyramid2Date, qty: trade.pyramid2Qty });

  const exitDatesForHolding = [];
  if (trade.exit1Date && trade.exit1Qty) exitDatesForHolding.push({ date: trade.exit1Date, qty: trade.exit1Qty });
  if (trade.exit2Date && trade.exit2Qty) exitDatesForHolding.push({ date: trade.exit2Date, qty: trade.exit2Qty });
  if (trade.exit3Date && trade.exit3Qty) exitDatesForHolding.push({ date: trade.exit3Date, qty: trade.exit3Qty });

  let primaryExitDate: string | null = null;
  if (allExits.length > 0) {
    const validExitDates = [trade.exit1Date, trade.exit2Date, trade.exit3Date].filter(Boolean) as string[];
    if (validExitDates.length > 0) {
      // Note: This function is used for initial trade calculation, which is accounting-method agnostic
      // The actual accounting-method-aware calculations are done in calcPerformanceMetrics and calcMonthlyPerformance
      // For consistency with the original behavior, we'll use the first exit date here
      primaryExitDate = validExitDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

      // The accounting-method-specific calculations will override this value when needed
    }
  }

  return calcHoldingDays(trade.date, primaryExitDate, pyramidDates, exitDatesForHolding);
}

function calculatePL(allEntries: any[], allExits: any[], buySell: 'Buy' | 'Sell'): number {
  if (allExits.length === 0) return 0;
  return calcRealizedPL_FIFO(allEntries, allExits, buySell);
}
