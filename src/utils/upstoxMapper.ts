import { Trade, BrokerImportMetadata, BuyTranche, SellTranche } from '../types/trade';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { mapStockName } from './stockNameMapper';
import { calcStockMovePercentage } from '../lib/calculations';

// Convert Excel date serial number to JavaScript Date
function excelDateToJSDate(excelDate: number): Date {
  // Excel epoch starts from January 1, 1900 (but Excel incorrectly treats 1900 as a leap year)
  // JavaScript Date epoch starts from January 1, 1970
  // Excel serial date 1 = January 1, 1900
  const excelEpoch = new Date(1900, 0, 1);
  const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
  return jsDate;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Upstox tradebook row interface
export interface UpstoxTradeRow {
  symbol: string;           // Stock symbol
  date: string;            // Trade date
  time: string;            // Trade time
  buySell: 'BUY' | 'SELL'; // Transaction type
  quantity: number;        // Quantity
  price: number;           // Price per share
  amount: number;          // Total amount
  exchange: string;        // Exchange (NSE/BSE)
  segment: string;         // Segment (EQ/FO)
  orderType: string;       // Order type
  tradeId: string;         // Trade ID
  orderId: string;         // Order ID
}

// Intermediate trade structure for processing
interface ProcessedTrade {
  symbol: string;
  buyTransactions: UpstoxTradeRow[];
  sellTransactions: UpstoxTradeRow[];
  totalBuyQty: number;
  totalSellQty: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  firstBuyDate: string;
  lastSellDate: string;
  isComplete: boolean;
}

// Parse Upstox Excel data into structured format
export function parseUpstoxData(worksheet: XLSX.WorkSheet): UpstoxTradeRow[] {
  // Convert worksheet to JSON
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  console.log('🔍 Raw Excel data length:', jsonData.length);
  console.log('🔍 First 10 rows of raw data:', jsonData.slice(0, 10));

  if (jsonData.length < 10) {
    throw new Error('Excel file appears to be empty or has insufficient data rows');
  }

  // Find the actual header row (typically row 9 in Upstox format)
  let headerRowIndex = -1;
  let headers: string[] = [];

  // Look for the row with trading headers
  for (let i = 0; i < Math.min(15, jsonData.length); i++) {
    const row = jsonData[i] as any[];
    if (row && row.length > 10) {
      const rowStr = row.join('|').toLowerCase();
      if (rowStr.includes('date') && rowStr.includes('company') && rowStr.includes('side') && rowStr.includes('quantity')) {
        headerRowIndex = i;
        headers = row.map(h => String(h || '').toLowerCase().trim());
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find valid header row in Upstox Excel file');
  }

  console.log('🔍 Found headers at row:', headerRowIndex);
  console.log('🔍 Upstox Excel Headers:', headers);
  console.log('🔍 Headers count:', headers.length);

  // Create header mapping based on actual Upstox format
  const headerMap: { [key: string]: number } = {};
  headers.forEach((header, index) => {
    headerMap[header] = index;

    // Map to standardized field names based on actual Upstox headers
    if (header === 'date') {
      headerMap['date'] = index;
    }
    if (header === 'company') {
      headerMap['symbol'] = index; // Company name is the symbol
    }
    if (header === 'trade time') {
      headerMap['time'] = index;
    }
    if (header === 'side') {
      headerMap['buysell'] = index;
    }
    if (header === 'quantity') {
      headerMap['quantity'] = index;
    }
    if (header === 'price') {
      headerMap['price'] = index;
    }
    if (header === 'amount') {
      headerMap['amount'] = index;
    }
    if (header === 'exchange') {
      headerMap['exchange'] = index;
    }
    if (header === 'segment') {
      headerMap['segment'] = index;
    }
    if (header === 'instrument type') {
      headerMap['ordertype'] = index;
    }
    if (header === 'trade num') {
      headerMap['tradeid'] = index;
    }
    if (header === 'scrip code') {
      headerMap['scripcode'] = index;
    }
  });

  console.log('🔍 Upstox Header mapping:', headerMap);

  // Process data rows (start from row after headers)
  const dataRows = jsonData.slice(headerRowIndex + 1);
  console.log('🔍 Data rows count:', dataRows.length);
  console.log('🔍 First 3 data rows:', dataRows.slice(0, 3));

  return dataRows.map((row: any[], rowIndex) => {
    // Debug raw row data for first few rows
    if (rowIndex < 3) {
      console.log(`🔍 Raw row ${rowIndex + 1}:`, row);
      console.log(`🔍 Row length: ${row.length}, Headers length: ${headers.length}`);
    }

    // Parse Excel date (serial number) to proper date
    let dateStr = '';
    const rawDate = row[headerMap['date']];
    if (typeof rawDate === 'number') {
      // Excel serial date number
      const jsDate = excelDateToJSDate(rawDate);
      dateStr = formatDate(jsDate);
    } else {
      // String date - try to parse
      dateStr = String(rawDate || '').trim();
    }

    // Parse buy/sell side
    const rawSide = String(row[headerMap['buysell']] || '').toUpperCase().trim();
    const buySell = rawSide === 'BUY' ? 'BUY' : rawSide === 'SELL' ? 'SELL' : rawSide as 'BUY' | 'SELL';

    const trade = {
      symbol: String(row[headerMap['symbol']] || '').trim(),
      date: dateStr,
      time: String(row[headerMap['time']] || '').trim(),
      buySell: buySell,
      quantity: parseFloat(String(row[headerMap['quantity']] || '0').replace(/,/g, '')),
      price: parseFloat(String(row[headerMap['price']] || '0').replace(/,/g, '')),
      amount: parseFloat(String(row[headerMap['amount']] || '0').replace(/,/g, '')),
      exchange: String(row[headerMap['exchange']] || '').trim(),
      segment: String(row[headerMap['segment']] || 'EQ').trim(),
      orderType: String(row[headerMap['ordertype']] || '').trim(),
      tradeId: String(row[headerMap['tradeid']] || `UPSTOX-${rowIndex + 1}`).trim(),
      orderId: String(row[headerMap['scripcode']] || `ORDER-${rowIndex + 1}`).trim() // Use scrip code as order ID
    };

    // Debug first few trades
    if (rowIndex < 3) {
      console.log(`🔍 Parsed Upstox trade ${rowIndex + 1}:`, trade);
      console.log(`🔍 Raw date value: ${rawDate} -> ${dateStr}`);
      console.log(`🔍 Header mappings used:`, {
        symbol: `row[${headerMap['symbol']}] = ${row[headerMap['symbol']]}`,
        date: `row[${headerMap['date']}] = ${row[headerMap['date']]}`,
        buySell: `row[${headerMap['buysell']}] = ${row[headerMap['buysell']]}`,
        quantity: `row[${headerMap['quantity']}] = ${row[headerMap['quantity']]}`,
        price: `row[${headerMap['price']}] = ${row[headerMap['price']]}`
      });
    }

    return trade;
  }).filter(trade => {
    // Filter valid trades
    const isValid = trade.symbol &&
                   trade.quantity > 0 &&
                   trade.price > 0 &&
                   (trade.buySell === 'BUY' || trade.buySell === 'SELL');

    if (!isValid) {
      console.log('🚫 Filtered out invalid Upstox trade:', trade);
    }

    return isValid;
  });
}

// Detect separate trading cycles using running position tracking
function detectTradingCycles(transactions: UpstoxTradeRow[]): UpstoxTradeRow[][] {
  const cycles: UpstoxTradeRow[][] = [];
  let currentCycle: UpstoxTradeRow[] = [];
  let runningPosition = 0;

  for (const transaction of transactions) {
    currentCycle.push(transaction);

    // Update running position
    if (transaction.buySell === 'BUY') {
      runningPosition += transaction.quantity;
    } else {
      runningPosition -= transaction.quantity;
    }

    // If position reaches zero, complete the cycle
    if (runningPosition === 0 && currentCycle.length > 0) {
      cycles.push([...currentCycle]);
      currentCycle = [];
    }
  }

  // Add any remaining incomplete cycle
  if (currentCycle.length > 0) {
    cycles.push(currentCycle);
  }

  return cycles;
}

// Handle multiple exits by consolidating into 3 exit slots
function consolidateExits(sellTransactions: UpstoxTradeRow[]): {
  exit1: { price: number; qty: number; date: string } | null;
  exit2: { price: number; qty: number; date: string } | null;
  exit3: { price: number; qty: number; date: string } | null;
} {
  if (sellTransactions.length === 0) {
    return { exit1: null, exit2: null, exit3: null };
  }

  // Sort sells by date and time
  const sortedSells = sellTransactions.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`).getTime();
    const dateB = new Date(`${b.date} ${b.time}`).getTime();
    return dateA - dateB;
  });

  const exit1 = {
    price: sortedSells[0].price,
    qty: sortedSells[0].quantity,
    date: sortedSells[0].date
  };

  if (sortedSells.length === 1) {
    return { exit1, exit2: null, exit3: null };
  }

  const exit2 = {
    price: sortedSells[1].price,
    qty: sortedSells[1].quantity,
    date: sortedSells[1].date
  };

  if (sortedSells.length === 2) {
    return { exit1, exit2, exit3: null };
  }

  // Consolidate remaining exits into exit3
  const remainingExits = sortedSells.slice(2);
  const totalRemainingQty = remainingExits.reduce((sum, t) => sum + t.quantity, 0);
  const totalRemainingValue = remainingExits.reduce((sum, t) => sum + (t.quantity * t.price), 0);
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
export function groupUpstoxTransactions(transactions: UpstoxTradeRow[]): ProcessedTrade[] {
  const symbolGroups: { [symbol: string]: UpstoxTradeRow[] } = {};
  
  // Group by symbol
  transactions.forEach(transaction => {
    if (!symbolGroups[transaction.symbol]) {
      symbolGroups[transaction.symbol] = [];
    }
    symbolGroups[transaction.symbol].push(transaction);
  });

  const processedTrades: ProcessedTrade[] = [];

  // Process each symbol group
  Object.entries(symbolGroups).forEach(([symbol, symbolTransactions]) => {
    // Sort transactions by date and time
    symbolTransactions.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return dateA - dateB;
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

      const totalBuyValue = buyTransactions.reduce((sum, t) => sum + (t.quantity * t.price), 0);
      const totalSellValue = sellTransactions.reduce((sum, t) => sum + (t.quantity * t.price), 0);

      const avgBuyPrice = totalBuyValue / totalBuyQty;
      const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0;

      // Get first buy date and last sell date
      const firstBuyDate = buyTransactions[0]?.date || '';
      const lastSellDate = sellTransactions.length > 0 ? 
        sellTransactions[sellTransactions.length - 1]?.date || '' : '';

      const isComplete = totalSellQty >= totalBuyQty;

      // Debug logging for first few trades
      if (processedTrades.length < 5) {
        console.log(`🔍 Processing Upstox cycle for ${symbol}:`, {
          buyTransactions: buyTransactions.length,
          sellTransactions: sellTransactions.length,
          totalBuyQty,
          totalSellQty,
          isComplete,
          cycle: cycle.map(t => `${t.buySell} ${t.quantity} @ ${t.price}`)
        });
      }

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
  });

  return processedTrades;
}

// Normalize date format to YYYY-MM-DD
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';

  try {
    // Handle various date formats that Upstox might use
    let date: Date;

    // Try parsing as-is first
    date = new Date(dateStr);

    // If invalid, try common Indian date formats
    if (isNaN(date.getTime())) {
      // Try DD-MM-YYYY or DD/MM/YYYY format
      const parts = dateStr.split(/[-\/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Month is 0-indexed
        const year = parseInt(parts[2]);
        date = new Date(year, month, day);
      }
    }

    if (isNaN(date.getTime())) {
      console.warn('Could not parse date:', dateStr);
      return dateStr; // Return original if parsing fails
    }

    // Format as YYYY-MM-DD
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.warn('Date parsing error:', error);
    return dateStr;
  }
}

// Transform processed trades into Nexus Trade format
export async function convertUpstoxToTrades(processedTrades: ProcessedTrade[]): Promise<Trade[]> {
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

    // Calculate P&L for closed/partial positions
    const realisedAmount = totalExitedQty * processedTrade.avgSellPrice;
    const costBasis = totalExitedQty * processedTrade.avgBuyPrice;
    const realisedPL = realisedAmount - costBasis;

    // Calculate unrealized P&L for open positions using CMP
    const unrealisedPL = openQty > 0 ? (processedTrade.avgBuyPrice - processedTrade.avgBuyPrice) * openQty : 0; // Will be updated with CMP later

    // Total P&L = Realised + Unrealised
    const plRs = realisedPL + unrealisedPL;

    // Calculate holding days
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
      date: normalizeDate(t.date),
      time: t.time || '',
      tradeId: t.tradeId,
      orderId: t.orderId
    }));

    const sellTranches: SellTranche[] = processedTrade.sellTransactions.map(t => ({
      quantity: t.quantity,
      price: t.price,
      date: normalizeDate(t.date),
      time: t.time || '',
      tradeId: t.tradeId,
      orderId: t.orderId
    }));

    const brokerMetadata: BrokerImportMetadata = {
      source: 'upstox',
      buyTranches,
      sellTranches,
      originalTradeIds: [...processedTrade.buyTransactions, ...processedTrade.sellTransactions].map(t => t.tradeId),
      importedAt: new Date()
    };

    // FIXED: Use symbol instead of full company name for trade name
    // Keep the original broker symbol as the trade name for consistency
    const tradeSymbol = processedTrade.symbol;

    const trade: Trade = {
      id: uuidv4(),
      tradeNo: `${index + 1}`,
      date: normalizeDate(processedTrade.firstBuyDate),
      name: tradeSymbol, // Use symbol instead of full company name
      symbol: processedTrade.symbol,
      entry: processedTrade.avgBuyPrice,
      avgEntry: processedTrade.avgBuyPrice,
      sl: 0, // Not available in Upstox data
      tsl: 0, // Not available in Upstox data
      buySell: "Buy" as const,
      cmp: (() => {
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
      initialQty: processedTrade.totalBuyQty,
      quantity: processedTrade.totalBuyQty,
      entryPrice: processedTrade.avgBuyPrice,

      // Pyramid data (not available in Upstox)
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
      realisedAmount,
      plRs,
      pfImpact: 0, // Will be calculated based on portfolio size
      cummPf: 0, // Will be calculated in sequence
      planFollowed: false, // Default
      exitTrigger: positionStatus === "Closed" ? "Manual Exit" : "",
      proficiencyGrowthAreas: "",
      growthAreas: "",
      openHeat: 0,
      notes: "", // Keep notes empty for clean import
      tags: [],
      chartImageUrl: "",
      isArchived: false,

      // Add broker import metadata for detailed breakup
      brokerImport: brokerMetadata
    };

    trades.push(trade);
  }

  return trades;
}

// Main function to process Upstox Excel file
export function processUpstoxExcel(file: File): Promise<Trade[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          throw new Error('No worksheet found in Excel file');
        }

        console.log('🔍 Processing Upstox Excel file...');

        // Parse Upstox data
        const upstoxTransactions = parseUpstoxData(worksheet);

        if (upstoxTransactions.length === 0) {
          throw new Error('No valid transactions found in Upstox Excel file');
        }

        console.log(`✅ Parsed ${upstoxTransactions.length} Upstox transactions`);

        // Group transactions into trades
        const processedTrades = groupUpstoxTransactions(upstoxTransactions);

        if (processedTrades.length === 0) {
          throw new Error('No valid trades could be constructed from the transactions');
        }

        console.log(`✅ Grouped into ${processedTrades.length} trades`);

        // Sort trades by earliest date to ensure chronological trade numbering (1, 2, 3...)
        const sortedTrades = processedTrades.sort((a, b) => {
          const dateA = new Date(a.firstBuyDate).getTime();
          const dateB = new Date(b.firstBuyDate).getTime();
          return dateA - dateB; // Earliest date first
        });

        // Convert to Nexus format
        const nexusTrades = await convertUpstoxToTrades(sortedTrades);

        resolve(nexusTrades);
      } catch (error) {
        console.error('❌ Error processing Upstox Excel file:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
