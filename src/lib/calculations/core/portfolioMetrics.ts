/**
 * Portfolio Metrics Calculation Library
 * Centralized location for all portfolio-level calculations
 */

import { Trade } from '../../../types/trade';
import { calculateTradePL } from '../../../utils/accountingUtils';
import { calcAllocationPercentage } from '../utils/mathUtils';

/**
 * Calculate open heat for a single trade
 */
export function calcTradeOpenHeat(
  trade: any,
  defaultPortfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): number {
  if (trade.positionStatus !== 'Open' && trade.positionStatus !== 'Partial') {
    return 0;
  }

  // Validate and parse trade date
  let effectivePortfolioSize = defaultPortfolioSize;
  if (getPortfolioSize && trade.date) {
    try {
      const tradeDate = new Date(trade.date);
      if (!isNaN(tradeDate.getTime())) {
        const month = tradeDate.toLocaleString('default', { month: 'short' });
        const year = tradeDate.getFullYear();
        const monthlyPortfolioSize = getPortfolioSize(month, year);
        if (monthlyPortfolioSize !== undefined && monthlyPortfolioSize > 0) {
          effectivePortfolioSize = monthlyPortfolioSize;
        }
      }
    } catch (error) {
      // Use default portfolio size if date parsing fails
    }
  }

  if (effectivePortfolioSize <= 0 || !isFinite(effectivePortfolioSize)) return 0;

  const entryPrice = trade.avgEntry || trade.entry || 0;
  const qty = trade.openQty || 0;
  const sl = trade.sl || 0;
  const tsl = trade.tsl || 0;

  // Validate all numeric values are finite and positive where required
  if (entryPrice <= 0 || !isFinite(entryPrice)) return 0;
  if (qty <= 0 || !isFinite(qty)) return 0;
  if ((sl > 0 && !isFinite(sl)) || (tsl > 0 && !isFinite(tsl))) return 0;

  // Determine which stop to use based on the relationship between sl and tsl
  let stop = 0;

  if (tsl > 0 && sl > 0) {
    // Both tsl and sl exist
    if (tsl === sl) {
      // If tsl = sl, use tsl for calculation
      stop = tsl;
    } else if (tsl > sl) {
      // If tsl > sl, use tsl for calculation
      stop = tsl;
    } else if (tsl < sl) {
      // If tsl < sl, use sl for calculation (sl > tsl case)
      stop = sl;
    }
  } else if (sl > 0) {
    // Only sl exists, use sl
    stop = sl;
  } else if (tsl > 0) {
    // Only tsl exists, use tsl
    stop = tsl;
  } else {
    // No stop loss set
    return 0;
  }

  if (stop <= 0) return 0;

  const buySell = (trade.buySell || 'Buy').toLowerCase();
  let risk = 0;

  // Normalize buy/sell values
  const isBuyPosition = ['buy', 'long'].includes(buySell);
  const isSellPosition = ['sell', 'short', 'short sell'].includes(buySell);

  if (isBuyPosition) {
    // For buy positions, stop should be below entry
    if (stop >= entryPrice) return 0; // Invalid: SL above entry for buy
    risk = (entryPrice - stop) * qty;
  } else if (isSellPosition) {
    // For sell positions, stop should be above entry
    if (stop <= entryPrice) return 0; // Invalid: SL below entry for sell
    risk = (stop - entryPrice) * qty;
  } else {
    // Unknown position type, default to buy behavior
    if (stop >= entryPrice) return 0;
    risk = (entryPrice - stop) * qty;
  }

  return effectivePortfolioSize > 0 ? (Math.max(0, risk) / effectivePortfolioSize) * 100 : 0;
}

/**
 * Calculate total open heat for all open/partial positions
 */
export function calcOpenHeat(
  trades: any[],
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): number {
  if (!trades || trades.length === 0) return 0;

  return trades
    .filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial')
    .reduce((sum, trade) => {
      const tradeHeat = calcTradeOpenHeat(trade, portfolioSize, getPortfolioSize);
      return sum + tradeHeat;
    }, 0);
}

/**
 * Calculate portfolio allocation for a trade
 */
export function calcPortfolioAllocation(
  trade: Trade,
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): number {
  if (!trade.date || portfolioSize <= 0) return 0;

  let effectivePortfolioSize = portfolioSize;

  if (getPortfolioSize) {
    try {
      const tradeDate = new Date(trade.date);
      const month = tradeDate.toLocaleString('default', { month: 'short' });
      const year = tradeDate.getFullYear();
      const monthlySize = getPortfolioSize(month, year);
      if (monthlySize > 0) {
        effectivePortfolioSize = monthlySize;
      }
    } catch (error) {
      // Use default portfolio size on error
    }
  }

  const positionSize = trade.positionSize || 0;
  return effectivePortfolioSize > 0 ? (positionSize / effectivePortfolioSize) * 100 : 0;
}

/**
 * Calculate cash percentage (100 - total allocation)
 */
export function calcCashPercentage(
  openTrades: Trade[],
  portfolioSize: number,
  getPortfolioSize?: (month: string, year: number) => number
): number {
  if (!openTrades || openTrades.length === 0) return 100;

  const totalAllocation = openTrades.reduce((sum, trade) => {
    let allocation = 0;
    
    if (trade.positionStatus === 'Partial') {
      // For partial positions, calculate remaining allocation based on open quantity using centralized function
      const remainingInvestedAmount = (trade.openQty || 0) * (trade.avgEntry || 0);
      allocation = calcAllocationPercentage(remainingInvestedAmount, portfolioSize);
    } else if (trade.positionStatus === 'Open') {
      // For fully open positions, use full allocation
      allocation = calcPortfolioAllocation(trade, portfolioSize, getPortfolioSize);
    }
    
    return sum + allocation;
  }, 0);

  return Math.max(0, 100 - totalAllocation);
}

/**
 * Calculate total invested amount across all open positions
 */
export function calcTotalInvestedAmount(trades: Trade[]): number {
  return trades
    .filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial')
    .reduce((sum, trade) => {
      if (trade.positionStatus === 'Partial') {
        // For partial positions, only count remaining open quantity
        return sum + ((trade.openQty || 0) * (trade.avgEntry || 0));
      } else {
        // For fully open positions, use position size
        return sum + (trade.positionSize || 0);
      }
    }, 0);
}

/**
 * Calculate percent invested (total invested / portfolio size)
 */
export function calcPercentInvested(
  trades: Trade[],
  portfolioSize: number
): number {
  if (portfolioSize <= 0) return 0;
  
  const totalInvested = calcTotalInvestedAmount(trades);
  return (totalInvested / portfolioSize) * 100;
}

/**
 * Calculate unrealized P&L for all open positions
 * FIXED: Match original implementation - calculate unrealized P/L for both cash and accrual basis
 */
export function calcTotalUnrealizedPL(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  const openTrades = trades.filter(trade => trade.positionStatus === 'Open' || trade.positionStatus === 'Partial');

  if (useCashBasis) {
    // For cash basis, only count each original trade once for unrealized P/L (match original)
    const processedTradeIds = new Set<string>();
    let unrealizedPL = 0;

    openTrades.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0]; // Get original trade ID
      if (!processedTradeIds.has(originalId)) {
        processedTradeIds.add(originalId);

        const avgEntry = trade.avgEntry || trade.entry || 0;
        const cmp = trade.cmp || 0;
        const openQty = trade.openQty || 0;
        const buySell = trade.buySell || 'Buy';

        if (avgEntry > 0 && cmp > 0 && openQty > 0) {
          const tradePL = buySell === 'Buy'
            ? (cmp - avgEntry) * openQty
            : (avgEntry - cmp) * openQty;
          unrealizedPL += tradePL;
        }
      }
    });

    return unrealizedPL;
  } else {
    // For accrual basis, straightforward calculation (same as before)
    return openTrades.reduce((sum, trade) => {
      const avgEntry = trade.avgEntry || trade.entry || 0;
      const cmp = trade.cmp || 0;
      const openQty = trade.openQty || 0;
      const buySell = trade.buySell || 'Buy';

      if (avgEntry > 0 && cmp > 0 && openQty > 0) {
        const unrealizedPL = buySell === 'Buy'
          ? (cmp - avgEntry) * openQty
          : (avgEntry - cmp) * openQty;
        return sum + unrealizedPL;
      }
      return sum;
    }, 0);
  }
}

/**
 * Calculate realized P&L for all closed/partial positions
 */
export function calcTotalRealizedPL(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  if (useCashBasis) {
    // For cash basis, sum up all expanded trades with cash basis exits
    return trades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    ).reduce((sum, trade) => sum + calculateTradePL(trade, true), 0);
  } else {
    // For accrual basis, use standard P&L calculation
    return trades
      .filter(trade => trade.positionStatus !== 'Open')
      .reduce((sum, trade) => sum + calculateTradePL(trade, false), 0);
  }
}

/**
 * Calculate portfolio impact of unrealized P&L
 */
export function calcUnrealizedPFImpact(
  trades: Trade[],
  portfolioSize: number,
  useCashBasis: boolean = false
): number {
  if (portfolioSize <= 0) return 0;
  
  const unrealizedPL = calcTotalUnrealizedPL(trades, useCashBasis);
  return (unrealizedPL / portfolioSize) * 100;
}

/**
 * Calculate portfolio impact of realized P&L
 */
export function calcRealizedPFImpact(
  trades: Trade[],
  portfolioSize: number,
  useCashBasis: boolean = false
): number {
  if (portfolioSize <= 0) return 0;
  
  const realizedPL = calcTotalRealizedPL(trades, useCashBasis);
  return (realizedPL / portfolioSize) * 100;
}

/**
 * Calculate win rate based on accounting method
 */
export function calcWinRate(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  if (!trades || trades.length === 0) return 0;

  let tradesWithPL: Array<{ accountingPL: number }>;

  if (useCashBasis) {
    // For cash basis, group by original trade ID and sum P&L
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
    // For accrual basis, use trades as-is
    tradesWithPL = trades
      .filter(trade => trade.positionStatus !== 'Open')
      .map(trade => ({
        accountingPL: calculateTradePL(trade, false)
      }));
  }

  if (tradesWithPL.length === 0) return 0;

  const winningTrades = tradesWithPL.filter(t => t.accountingPL > 0);
  return (winningTrades.length / tradesWithPL.length) * 100;
}

/**
 * Calculate total number of trades based on accounting method
 */
export function calcTotalTrades(
  trades: Trade[],
  useCashBasis: boolean = false
): number {
  if (!trades || trades.length === 0) return 0;

  if (useCashBasis) {
    // For cash basis, count unique original trades
    const seenTradeIds = new Set();
    return trades.filter(t => {
      const originalId = t.id.split('_exit_')[0];
      if (seenTradeIds.has(originalId)) return false;
      seenTradeIds.add(originalId);
      return true;
    }).length;
  } else {
    // For accrual basis, use raw count
    return trades.length;
  }
}

/**
 * Calculate open positions count
 */
export function calcOpenPositionsCount(trades: Trade[]): number {
  return trades.filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial').length;
}
