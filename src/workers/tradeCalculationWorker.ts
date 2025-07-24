/**
 * Trade Calculation Web Worker
 * 
 * PERFORMANCE BENEFITS:
 * - Offloads heavy calculations from main thread
 * - Prevents UI blocking during large dataset processing
 * - Enables parallel processing of trade calculations
 * - Maintains 60fps UI performance during calculations
 */

// Types for worker communication
interface TradeCalculationRequest {
  type: 'CALCULATE_TRADES' | 'FILTER_TRADES' | 'SORT_TRADES';
  payload: any;
  requestId: string;
}

interface TradeCalculationResponse {
  type: 'CALCULATION_COMPLETE' | 'FILTER_COMPLETE' | 'SORT_COMPLETE' | 'ERROR';
  payload: any;
  requestId: string;
}

// Import calculation functions (these would need to be available in worker context)
// For now, we'll implement simplified versions

// Simplified calculation functions for worker
const calcAvgEntry = (entries: Array<{ price: number; qty: number }>) => {
  const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
  const totalValue = entries.reduce((sum, e) => sum + (e.price * e.qty), 0);
  return totalQty > 0 ? totalValue / totalQty : 0;
};

const calcPositionSize = (avgEntry: number, totalQty: number) => {
  return avgEntry * totalQty;
};

const calcAllocation = (positionSize: number, portfolioSize: number) => {
  return portfolioSize > 0 ? (positionSize / portfolioSize) * 100 : 0;
};

const calcSLPercent = (sl: number, avgEntry: number) => {
  if (avgEntry === 0) return 0;
  return Math.abs((sl - avgEntry) / avgEntry) * 100;
};

const calcExitedQty = (exit1Qty: number, exit2Qty: number, exit3Qty: number) => {
  return (exit1Qty || 0) + (exit2Qty || 0) + (exit3Qty || 0);
};

const calcOpenQty = (initialQty: number, pyramid1Qty: number, pyramid2Qty: number, exitedQty: number) => {
  const totalQty = (initialQty || 0) + (pyramid1Qty || 0) + (pyramid2Qty || 0);
  return Math.max(0, totalQty - exitedQty);
};

const calcUnrealizedPL = (avgEntry: number, cmp: number, openQty: number, buySell: string) => {
  if (openQty === 0 || avgEntry === 0 || cmp === 0) return 0;
  
  if (buySell === 'Buy') {
    return (cmp - avgEntry) * openQty;
  } else {
    return (avgEntry - cmp) * openQty;
  }
};

// Main calculation function for a single trade
const calculateTradeMetrics = (trade: any, portfolioSize: number) => {
  try {
    // Entry calculations
    const entries = [
      { price: trade.entry || 0, qty: trade.initialQty || 0 },
      ...(trade.pyramid1Price && trade.pyramid1Qty ? [{ price: trade.pyramid1Price, qty: trade.pyramid1Qty }] : []),
      ...(trade.pyramid2Price && trade.pyramid2Qty ? [{ price: trade.pyramid2Price, qty: trade.pyramid2Qty }] : [])
    ].filter(e => e.price > 0 && e.qty > 0);

    if (entries.length === 0) {
      return {
        avgEntry: trade.entry || 0,
        positionSize: 0,
        allocation: 0,
        slPercent: 0,
        openQty: trade.initialQty || 0,
        exitedQty: 0,
        avgExitPrice: 0,
        unrealizedPL: 0
      };
    }

    const avgEntry = calcAvgEntry(entries);
    const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
    const positionSize = calcPositionSize(avgEntry, totalQty);
    const allocation = calcAllocation(positionSize, portfolioSize);
    const slPercent = calcSLPercent(trade.sl || trade.tsl || 0, avgEntry);
    const exitedQty = calcExitedQty(trade.exit1Qty || 0, trade.exit2Qty || 0, trade.exit3Qty || 0);
    const openQty = calcOpenQty(trade.initialQty || 0, trade.pyramid1Qty || 0, trade.pyramid2Qty || 0, exitedQty);

    const exits = [
      ...(trade.exit1Price && trade.exit1Qty ? [{ price: trade.exit1Price, qty: trade.exit1Qty }] : []),
      ...(trade.exit2Price && trade.exit2Qty ? [{ price: trade.exit2Price, qty: trade.exit2Qty }] : []),
      ...(trade.exit3Price && trade.exit3Qty ? [{ price: trade.exit3Price, qty: trade.exit3Qty }] : [])
    ].filter(e => e.price > 0 && e.qty > 0);

    const avgExitPrice = exits.length > 0 ? 
      exits.reduce((sum, e) => sum + (e.price * e.qty), 0) / exits.reduce((sum, e) => sum + e.qty, 0) : 0;
    
    const unrealizedPL = calcUnrealizedPL(avgEntry, trade.cmp || 0, openQty, trade.buySell);

    return {
      avgEntry,
      positionSize,
      allocation,
      slPercent,
      openQty,
      exitedQty,
      avgExitPrice,
      unrealizedPL
    };
  } catch (error) {
    console.error(`Error calculating metrics for trade ${trade.id}:`, error);
    return {
      avgEntry: trade.entry || 0,
      positionSize: 0,
      allocation: 0,
      slPercent: 0,
      openQty: trade.initialQty || 0,
      exitedQty: 0,
      avgExitPrice: 0,
      unrealizedPL: 0
    };
  }
};

// Filter trades based on search query and status
const filterTrades = (trades: any[], searchQuery: string, statusFilter: string) => {
  let filtered = trades;

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(trade => 
      trade.name?.toLowerCase().includes(query) ||
      trade.setup?.toLowerCase().includes(query) ||
      trade.tradeNo?.toString().includes(query) ||
      trade.notes?.toLowerCase().includes(query)
    );
  }

  // Apply status filter
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(trade => trade.positionStatus === statusFilter);
  }

  return filtered;
};

// Sort trades based on sort descriptor
const sortTrades = (trades: any[], sortDescriptor: any) => {
  if (!sortDescriptor || !sortDescriptor.column) {
    return trades;
  }

  const { column, direction } = sortDescriptor;
  
  return [...trades].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    // Handle different data types
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) {
      return direction === 'ascending' ? -1 : 1;
    }
    if (aVal > bVal) {
      return direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });
};

// Worker message handler
self.onmessage = function(e: MessageEvent<TradeCalculationRequest>) {
  const { type, payload, requestId } = e.data;

  try {
    switch (type) {
      case 'CALCULATE_TRADES': {
        const { trades, portfolioSize } = payload;
        
        // Calculate metrics for all trades
        const calculatedTrades = trades.map((trade: any) => ({
          ...trade,
          ...calculateTradeMetrics(trade, portfolioSize)
        }));

        const response: TradeCalculationResponse = {
          type: 'CALCULATION_COMPLETE',
          payload: calculatedTrades,
          requestId
        };
        
        self.postMessage(response);
        break;
      }

      case 'FILTER_TRADES': {
        const { trades, searchQuery, statusFilter } = payload;
        
        const filteredTrades = filterTrades(trades, searchQuery, statusFilter);

        const response: TradeCalculationResponse = {
          type: 'FILTER_COMPLETE',
          payload: filteredTrades,
          requestId
        };
        
        self.postMessage(response);
        break;
      }

      case 'SORT_TRADES': {
        const { trades, sortDescriptor } = payload;
        
        const sortedTrades = sortTrades(trades, sortDescriptor);

        const response: TradeCalculationResponse = {
          type: 'SORT_COMPLETE',
          payload: sortedTrades,
          requestId
        };
        
        self.postMessage(response);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const response: TradeCalculationResponse = {
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      requestId
    };
    
    self.postMessage(response);
  }
};

// Export types for TypeScript
export type { TradeCalculationRequest, TradeCalculationResponse };
