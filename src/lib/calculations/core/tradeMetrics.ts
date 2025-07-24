/**
 * Core Trade Metrics Calculation Library
 * Centralized location for all trade-level calculations
 */

import { Trade } from '../../../types/trade';
import { calcAllocationPercentage, calcPercentageChange, calcStockMovePercentage } from '../utils/mathUtils';

/**
 * Calculate average entry price from multiple entry lots
 */
export function calcAvgEntry(entries: { price: number; qty: number }[]): number {
  const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
  const totalValue = entries.reduce((sum, e) => sum + e.price * e.qty, 0);
  return totalQty ? totalValue / totalQty : 0;
}

/**
 * Calculate position size (entry price * quantity)
 */
export function calcPositionSize(avgEntry: number, totalQty: number): number {
  return Math.round(avgEntry * totalQty);
}

/**
 * Calculate portfolio allocation percentage
 * @deprecated Use calcAllocationPercentage from mathUtils instead
 */
export function calcAllocation(positionSize: number, portfolioSize: number): number {
  return calcAllocationPercentage(positionSize, portfolioSize);
}

/**
 * Calculate stop loss percentage
 */
export function calcSLPercent(sl: number, entry: number): number {
  if (!entry || !sl) return 0;
  return Math.abs(calcPercentageChange(entry, sl));
}

/**
 * Calculate open quantity (total - exited)
 */
export function calcOpenQty(initialQty: number, p1Qty: number, p2Qty: number, exitedQty: number): number {
  return initialQty + p1Qty + p2Qty - exitedQty;
}

/**
 * Calculate total exited quantity
 */
export function calcExitedQty(...exitQtys: number[]): number {
  return exitQtys.reduce((sum, qty) => sum + qty, 0);
}

/**
 * Calculate average exit price from multiple exits
 */
export function calcAvgExitPrice(exits: { price: number; qty: number }[]): number {
  const totalQty = exits.reduce((sum, e) => sum + e.qty, 0);
  const totalValue = exits.reduce((sum, e) => sum + e.price * e.qty, 0);
  return totalQty ? totalValue / totalQty : 0;
}

/**
 * Calculate stock movement percentage
 */
export function calcStockMove(
  avgEntry: number,
  avgExit: number,
  cmp: number,
  openQty: number,
  exitedQty: number,
  positionStatus: 'Open' | 'Closed' | 'Partial',
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  // Edge case handling
  if (!avgEntry || avgEntry <= 0) return 0;
  if (typeof openQty !== 'number' || typeof exitedQty !== 'number') return 0;
  if (openQty < 0 || exitedQty < 0) return 0;

  const totalQty = openQty + exitedQty;
  if (totalQty === 0) return 0;

  if (!['Open', 'Closed', 'Partial'].includes(positionStatus)) return 0;

  let movePercentage = 0;

  if (positionStatus === 'Closed') {
    // For closed positions, use average exit price
    if (!avgExit || avgExit <= 0) return 0;
    movePercentage = buySell === 'Buy' 
      ? ((avgExit - avgEntry) / avgEntry) * 100
      : ((avgEntry - avgExit) / avgEntry) * 100;
  } else if (positionStatus === 'Open') {
    // For open positions, use current market price
    if (!cmp || cmp <= 0) return 0;
    movePercentage = buySell === 'Buy'
      ? ((cmp - avgEntry) / avgEntry) * 100
      : ((avgEntry - cmp) / avgEntry) * 100;
  } else if (positionStatus === 'Partial') {
    // For partial positions, calculate weighted average
    let totalMove = 0;
    
    if (exitedQty > 0 && avgExit > 0) {
      const exitedMove = buySell === 'Buy'
        ? ((avgExit - avgEntry) / avgEntry) * 100
        : ((avgEntry - avgExit) / avgEntry) * 100;
      totalMove += exitedMove * exitedQty;
    }
    
    if (openQty > 0 && cmp > 0) {
      const openMove = buySell === 'Buy'
        ? ((cmp - avgEntry) / avgEntry) * 100
        : ((avgEntry - cmp) / avgEntry) * 100;
      totalMove += openMove * openQty;
    }
    
    movePercentage = totalMove / totalQty;
  }

  return movePercentage;
}

/**
 * Calculate realized amount (exited quantity * average exit price)
 */
export function calcRealisedAmount(exitedQty: number, avgExit: number): number {
  return exitedQty * avgExit;
}

/**
 * Calculate P&L in rupees
 */
export function calcPLRs(realisedAmount: number, positionSize: number): number {
  return realisedAmount - positionSize;
}

/**
 * Calculate portfolio impact percentage
 */
export function calcPFImpact(plRs: number, portfolioValue: number): number {
  return portfolioValue ? (plRs / portfolioValue) * 100 : 0;
}

/**
 * Calculate cumulative portfolio performance
 */
export function calcCummPf(pfImpacts: number[]): number {
  return pfImpacts.reduce((sum, pf) => sum + pf, 0);
}

/**
 * Calculate unrealized P&L for open positions
 */
export function calcUnrealizedPL(avgEntry: number, cmp: number, openQty: number, buySell: 'Buy' | 'Sell' = 'Buy'): number {
  if (!avgEntry || !cmp || !openQty) return 0;
  
  return buySell === 'Buy'
    ? (cmp - avgEntry) * openQty
    : (avgEntry - cmp) * openQty;
}

/**
 * Calculate individual entry moves for tooltip display
 */
export function calcIndividualMoves(
  entries: { price: number; qty: number; description?: string }[],
  cmp: number,
  avgExit: number,
  positionStatus: 'Open' | 'Closed' | 'Partial',
  buySell: 'Buy' | 'Sell' = 'Buy'
): Array<{
  entryPrice: number;
  qty: number;
  movePercent: number;
  description: string;
}> {
  const validEntries = entries.filter(e => e.price > 0 && e.qty > 0);
  
  return validEntries.map(entry => {
    let referencePrice: number;
    
    if (positionStatus === 'Closed') {
      referencePrice = avgExit;
    } else {
      referencePrice = cmp;
    }
    
    // Use centralized stock move calculation
    const movePercent = calcStockMovePercentage(entry.price, referencePrice, buySell);
    
    return {
      entryPrice: entry.price,
      qty: entry.qty,
      movePercent,
      description: entry.description || 'Entry'
    };
  });
}

/**
 * Calculate FIFO-based realized P&L
 */
export function calcRealizedPL_FIFO(
  entryLots: { price: number; qty: number }[],
  exitLots: { price: number; qty: number }[],
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  if (!entryLots.length || !exitLots.length) return 0;
  
  // Create working copies
  const entries = entryLots.map(lot => ({ ...lot }));
  const exits = [...exitLots];
  
  let totalPL = 0;
  
  for (const exit of exits) {
    let remainingExitQty = exit.qty;
    
    while (remainingExitQty > 0 && entries.length > 0) {
      const lot = entries[0];
      const qtyToUse = Math.min(lot.qty, remainingExitQty);
      
      if (buySell === 'Buy') {
        totalPL += qtyToUse * (exit.price - lot.price);
      } else {
        totalPL += qtyToUse * (lot.price - exit.price);
      }
      
      lot.qty -= qtyToUse;
      remainingExitQty -= qtyToUse;
      
      if (lot.qty === 0) entries.shift();
    }
  }
  
  return totalPL;
}

/**
 * Calculate risk-reward ratio for a trade
 */
export function calcRewardRisk(
  currentPrice: number,
  entryPrice: number,
  stopLoss: number,
  positionStatus: 'Open' | 'Closed' | 'Partial',
  avgExitPrice: number,
  openQty: number,
  exitedQty: number,
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  if (!entryPrice || !stopLoss) return 0;
  
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return Infinity;
  
  let reward: number;
  
  if (positionStatus === 'Closed') {
    reward = Math.abs(avgExitPrice - entryPrice);
  } else {
    reward = Math.abs(currentPrice - entryPrice);
  }
  
  const rrRatio = reward / risk;
  
  // Return signed R:R ratio (negative for losses, positive for gains)
  if (positionStatus === 'Closed') {
    const isProfit = buySell === 'Buy' 
      ? avgExitPrice > entryPrice 
      : avgExitPrice < entryPrice;
    return isProfit ? rrRatio : -rrRatio;
  } else {
    const isProfit = buySell === 'Buy'
      ? currentPrice > entryPrice
      : currentPrice < entryPrice;
    return isProfit ? rrRatio : -rrRatio;
  }
}

/**
 * Calculate the weighted average Reward:Risk (R:R) for a trade, using per-entry breakdown and TSL/SL logic.
 * This matches the logic in trade-journal.tsx for consistency across analytics.
 */
export function calcWeightedRewardRisk(trade: any): number {
  const entry = Number(trade.entry);
  const sl = Number(trade.sl);
  const tsl = Number(trade.tsl);
  const cmp = Number(trade.cmp);
  const avgExit = Number(trade.avgExitPrice);
  const buySell = trade.buySell;
  const positionStatus = trade.positionStatus;
  const exitedQty = Number(trade.exitedQty);
  const openQty = Number(trade.openQty);

  // Gather all entry lots
  const entries = [
    { label: 'Initial Entry', price: Number(trade.entry), qty: Number(trade.initialQty) },
    { label: 'Pyramid 1', price: Number(trade.pyramid1Price), qty: Number(trade.pyramid1Qty) },
    { label: 'Pyramid 2', price: Number(trade.pyramid2Price), qty: Number(trade.pyramid2Qty) }
  ].filter(e => e.price > 0 && e.qty > 0);

  const totalQtyAll = entries.reduce((sum, e) => sum + (e.qty || 0), 0);

  const entryBreakdown = entries.map(e => {
    // For initial entry, always use SL; for pyramids, use TSL if set and > 0, otherwise SL
    let stop;
    if (e.label === 'Initial Entry') {
      stop = sl;
    } else {
      stop = tsl > 0 ? tsl : sl;
    }

    const rawRisk = e.price - stop; // For Buy
    const risk = Math.abs(rawRisk); // For R:R calculation
    let reward = 0;

    if (positionStatus === 'Open') {
      reward = buySell === 'Buy' ? cmp - e.price : e.price - cmp;
    } else if (positionStatus === 'Closed') {
      reward = buySell === 'Buy' ? avgExit - e.price : e.price - avgExit;
    } else if (positionStatus === 'Partial') {
      const realizedReward = buySell === 'Buy' ? avgExit - e.price : e.price - avgExit;
      const potentialReward = buySell === 'Buy' ? cmp - e.price : e.price - cmp;
      reward = totalQtyAll > 0 ? ((realizedReward * exitedQty + potentialReward * openQty) / totalQtyAll) : 0;
    }

    // Return signed R:R ratio (negative for losses, positive for gains)
    const rrValue = risk !== 0 ? (reward / risk) : 0;
    return {
      rrValue,
      qty: e.qty
    };
  });

  const weightedRR = totalQtyAll > 0
    ? entryBreakdown.reduce((sum, e) => sum + (e.rrValue * (e.qty || 0)), 0) / totalQtyAll
    : 0;

  return weightedRR;
}

/**
 * Determine if a position is risky or risk-free
 * Risky: Has only SL or TSL is not better than SL (but TSL is still the effective stop)
 * Risk-free: Has TSL that is better than SL (TSL > SL for Buy, TSL < SL for Sell)
 */
export function isRiskyPosition(trade: any): boolean {
  const sl = trade.sl || 0;
  const tsl = trade.tsl || 0;
  const buySell = trade.buySell || 'Buy';

  // No stop protection at all - considered risky
  if (sl === 0 && tsl === 0) return true;

  // Only SL, no TSL - risky
  if (sl > 0 && tsl === 0) return true;

  // Only TSL, no SL - risk-free (TSL provides protection)
  if (sl === 0 && tsl > 0) return false;

  // Both SL and TSL present - check if TSL provides better protection than SL
  // Note: TSL is always the effective stop, but risk assessment is based on protection level
  if (sl > 0 && tsl > 0) {
    if (buySell === 'Buy') {
      // For Buy positions: TSL should be higher than SL to be protective
      return tsl <= sl; // Risky if TSL doesn't provide better protection
    } else {
      // For Sell positions: TSL should be lower than SL to be protective
      return tsl >= sl; // Risky if TSL doesn't provide better protection
    }
  }

  return true; // Default to risky
}
