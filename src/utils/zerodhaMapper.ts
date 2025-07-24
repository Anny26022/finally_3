import { Trade, BrokerImportMetadata, BuyTranche, SellTranche } from '../types/trade';
import { v4 as uuidv4 } from 'uuid';
import { mapStockName } from './stockNameMapper';
import { calcStockMovePercentage } from '../lib/calculations';

// Zerodha tradebook row interface
export interface ZerodhaTradeRow {
  symbol: string;
  isin: string;
  trade_date: string;
  exchange: string;
  segment: string;
  series: string;
  trade_type: 'buy' | 'sell';
  auction: boolean;
  quantity: number;
  price: number;
  trade_id: string;
  order_id: string;
  order_execution_time: string;
}

// Intermediate trade structure for processing
interface ProcessedTrade {
  symbol: string;
  buyTransactions: ZerodhaTradeRow[];
  sellTransactions: ZerodhaTradeRow[];
  totalBuyQty: number;
  totalSellQty: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  firstBuyDate: string;
  lastSellDate: string;
  isComplete: boolean;
}

// Parse Zerodha CSV data into structured format
export function parseZerodhaData(headers: string[], rows: any[]): ZerodhaTradeRow[] {
  const headerMap: { [key: string]: number } = {};
  
  // Map headers to indices (case-insensitive)
  headers.forEach((header, index) => {
    headerMap[header.toLowerCase().trim()] = index;
  });

  return rows.map(row => ({
    symbol: String(row[headerMap['symbol']] || '').trim(),
    isin: String(row[headerMap['isin']] || '').trim(),
    trade_date: String(row[headerMap['trade_date']] || '').trim(),
    exchange: String(row[headerMap['exchange']] || '').trim(),
    segment: String(row[headerMap['segment']] || '').trim(),
    series: String(row[headerMap['series']] || '').trim(),
    trade_type: String(row[headerMap['trade_type']] || '').toLowerCase().trim() as 'buy' | 'sell',
    auction: Boolean(row[headerMap['auction']]),
    quantity: parseFloat(row[headerMap['quantity']] || '0'),
    price: parseFloat(row[headerMap['price']] || '0'),
    trade_id: String(row[headerMap['trade_id']] || '').trim(),
    order_id: String(row[headerMap['order_id']] || '').trim(),
    order_execution_time: String(row[headerMap['order_execution_time']] || '').trim()
  })).filter(trade => trade.symbol && trade.quantity > 0 && trade.price > 0);
}

// Group transactions by symbol and detect separate trading cycles
export function groupZerodhaTransactions(transactions: ZerodhaTradeRow[]): ProcessedTrade[] {
  const symbolGroups: { [symbol: string]: ZerodhaTradeRow[] } = {};

  // Group by symbol
  transactions.forEach(transaction => {
    if (!symbolGroups[transaction.symbol]) {
      symbolGroups[transaction.symbol] = [];
    }
    symbolGroups[transaction.symbol].push(transaction);
  });

  const processedTrades: ProcessedTrade[] = [];

  // Process each symbol group to detect separate trading cycles
  Object.entries(symbolGroups).forEach(([symbol, symbolTransactions]) => {
    // Sort by date and time
    symbolTransactions.sort((a, b) =>
      new Date(a.order_execution_time).getTime() - new Date(b.order_execution_time).getTime()
    );

    // Detect separate trading cycles using running position tracking
    const tradingCycles = detectTradingCycles(symbolTransactions);

    // Process each trading cycle as a separate trade
    tradingCycles.forEach(cycle => {
      const buyTransactions = cycle.filter(t => t.trade_type === 'buy');
      const sellTransactions = cycle.filter(t => t.trade_type === 'sell');

      if (buyTransactions.length === 0) return; // Skip if no buy transactions

      const totalBuyQty = buyTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const totalSellQty = sellTransactions.reduce((sum, t) => sum + t.quantity, 0);

      const totalBuyValue = buyTransactions.reduce((sum, t) => sum + (t.quantity * t.price), 0);
      const totalSellValue = sellTransactions.reduce((sum, t) => sum + (t.quantity * t.price), 0);

      const avgBuyPrice = totalBuyValue / totalBuyQty;
      const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;

      const firstBuyDate = buyTransactions[0].trade_date;
      const lastSellDate = sellTransactions.length > 0 ?
        sellTransactions[sellTransactions.length - 1].trade_date : '';

      processedTrades.push({
        symbol,
        buyTransactions,
        sellTransactions,
        totalBuyQty,
        totalSellQty,
        avgBuyPrice,
        avgSellPrice,
        firstBuyDate,
        lastSellDate,
        isComplete: totalSellQty >= totalBuyQty
      });
    });
  });

  return processedTrades;
}

// Detect separate trading cycles by tracking running position
function detectTradingCycles(transactions: ZerodhaTradeRow[]): ZerodhaTradeRow[][] {
  const cycles: ZerodhaTradeRow[][] = [];
  let currentCycle: ZerodhaTradeRow[] = [];
  let runningPosition = 0;

  for (const transaction of transactions) {
    currentCycle.push(transaction);

    // Update running position
    if (transaction.trade_type === 'buy') {
      runningPosition += transaction.quantity;
    } else {
      runningPosition -= transaction.quantity;
    }

    // If position reaches zero, we've completed a trading cycle
    if (runningPosition === 0 && currentCycle.length > 0) {
      cycles.push([...currentCycle]);
      currentCycle = [];
    }
  }

  // If there's an incomplete cycle (open position), add it as well
  if (currentCycle.length > 0) {
    cycles.push(currentCycle);
  }

  return cycles;
}

// Handle multiple exits by consolidating into 3 exit slots
function consolidateExits(sellTransactions: ZerodhaTradeRow[]): {
  exit1: { price: number; qty: number; date: string } | null;
  exit2: { price: number; qty: number; date: string } | null;
  exit3: { price: number; qty: number; date: string } | null;
} {
  if (sellTransactions.length === 0) {
    return { exit1: null, exit2: null, exit3: null };
  }

  // Sort by execution time
  const sortedSells = [...sellTransactions].sort((a, b) => 
    new Date(a.order_execution_time).getTime() - new Date(b.order_execution_time).getTime()
  );

  if (sortedSells.length <= 3) {
    // Direct mapping for 3 or fewer exits
    return {
      exit1: sortedSells[0] ? {
        price: sortedSells[0].price,
        qty: sortedSells[0].quantity,
        date: sortedSells[0].trade_date
      } : null,
      exit2: sortedSells[1] ? {
        price: sortedSells[1].price,
        qty: sortedSells[1].quantity,
        date: sortedSells[1].trade_date
      } : null,
      exit3: sortedSells[2] ? {
        price: sortedSells[2].price,
        qty: sortedSells[2].quantity,
        date: sortedSells[2].trade_date
      } : null
    };
  }

  // For more than 3 exits, consolidate the last ones into exit3
  const exit1 = {
    price: sortedSells[0].price,
    qty: sortedSells[0].quantity,
    date: sortedSells[0].trade_date
  };

  const exit2 = {
    price: sortedSells[1].price,
    qty: sortedSells[1].quantity,
    date: sortedSells[1].trade_date
  };

  // Consolidate remaining exits into exit3
  const remainingExits = sortedSells.slice(2);
  const totalRemainingQty = remainingExits.reduce((sum, t) => sum + t.quantity, 0);
  const totalRemainingValue = remainingExits.reduce((sum, t) => sum + (t.quantity * t.price), 0);
  const avgRemainingPrice = totalRemainingValue / totalRemainingQty;
  const lastExitDate = remainingExits[remainingExits.length - 1].trade_date;

  const exit3 = {
    price: avgRemainingPrice,
    qty: totalRemainingQty,
    date: lastExitDate
  };

  return { exit1, exit2, exit3 };
}

// Transform processed trades into Nexus Trade format
export async function transformToNexusTrades(processedTrades: ProcessedTrade[]): Promise<Trade[]> {
  const trades: Trade[] = [];

  for (let index = 0; index < processedTrades.length; index++) {
    const processedTrade = processedTrades[index];
    const exits = consolidateExits(processedTrade.sellTransactions);
    
    // Calculate basic metrics
    const totalExitedQty = processedTrade.totalSellQty;
    const openQty = Math.max(0, processedTrade.totalBuyQty - totalExitedQty);
    const positionStatus: "Open" | "Closed" | "Partial" = 
      openQty === 0 ? "Closed" : 
      totalExitedQty === 0 ? "Open" : "Partial";

    // Calculate P&L for closed/partial positions (FIXED)
    const realisedAmount = totalExitedQty * processedTrade.avgSellPrice;
    const costBasis = totalExitedQty * processedTrade.avgBuyPrice;
    const realisedPL = realisedAmount - costBasis;

    // Calculate unrealized P&L for open positions using CMP
    const unrealisedPL = openQty > 0 ? (processedTrade.avgBuyPrice - processedTrade.avgBuyPrice) * openQty : 0; // Will be updated with CMP later

    // Total P&L = Realised + Unrealised
    const plRs = realisedPL + unrealisedPL;

    // Calculate holding days (FIXED)
    const entryDate = new Date(processedTrade.firstBuyDate);
    let holdingDays: number;

    if (positionStatus === "Closed") {
      // For closed positions, use last sell date
      const exitDate = new Date(processedTrade.lastSellDate);
      holdingDays = Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // For open/partial positions, use current date
      const currentDate = new Date();
      holdingDays = Math.ceil((currentDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Create broker import metadata for detailed breakup
    const buyTranches: BuyTranche[] = processedTrade.buyTransactions.map(t => ({
      quantity: t.quantity,
      price: t.price,
      date: t.trade_date,
      time: t.order_execution_time.split('T')[1] || '',
      tradeId: t.trade_id,
      orderId: t.order_id
    }));

    const sellTranches: SellTranche[] = processedTrade.sellTransactions.map(t => ({
      quantity: t.quantity,
      price: t.price,
      date: t.trade_date,
      time: t.order_execution_time.split('T')[1] || '',
      tradeId: t.trade_id,
      orderId: t.order_id
    }));

    const brokerMetadata: BrokerImportMetadata = {
      source: 'zerodha',
      buyTranches,
      sellTranches,
      originalTradeIds: [...processedTrade.buyTransactions, ...processedTrade.sellTransactions].map(t => t.trade_id),
      importedAt: new Date()
    };

    // FIXED: Use symbol instead of full company name for trade name
    // Keep the original broker symbol as the trade name for consistency
    const tradeSymbol = processedTrade.symbol;

    const trade: Trade = {
      id: uuidv4(),
      tradeNo: `${index + 1}`,
      date: processedTrade.firstBuyDate,
      name: tradeSymbol, // Use symbol instead of full company name
      entry: processedTrade.avgBuyPrice,
      avgEntry: processedTrade.avgBuyPrice,
      sl: 0, // Not available in Zerodha data
      tsl: 0, // Not available in Zerodha data
      buySell: "Buy" as const,
      cmp: (() => {
        // FIXED: Set CMP logic properly
        if (positionStatus === "Closed") {
          // For closed positions, use average sell price as final price
          return processedTrade.avgSellPrice;
        } else {
          // For open/partial positions, set to avgBuyPrice initially (will be updated with real CMP later)
          return processedTrade.avgBuyPrice;
        }
      })(),
      setup: "", // Leave empty for manual entry
      baseDuration: "", // Not available
      initialQty: processedTrade.totalBuyQty, // Consolidated quantity
      
      // Pyramid data (not available in Zerodha)
      pyramid1Price: 0,
      pyramid1Qty: 0,
      pyramid1Date: "",
      pyramid2Price: 0,
      pyramid2Qty: 0,
      pyramid2Date: "",
      
      // Position metrics
      positionSize: processedTrade.totalBuyQty * processedTrade.avgBuyPrice,
      allocation: 0, // Will be calculated based on portfolio size
      slPercent: 0, // Not available
      
      // Exit data
      exit1Price: exits.exit1?.price || 0,
      exit1Qty: exits.exit1?.qty || 0,
      exit1Date: exits.exit1?.date || "",
      exit2Price: exits.exit2?.price || 0,
      exit2Qty: exits.exit2?.qty || 0,
      exit2Date: exits.exit2?.date || "",
      exit3Price: exits.exit3?.price || 0,
      exit3Qty: exits.exit3?.qty || 0,
      exit3Date: exits.exit3?.date || "",
      
      // Calculated metrics
      openQty,
      exitedQty: totalExitedQty,
      avgExitPrice: processedTrade.avgSellPrice,
      stockMove: (() => {
        // Use centralized stock move calculation
        if (positionStatus === "Closed") {
          // For closed positions, use average sell price
          return calcStockMovePercentage(processedTrade.avgBuyPrice, processedTrade.avgSellPrice, "Buy");
        } else {
          // For open/partial positions, use CMP (will be set to avgBuyPrice initially, updated later with real CMP)
          const currentPrice = processedTrade.avgBuyPrice; // Placeholder - will be updated with CMP
          return calcStockMovePercentage(processedTrade.avgBuyPrice, currentPrice, "Buy");
        }
      })(),
      rewardRisk: 0, // Cannot calculate without SL
      holdingDays,
      positionStatus,
      realisedAmount,
      plRs,
      pfImpact: 0, // Will be calculated based on portfolio size
      cummPf: 0, // Will be calculated in sequence
      planFollowed: false, // Default
      exitTrigger: positionStatus === "Closed" ? "Manual Exit" : "",
      proficiencyGrowthAreas: "",
      openHeat: 0,
      notes: "", // Keep notes empty for clean import

      // Add broker import metadata for detailed breakup
      brokerImport: brokerMetadata
    };

    trades.push(trade);
  }

  return trades;
}

// Main function to convert Zerodha CSV to Nexus trades
export async function convertZerodhaToNexus(headers: string[], rows: any[]): Promise<Trade[]> {
  try {
    // Parse raw data
    const zerodhaTransactions = parseZerodhaData(headers, rows);
    
    if (zerodhaTransactions.length === 0) {
      throw new Error('No valid transactions found in Zerodha tradebook');
    }

    // Group transactions into trades
    const processedTrades = groupZerodhaTransactions(zerodhaTransactions);
    
    if (processedTrades.length === 0) {
      throw new Error('No valid trades could be constructed from the transactions');
    }

    // Sort trades by earliest date to ensure chronological trade numbering (1, 2, 3...)
    const sortedTrades = processedTrades.sort((a, b) => {
      const dateA = new Date(a.firstBuyDate).getTime();
      const dateB = new Date(b.firstBuyDate).getTime();
      return dateA - dateB; // Earliest date first
    });



    // Transform to Nexus format
    const nexusTrades = await transformToNexusTrades(sortedTrades);

    return nexusTrades;
  } catch (error) {
    console.error('Error converting Zerodha data to Nexus format:', error);
    throw error;
  }
}
