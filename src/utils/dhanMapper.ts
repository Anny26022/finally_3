import { Trade, BrokerImportMetadata, BuyTranche, SellTranche } from '../types/trade';
import { v4 as uuidv4 } from 'uuid';
import { mapStockName } from './stockNameMapper';
import { calcStockMovePercentage } from '../lib/calculations';

// Dhan tradebook row interface
export interface DhanTradeRow {
  name: string;           // Stock name (symbol)
  date: string;           // Trade date
  time: string;           // Trade time
  buySell: 'BUY' | 'SELL'; // Transaction type
  order: string;          // Order type (DELIVERY, etc.)
  exchange: string;       // NSE/BSE
  segment: string;        // Equity/F&O
  quantity: number;       // Quantity
  tradePrice: number;     // Price per share
  tradeValue: number;     // Total value
  status: string;         // Trade status
}

// Intermediate trade structure for processing
interface ProcessedTrade {
  symbol: string;
  buyTransactions: DhanTradeRow[];
  sellTransactions: DhanTradeRow[];
  totalBuyQty: number;
  totalSellQty: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  firstBuyDate: string;
  lastSellDate: string;
  isComplete: boolean;
}

// Parse Dhan CSV data into structured format
export function parseDhanData(headers: string[], rows: any[]): DhanTradeRow[] {
  const headerMap: { [key: string]: number } = {};

  // Map headers to indices with exact matching for Dhan format
  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().trim();
    headerMap[cleanHeader] = index;

    // Also create alternative mappings for common variations
    if (cleanHeader === 'buy/sell') {
      headerMap['buysell'] = index;
    }
    if (cleanHeader === 'quantity/lot') {
      headerMap['quantity'] = index;
      headerMap['quantitylot'] = index;
    }
    if (cleanHeader === 'trade price') {
      headerMap['tradeprice'] = index;
      headerMap['price'] = index;
    }
    if (cleanHeader === 'trade value') {
      headerMap['tradevalue'] = index;
      headerMap['value'] = index;
    }
  });



  return rows.map((row, rowIndex) => {
    const trade = {
      name: String(row[headerMap['name']] || '').trim(),
      date: String(row[headerMap['date']] || '').trim(),
      time: String(row[headerMap['time']] || '').trim(),
      buySell: String(row[headerMap['buysell']] || row[headerMap['buy/sell']] || '').toUpperCase().trim() as 'BUY' | 'SELL',
      order: String(row[headerMap['order']] || '').trim(),
      exchange: String(row[headerMap['exchange']] || '').trim(),
      segment: String(row[headerMap['segment']] || '').trim(),
      quantity: parseFloat(String(row[headerMap['quantity']] || row[headerMap['quantity/lot']] || '0').replace(/,/g, '')),
      tradePrice: parseFloat(String(row[headerMap['tradeprice']] || row[headerMap['trade price']] || '0').replace(/,/g, '')),
      tradeValue: parseFloat(String(row[headerMap['tradevalue']] || row[headerMap['trade value']] || '0').replace(/,/g, '')),
      status: String(row[headerMap['status']] || '').trim()
    };



    return trade;
  }).filter(trade => {
    const isValid = trade.name &&
                   trade.quantity > 0 &&
                   trade.tradePrice > 0 &&
                   trade.status === 'Traded' &&
                   (trade.buySell === 'BUY' || trade.buySell === 'SELL');



    return isValid;
  });
}

// Detect separate trading cycles using running position tracking
// Detect separate trading cycles by tracking running position (matches Zerodha logic)
function detectTradingCycles(transactions: DhanTradeRow[]): DhanTradeRow[][] {
  const cycles: DhanTradeRow[][] = [];
  let currentCycle: DhanTradeRow[] = [];
  let runningPosition = 0;

  for (const transaction of transactions) {
    currentCycle.push(transaction);

    // Update running position
    if (transaction.buySell === 'BUY') {
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

// Handle multiple exits by consolidating into 3 exit slots (matches Zerodha logic)
function consolidateExits(sellTransactions: DhanTradeRow[]): {
  exit1: { price: number; qty: number; date: string } | null;
  exit2: { price: number; qty: number; date: string } | null;
  exit3: { price: number; qty: number; date: string } | null;
} {
  if (sellTransactions.length === 0) {
    return { exit1: null, exit2: null, exit3: null };
  }

  // Sort sells by date
  const sortedSells = sellTransactions.sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const exit1 = {
    price: sortedSells[0].tradePrice,
    qty: sortedSells[0].quantity,
    date: sortedSells[0].date
  };

  if (sortedSells.length === 1) {
    return { exit1, exit2: null, exit3: null };
  }

  const exit2 = {
    price: sortedSells[1].tradePrice,
    qty: sortedSells[1].quantity,
    date: sortedSells[1].date
  };

  if (sortedSells.length === 2) {
    return { exit1, exit2, exit3: null };
  }

  // Consolidate remaining exits into exit3
  const remainingExits = sortedSells.slice(2);
  const totalRemainingQty = remainingExits.reduce((sum, t) => sum + t.quantity, 0);
  const totalRemainingValue = remainingExits.reduce((sum, t) => sum + (t.quantity * t.tradePrice), 0);
  const avgRemainingPrice = totalRemainingValue / totalRemainingQty;
  const lastExitDate = remainingExits[remainingExits.length - 1].date;

  const exit3 = {
    price: avgRemainingPrice,
    qty: totalRemainingQty,
    date: lastExitDate
  };

  return { exit1, exit2, exit3 };
}

// Group transactions by symbol and detect separate trading cycles
export function groupDhanTransactions(transactions: DhanTradeRow[]): ProcessedTrade[] {
  const symbolGroups: { [symbol: string]: DhanTradeRow[] } = {};

  // Group by symbol (stock name)
  transactions.forEach(transaction => {
    if (!symbolGroups[transaction.name]) {
      symbolGroups[transaction.name] = [];
    }
    symbolGroups[transaction.name].push(transaction);
  });

  const processedTrades: ProcessedTrade[] = [];
  const symbolEntries = Object.entries(symbolGroups);



  // PERFORMANCE OPTIMIZATION: Process symbols in batches to prevent blocking
  // Optimized for 500+ trades: Larger batches = faster processing
  const BATCH_SIZE = 25;
  for (let i = 0; i < symbolEntries.length; i += BATCH_SIZE) {
    const batch = symbolEntries.slice(i, i + BATCH_SIZE);

    batch.forEach(([symbol, symbolTransactions]) => {
      // Sort by date and time (chronological order is crucial for cycle detection)
      symbolTransactions.sort((a, b) => {
      // Handle different date formats and ensure proper parsing
      const parseDateTime = (date: string, time: string) => {
        try {
          // Try different date formats
          let dateStr = date;
          if (date.includes('/')) {
            // Convert DD/MM/YYYY to YYYY-MM-DD for better parsing
            const parts = date.split('/');
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
          return new Date(`${dateStr} ${time || '00:00:00'}`).getTime();
        } catch {
          return new Date(date).getTime() || 0;
        }
      };

      const dateTimeA = parseDateTime(a.date, a.time);
      const dateTimeB = parseDateTime(b.date, b.time);
      return dateTimeA - dateTimeB;
      });

      // Detect separate trading cycles using running position tracking
      const tradingCycles = detectTradingCycles(symbolTransactions);

      // Process each trading cycle as a separate trade
      tradingCycles.forEach(cycle => {
        const buyTransactions = cycle.filter(t => t.buySell === 'BUY');
        const sellTransactions = cycle.filter(t => t.buySell === 'SELL');

        if (buyTransactions.length === 0) return; // Skip if no buy transactions

        const totalBuyQty = buyTransactions.reduce((sum, t) => sum + t.quantity, 0);
        const totalSellQty = sellTransactions.reduce((sum, t) => sum + t.quantity, 0);

        const totalBuyValue = buyTransactions.reduce((sum, t) => sum + (t.quantity * t.tradePrice), 0);
        const totalSellValue = sellTransactions.reduce((sum, t) => sum + (t.quantity * t.tradePrice), 0);

        const avgBuyPrice = totalBuyValue / totalBuyQty;
        const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;

        // Get first buy date and last sell date
        const firstBuyDate = buyTransactions[0]?.date || '';
        const lastSellDate = sellTransactions.length > 0 ?
          sellTransactions[sellTransactions.length - 1]?.date || '' : '';

        const isComplete = totalSellQty >= totalBuyQty;



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
          isComplete
        });
      }); // Close tradingCycles.forEach
    }); // Close batch.forEach


  } // Close for loop


  return processedTrades;
}

// Transform processed trades into Nexus Trade format (matches Zerodha logic)
export async function convertDhanToTrades(processedTrades: ProcessedTrade[]): Promise<Trade[]> {
  const trades: Trade[] = [];



  // PERFORMANCE OPTIMIZATION: Process in batches to prevent blocking
  // Optimized for 500+ trades: Larger batches = significantly faster processing
  const BATCH_SIZE = 100;
  for (let batchStart = 0; batchStart < processedTrades.length; batchStart += BATCH_SIZE) {
    const batch = processedTrades.slice(batchStart, batchStart + BATCH_SIZE);

    for (let index = 0; index < batch.length; index++) {
      const processedTrade = batch[index];
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

      // CRITICAL FIX: Normalize date format for proper monthly performance calculation
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];

        try {
          // Handle DD/MM/YYYY format (common in Dhan exports)
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
          }
        }

        // Handle DD-MM-YYYY format
        if (dateStr.includes('-') && dateStr.length === 10) {
          const parts = dateStr.split('-');
          if (parts.length === 3 && parts[2].length === 4) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
          }
        }

        // If already in YYYY-MM-DD format or other valid format, validate and return
        const testDate = new Date(dateStr);
        if (!isNaN(testDate.getTime())) {
          return testDate.toISOString().split('T')[0];
        }

        // Fallback to current date
        return new Date().toISOString().split('T')[0];
      } catch (error) {
        return new Date().toISOString().split('T')[0];
      }
    };

    // FIXED: Use symbol instead of full company name for trade name
    // Keep the original broker symbol as the trade name for consistency
    const tradeSymbol = processedTrade.symbol;

    const trade: Trade = {
      id: uuidv4(),
      tradeNo: `${index + 1}`,
      date: normalizeDate(processedTrade.firstBuyDate), // FIXED: Normalize date format
      name: tradeSymbol, // Use symbol instead of full company name
      symbol: processedTrade.symbol, // For compatibility
      entry: processedTrade.avgBuyPrice,
      avgEntry: processedTrade.avgBuyPrice,
      sl: 0, // Not available in Dhan data
      tsl: 0, // Not available in Dhan data
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
      quantity: processedTrade.totalBuyQty, // For compatibility
      entryPrice: processedTrade.avgBuyPrice, // For compatibility

      // Pyramid data (not available in Dhan)
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

      // Exit data - FIXED: Normalize exit dates too
      exit1Price: exits.exit1?.price || 0,
      exit1Qty: exits.exit1?.qty || 0,
      exit1Date: exits.exit1?.date ? normalizeDate(exits.exit1.date) : "",
      exit2Price: exits.exit2?.price || 0,
      exit2Qty: exits.exit2?.qty || 0,
      exit2Date: exits.exit2?.date ? normalizeDate(exits.exit2.date) : "",
      exit3Price: exits.exit3?.price || 0,
      exit3Qty: exits.exit3?.qty || 0,
      exit3Date: exits.exit3?.date ? normalizeDate(exits.exit3.date) : "",


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
      status: positionStatus, // For compatibility
      realisedAmount,
      plRs,
      pfImpact: 0, // Will be calculated based on portfolio size
      cummPf: 0, // Will be calculated in sequence
      planFollowed: false, // Default
      exitTrigger: positionStatus === "Closed" ? "Manual Exit" : "",
      proficiencyGrowthAreas: "",
      growthAreas: "", // For compatibility
      openHeat: 0,
      notes: "", // Keep notes empty for clean import
      tags: [],
      chartImageUrl: '',
      isArchived: false,

      // Add broker import metadata for detailed breakup - FIXED: Normalize dates
      brokerImport: {
        source: 'dhan',
        buyTranches: processedTrade.buyTransactions.map(t => ({
          quantity: t.quantity,
          price: t.tradePrice,
          date: normalizeDate(t.date), // FIXED: Normalize date
          time: t.time || '',
          tradeId: `${t.name}-${normalizeDate(t.date)}-${t.time}`,
          orderId: `${t.name}-${normalizeDate(t.date)}`
        })),
        sellTranches: processedTrade.sellTransactions.map(t => ({
          quantity: t.quantity,
          price: t.tradePrice,
          date: normalizeDate(t.date), // FIXED: Normalize date
          time: t.time || '',
          tradeId: `${t.name}-${normalizeDate(t.date)}-${t.time}`,
          orderId: `${t.name}-${normalizeDate(t.date)}`
        })),
        originalTradeIds: [...processedTrade.buyTransactions, ...processedTrade.sellTransactions].map(t => `${t.name}-${normalizeDate(t.date)}-${t.time}`),
        importedAt: new Date()
      }
    };

      trades.push(trade);
    } // Close inner for loop


  } // Close outer for loop


  return trades;
}

// Main function to process Dhan CSV data
export async function processDhanCSV(headers: string[], rows: any[]): Promise<Trade[]> {
  const startTime = performance.now();


  // Parse raw CSV data
  const dhanTrades = parseDhanData(headers, rows);


  if (dhanTrades.length === 0) {
    return [];
  }

  // Group transactions into trading cycles
  const processedTrades = groupDhanTransactions(dhanTrades);


  if (processedTrades.length === 0) {
    return [];
  }

  // Sort trades by earliest date to ensure chronological trade numbering (1, 2, 3...)
  const sortedTrades = processedTrades.sort((a, b) => {
    const dateA = new Date(a.firstBuyDate).getTime();
    const dateB = new Date(b.firstBuyDate).getTime();
    return dateA - dateB; // Earliest date first
  });

  // Convert to Trade objects with performance tracking
  const conversionStart = performance.now();
  const trades = await convertDhanToTrades(sortedTrades);
  const conversionTime = performance.now() - conversionStart;

  const totalTime = performance.now() - startTime;


  return trades;
}

// Async version of parseDhanData with yielding for large datasets
async function parseDhanDataAsync(headers: string[], rows: any[], shouldYield: boolean): Promise<DhanTradeRow[]> {
  const headerMap: { [key: string]: number } = {};

  // Map headers to indices with exact matching for Dhan format
  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().trim();
    headerMap[cleanHeader] = index;

    // Also create alternative mappings for common variations
    if (cleanHeader === 'buy/sell') {
      headerMap['buysell'] = index;
    }
    if (cleanHeader === 'quantity/lot') {
      headerMap['quantity'] = index;
      headerMap['quantitylot'] = index;
    }
    if (cleanHeader === 'trade price') {
      headerMap['tradeprice'] = index;
      headerMap['price'] = index;
    }
    if (cleanHeader === 'trade value') {
      headerMap['tradevalue'] = index;
      headerMap['value'] = index;
    }
  });



  const result: DhanTradeRow[] = [];
  const CHUNK_SIZE = 100; // Process 100 rows at a time

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const rowIndex = i + j;

      const trade = {
        name: String(row[headerMap['name']] || '').trim(),
        date: String(row[headerMap['date']] || '').trim(),
        time: String(row[headerMap['time']] || '').trim(),
        buySell: String(row[headerMap['buysell']] || row[headerMap['buy/sell']] || '').toUpperCase().trim() as 'BUY' | 'SELL',
        order: String(row[headerMap['order']] || '').trim(),
        exchange: String(row[headerMap['exchange']] || '').trim(),
        segment: String(row[headerMap['segment']] || '').trim(),
        quantity: parseFloat(String(row[headerMap['quantity']] || row[headerMap['quantity/lot']] || '0').replace(/,/g, '')),
        tradePrice: parseFloat(String(row[headerMap['tradeprice']] || row[headerMap['trade price']] || '0').replace(/,/g, '')),
        tradeValue: parseFloat(String(row[headerMap['tradevalue']] || row[headerMap['trade value']] || '0').replace(/,/g, '')),
        status: String(row[headerMap['status']] || '').trim()
      };



      // Filter valid trades
      const isValid = trade.name &&
                     trade.quantity > 0 &&
                     trade.tradePrice > 0 &&
                     trade.status === 'Traded' &&
                     (trade.buySell === 'BUY' || trade.buySell === 'SELL');

      if (isValid) {
        result.push(trade);
      }
    }

    // Yield control every chunk if processing large dataset
    if (shouldYield && i % (CHUNK_SIZE * 5) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return result;
}

// Async version of groupDhanTransactions with yielding
async function groupDhanTransactionsAsync(transactions: DhanTradeRow[], shouldYield: boolean): Promise<ProcessedTrade[]> {
  const symbolGroups: { [symbol: string]: DhanTradeRow[] } = {};

  // Group by symbol (stock name)
  transactions.forEach(transaction => {
    if (!symbolGroups[transaction.name]) {
      symbolGroups[transaction.name] = [];
    }
    symbolGroups[transaction.name].push(transaction);
  });

  const processedTrades: ProcessedTrade[] = [];
  const symbols = Object.keys(symbolGroups);

  // Process each symbol group
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const symbolTransactions = symbolGroups[symbol];

    // Sort by date and time
    symbolTransactions.sort((a, b) => {
      const dateTimeA = new Date(`${a.date} ${a.time}`).getTime();
      const dateTimeB = new Date(`${b.date} ${b.time}`).getTime();
      return dateTimeA - dateTimeB;
    });

    // Detect separate trading cycles using running position tracking
    const tradingCycles = detectTradingCycles(symbolTransactions);

    // Process each trading cycle as a separate trade
    tradingCycles.forEach(cycle => {
      const buyTransactions = cycle.filter(t => t.buySell === 'BUY');
      const sellTransactions = cycle.filter(t => t.buySell === 'SELL');

      if (buyTransactions.length === 0) return; // Skip if no buy transactions

      const totalBuyQty = buyTransactions.reduce((sum, t) => sum + t.quantity, 0);
      const totalSellQty = sellTransactions.reduce((sum, t) => sum + t.quantity, 0);

      const totalBuyValue = buyTransactions.reduce((sum, t) => sum + (t.quantity * t.tradePrice), 0);
      const totalSellValue = sellTransactions.reduce((sum, t) => sum + (t.quantity * t.tradePrice), 0);

      const avgBuyPrice = totalBuyValue / totalBuyQty;
      const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;

      // Get first buy date and last sell date
      const firstBuyDate = buyTransactions[0]?.date || '';
      const lastSellDate = sellTransactions.length > 0 ?
        sellTransactions[sellTransactions.length - 1]?.date || '' : '';

      const isComplete = totalSellQty >= totalBuyQty;

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
        isComplete
      });
    });

    // Yield control every 10 symbols if processing large dataset
    if (shouldYield && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return processedTrades;
}

// Async version of convertDhanToTrades with yielding
async function convertDhanToTradesAsync(processedTrades: ProcessedTrade[], shouldYield: boolean): Promise<Trade[]> {


  const result: Trade[] = [];
  const CHUNK_SIZE = 50; // Process 50 trades at a time

  for (let i = 0; i < processedTrades.length; i += CHUNK_SIZE) {
    const chunk = processedTrades.slice(i, i + CHUNK_SIZE);

    for (let j = 0; j < chunk.length; j++) {
      const processed = chunk[j];
      const index = i + j;



      // CRITICAL FIX: Add date normalization function for async version too
      const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];

        try {
          // Handle DD/MM/YYYY format (common in Dhan exports)
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              return `${year}-${month}-${day}`;
            }
          }

          // Handle DD-MM-YYYY format
          if (dateStr.includes('-') && dateStr.length === 10) {
            const parts = dateStr.split('-');
            if (parts.length === 3 && parts[2].length === 4) {
              const day = parts[0].padStart(2, '0');
              const month = parts[1].padStart(2, '0');
              const year = parts[2];
              return `${year}-${month}-${day}`;
            }
          }

          // If already in YYYY-MM-DD format or other valid format, validate and return
          const testDate = new Date(dateStr);
          if (!isNaN(testDate.getTime())) {
            return testDate.toISOString().split('T')[0];
          }

          // Fallback to current date
          return new Date().toISOString().split('T')[0];
        } catch (error) {
          return new Date().toISOString().split('T')[0];
        }
      };

      const trade: Trade = {
        id: uuidv4(),
        symbol: processed.symbol,
        name: processed.symbol, // For preview table compatibility
        date: normalizeDate(processed.firstBuyDate), // FIXED: Normalize date
        quantity: processed.totalBuyQty,
        initialQty: processed.totalBuyQty, // For preview table compatibility
        entryPrice: processed.avgBuyPrice,
        entry: processed.avgBuyPrice, // For preview table compatibility
        avgEntry: processed.avgBuyPrice, // For preview table compatibility

        // Buy tranches
        buyTranche1: processed.buyTransactions[0] ? {
          date: processed.buyTransactions[0].date,
          quantity: processed.buyTransactions[0].quantity,
          price: processed.buyTransactions[0].tradePrice
        } : undefined,

        buyTranche2: processed.buyTransactions[1] ? {
          date: processed.buyTransactions[1].date,
          quantity: processed.buyTransactions[1].quantity,
          price: processed.buyTransactions[1].tradePrice
        } : undefined,

        buyTranche3: processed.buyTransactions[2] ? {
          date: processed.buyTransactions[2].date,
          quantity: processed.buyTransactions[2].quantity,
          price: processed.buyTransactions[2].tradePrice
        } : undefined,

        // Sell tranches (if any) - FIXED: Normalize exit dates
        exit1Date: processed.sellTransactions[0]?.date ? normalizeDate(processed.sellTransactions[0].date) : '',
        exit1Quantity: processed.sellTransactions[0]?.quantity || 0,
        exit1Price: processed.sellTransactions[0]?.tradePrice || 0,

        exit2Date: processed.sellTransactions[1]?.date ? normalizeDate(processed.sellTransactions[1].date) : '',
        exit2Quantity: processed.sellTransactions[1]?.quantity || 0,
        exit2Price: processed.sellTransactions[1]?.tradePrice || 0,

        exit3Date: processed.sellTransactions[2]?.date ? normalizeDate(processed.sellTransactions[2].date) : '',
        exit3Quantity: processed.sellTransactions[2]?.quantity || 0,
        exit3Price: processed.sellTransactions[2]?.tradePrice || 0,

        // Status
        status: processed.isComplete ? 'Closed' : 'Open',
        positionStatus: processed.isComplete ? 'Closed' : 'Open', // For preview table compatibility

        // Calculated fields for preview table
        positionSize: processed.totalBuyQty * processed.avgBuyPrice,
        allocation: 0, // Will be calculated by recalculateTradeFields

        // P/L calculation
        plRs: processed.isComplete ?
          (processed.totalSellQty * processed.avgSellPrice) - (processed.totalSellQty * processed.avgBuyPrice) : 0,
        plPercent: processed.isComplete ?
          (((processed.avgSellPrice - processed.avgBuyPrice) / processed.avgBuyPrice) * 100) : 0,

        // Broker metadata
        brokerImportMetadata: {
          broker: 'Dhan',
          importedAt: new Date().toISOString(),
          originalData: {
            buyTransactions: processed.buyTransactions,
            sellTransactions: processed.sellTransactions
          }
        } as BrokerImportMetadata,

        // Default values
        setup: '',
        exitTrigger: '',
        growthAreas: '',
        notes: '',
        tags: [],
        chartImageUrl: '',
        isArchived: false
      };



      result.push(trade);
    }

    // Yield control every chunk if processing large dataset
    if (shouldYield && i % CHUNK_SIZE === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return result;
}
