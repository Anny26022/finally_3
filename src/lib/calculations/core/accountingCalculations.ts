/**
 * Accounting Calculations Library
 * Centralized location for all accounting-method-aware calculations
 */

import { Trade } from '../../../types/trade';
import { calculateTradePL, getTradeDateForAccounting, getExitDatesWithFallback } from '../../../utils/accountingUtils';

/**
 * Group trades by month based on accounting method
 */
export function groupTradesByMonth(
  trades: Trade[],
  useCashBasis: boolean = false
): Record<string, Trade[]> {
  const groupedTrades: Record<string, Trade[]> = {};

  trades.forEach(trade => {
    if (useCashBasis) {
      // Cash basis: Group by exit dates
      if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
        const exits = getExitDatesWithFallback(trade);

        exits.forEach(exit => {
          const exitDate = new Date(exit.date);
          const monthKey = `${exitDate.toLocaleString('default', { month: 'short' })} ${exitDate.getFullYear()}`;

          if (!groupedTrades[monthKey]) {
            groupedTrades[monthKey] = [];
          }

          // Create a partial trade object for this exit
          const partialTrade: Trade = {
            ...trade,
            // Mark this as a partial exit for cash basis calculation
            _cashBasisExit: {
              date: exit.date,
              qty: exit.qty,
              price: exit.price
            }
          };

          groupedTrades[monthKey].push(partialTrade);
        });
      }
    } else {
      // Accrual basis: Group by trade initiation date
      if (trade.date) {
        const tradeDate = new Date(trade.date);
        const monthKey = `${tradeDate.toLocaleString('default', { month: 'short' })} ${tradeDate.getFullYear()}`;

        if (!groupedTrades[monthKey]) {
          groupedTrades[monthKey] = [];
        }

        groupedTrades[monthKey].push(trade);
      }
    }
  });

  return groupedTrades;
}

/**
 * Calculate P/L for a trade based on accounting method
 */
export function calcAccountingAwarePL(trade: Trade, useCashBasis: boolean = false): number {
  return calculateTradePL(trade, useCashBasis);
}

/**
 * Get the relevant date for a trade based on accounting method
 */
export function getAccountingAwareDate(trade: Trade, useCashBasis: boolean = false): string {
  return getTradeDateForAccounting(trade, useCashBasis);
}

/**
 * Expand trades for cash basis accounting (create separate entries for each exit)
 */
export function expandTradesForCashBasis(trades: Trade[]): Trade[] {
  const expandedTrades: Trade[] = [];

  trades.forEach(trade => {
    if (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial') {
      const exits = getExitDatesWithFallback(trade);
      
      exits.forEach((exit, index) => {
        const expandedTrade: Trade = {
          ...trade,
          id: `${trade.id}_exit_${index + 1}`,
          _cashBasisExit: {
            date: exit.date,
            qty: exit.qty,
            price: exit.price
          }
        };
        
        expandedTrades.push(expandedTrade);
      });
    } else {
      // For open positions, keep as-is
      expandedTrades.push(trade);
    }
  });

  return expandedTrades;
}

/**
 * Deduplicate trades for cash basis to avoid double counting in statistics
 */
export function deduplicateTradesForCashBasis(
  trades: Trade[],
  useCashBasis: boolean = false
): Trade[] {
  if (!useCashBasis) return trades;

  const seenTradeIds = new Set<string>();
  return trades.filter(trade => {
    const originalId = trade.id.split('_exit_')[0];
    if (seenTradeIds.has(originalId)) return false;
    seenTradeIds.add(originalId);
    return true;
  });
}

/**
 * Calculate total P/L for grouped cash basis trades
 */
export function calcGroupedCashBasisPL(trades: Trade[]): number {
  // Group by original trade ID
  const tradeGroups = new Map<string, Trade[]>();
  
  trades.forEach(trade => {
    const originalId = trade.id.split('_exit_')[0];
    if (!tradeGroups.has(originalId)) {
      tradeGroups.set(originalId, []);
    }
    tradeGroups.get(originalId)!.push(trade);
  });

  // Calculate total P/L for each original trade
  return Array.from(tradeGroups.values()).reduce((totalPL, tradeGroup) => {
    const groupPL = tradeGroup.reduce((sum, trade) => {
      return sum + calculateTradePL(trade, true);
    }, 0);
    return totalPL + groupPL;
  }, 0);
}

/**
 * Get trades with accounting-aware P/L calculations
 */
export function getTradesWithAccountingPL(
  trades: Trade[],
  useCashBasis: boolean = false
): Array<Trade & { accountingPL: number }> {


  if (useCashBasis) {
    // For cash basis: Get all expanded trades that have _cashBasisExit
    const realizedTradesFlat = trades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    );



    // Group by original ID and calculate total P/L per original trade
    const tradeGroups = new Map<string, Trade[]>();
    realizedTradesFlat.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (!tradeGroups.has(originalId)) {
        tradeGroups.set(originalId, []);
      }
      tradeGroups.get(originalId)!.push(trade);
    });

    // Calculate total P/L for each original trade
    return Array.from(tradeGroups.entries()).map(([originalId, trades]) => {
      // Sum up P/L from all exits for this trade
      const totalPL = trades.reduce((sum, trade) => {
        return sum + calculateTradePL(trade, useCashBasis);
      }, 0);

      // Use the first trade as the representative
      const representativeTrade = trades[0];

      // For cash basis: Calculate holding days from entry to LATEST exit date
      let cashBasisHoldingDays = representativeTrade.holdingDays || 0;

      if (trades.length > 0 && representativeTrade.date) {
        try {
          // Find the latest exit date among all exits
          const exitDates = trades
            .map(t => t._cashBasisExit?.date)
            .filter(Boolean) as string[];

          if (exitDates.length > 0) {
            const latestExitDate = exitDates.sort((a, b) =>
              new Date(b).getTime() - new Date(a).getTime()
            )[0];

            // Calculate days from entry to latest exit
            const entryDate = new Date(representativeTrade.date);
            const exitDate = new Date(latestExitDate);
            cashBasisHoldingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
            cashBasisHoldingDays = Math.max(0, cashBasisHoldingDays);
          }
        } catch (error) {
          // Keep original holdingDays as fallback
        }
      }

      return {
        ...representativeTrade,
        id: originalId,
        accountingPL: totalPL,
        holdingDays: cashBasisHoldingDays
      };
    });
  } else {
    // For accrual basis: Use only closed and partial trades (same filtering as Deep Analytics)
    const accrualTrades = trades
      .filter(trade => trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial')
      .map(trade => ({
        ...trade,
        accountingPL: calculateTradePL(trade, useCashBasis)
      }));



    return accrualTrades;
  }
}

/**
 * Calculate monthly P/L based on accounting method
 */
export function calcMonthlyPL(
  trades: Trade[],
  month: string,
  year: number,
  useCashBasis: boolean = false
): number {
  const monthlyTrades = trades.filter(trade => {
    const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
    const tradeDate = new Date(relevantDate);
    const tradeMonth = tradeDate.toLocaleString('default', { month: 'short' });
    const tradeYear = tradeDate.getFullYear();
    
    return tradeMonth === month && tradeYear === year;
  });

  return monthlyTrades.reduce((sum, trade) => {
    return sum + calculateTradePL(trade, useCashBasis);
  }, 0);
}

/**
 * Filter trades based on accounting method and date range
 */
export function filterTradesByDateRange(
  trades: Trade[],
  startDate: Date,
  endDate: Date,
  useCashBasis: boolean = false
): Trade[] {
  return trades.filter(trade => {
    const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
    const tradeDate = new Date(relevantDate);
    
    return tradeDate >= startDate && tradeDate <= endDate;
  });
}

/**
 * Calculate accounting-aware portfolio impact
 */
export function calcAccountingAwarePFImpact(
  trade: Trade,
  portfolioSize: number,
  useCashBasis: boolean = false
): number {
  if (portfolioSize <= 0) return 0;
  
  const accountingPL = calculateTradePL(trade, useCashBasis);
  return (accountingPL / portfolioSize) * 100;
}

/**
 * Get unique trading dates based on accounting method
 */
export function getUniqueTradingDates(
  trades: Trade[],
  useCashBasis: boolean = false
): Date[] {
  const dateSet = new Set<string>();
  
  trades.forEach(trade => {
    const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
    dateSet.add(relevantDate);
  });
  
  return Array.from(dateSet)
    .map(dateStr => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Calculate accounting-aware cumulative P/L over time
 */
export function calcCumulativePL(
  trades: Trade[],
  useCashBasis: boolean = false
): Array<{ date: string; cumulativePL: number }> {
  // Sort trades by accounting-aware date
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(getTradeDateForAccounting(a, useCashBasis));
    const dateB = new Date(getTradeDateForAccounting(b, useCashBasis));
    return dateA.getTime() - dateB.getTime();
  });

  let cumulativePL = 0;
  const result: Array<{ date: string; cumulativePL: number }> = [];

  sortedTrades.forEach(trade => {
    const tradePL = calculateTradePL(trade, useCashBasis);
    cumulativePL += tradePL;
    
    result.push({
      date: getTradeDateForAccounting(trade, useCashBasis),
      cumulativePL
    });
  });

  return result;
}
