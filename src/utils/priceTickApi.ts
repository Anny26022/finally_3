import { format, subDays, parseISO, isWeekend, isFriday, isSameDay } from 'date-fns';

export interface PriceTick {
  dateTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  dayVolume: number;
}

export interface PriceTicksResponse {
  data: {
    statistic: number;
    count: number;
    fields: string[];
    ticks: {
      [symbol: string]: Array<[string, number, number, number, number, number, number]>;
    };
  };
}

// Specific symbols that should always use 1d timeframe
const SYMBOLS_REQUIRING_1D_TIMEFRAME = [
  'GLOBECIVIL', 'RAYMONDREL', 'KALPATARU', 'ARISINFRA', 'ABLBL',
  'OSWALPUMPS', 'ENRIN', 'BLUSPRING', 'DIGITIDE', 'SCODATUBES',
  'PROSTARM', 'AEGISVOPAK', 'THELEELA', 'BELRISE', 'BORANA'
];

// Index symbols that require special URL construction with :INDEX suffix
const INDEX_SYMBOLS = [
  'CNXMNC', 'CNXFMCG', 'CNXCONSUM', 'CNXCOMMO', 'CNXMETAL', 'CNXMEDIA',
  'CNXAUTO', 'CNX200', 'CNXSCAP', 'CNXPSUBANK', 'CNXPSE', 'CNXPHARMA',
  'CNXENERGY', 'CNXINFRA', 'CNXREALTY', 'CNX100', 'CNX500', 'CNXMIDCAP',
  'NIFSC250', 'NIFMC400', 'NIFMSC400', 'NIFTYOILGAS', 'NIFTYHC', 'MIDCPNIFTY',
  'NIFTTOTALMAR', 'NIFTYCD', 'NSEINDEX', 'BANKNIFTY', 'NIFTYNXT50',
  'NIFTYPBI', 'NIFTYLMC250', 'NFMC150', 'NFINDIAMANU'
];

// Helper function to check if symbol requires 1d timeframe
const requiresDailyTimeframe = (symbol: string): boolean => {
  return SYMBOLS_REQUIRING_1D_TIMEFRAME.includes(symbol.toUpperCase());
};

// Helper function to check if symbol is an index
const isIndexSymbol = (symbol: string): boolean => {
  return INDEX_SYMBOLS.includes(symbol.toUpperCase());
};

// Helper function to encode symbol for API URL
const encodeSymbolForApi = (symbol: string): string => {
  const upperSymbol = symbol.toUpperCase();
  if (isIndexSymbol(upperSymbol)) {
    return `EQ%3A${upperSymbol}%3AINDEX`;
  }
  return `EQ%3A${upperSymbol}`;
};

/**
 * Gets today's market open time (9:08 AM IST)
 * @returns Date object set to today's market open
 */
export const getTodayMarketOpen = (): Date => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Market opens at 9:08 AM IST (UTC+5:30)
  today.setHours(9, 8, 0, 0);
  return today;
};

/**
 * Gets today's market close time (3:30 PM IST)
 * @returns Date object set to today's market close
 */
export const getTodayMarketClose = (): Date => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Market closes at 3:30 PM IST (UTC+5:30)
  today.setHours(15, 30, 0, 0);
  return today;
};

/**
 * Checks if the market is currently open based on the specified hours (9:08 AM to 3:30 PM IST)
 * @returns boolean indicating if market is open
 */
export const isMarketOpen = (): boolean => {
  const now = new Date();
  const day = now.getDay();

  // Market is open Monday (1) to Friday (5)
  if (day === 0 || day === 6) return false; // Sunday (0) or Saturday (6) are always closed

  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Market hours: 9:08 AM to 3:30 PM IST
  if (hours < 9 || (hours === 9 && minutes < 8)) {
    return false;
  }
  if (hours > 15 || (hours === 15 && minutes > 30)) {
    return false;
  }

  return true;
};

// Store for Friday's close price
let fridayClosePrice: number | null = null;
let lastFridayDate: Date | null = null;

/**
 * Gets the current date in IST timezone
 */
const getCurrentISTDate = (): Date => {
  // Get current UTC time
  const now = new Date();

  // Create a new date in IST timezone (UTC+5:30)
  // This properly converts UTC to IST without double-adding timezone offset
  const istDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));

  return istDate;
};

/**
 * Gets the last working day (Friday or earlier if there are holidays)
 * @param fromDate Optional starting date, defaults to current IST date
 * @returns Date object set to the last working day
 */
const getLastWorkingDay = (fromDate?: Date): Date => {
  const date = fromDate ? new Date(fromDate) : getCurrentISTDate();

  // If it's Saturday (6) or Sunday (0), go back to Friday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }

  return date;
};

/**
 * Checks if current date is weekend (Saturday or Sunday) in IST
 */
const isWeekendIST = (): boolean => {
  const now = getCurrentISTDate();
  const day = now.getDay();
  return day === 0 || day === 6; // Sunday (0) or Saturday (6)
};

/**
 * Checks if current time is after-hours on a weekday (12:00 AM to 9:15 AM IST)
 * This is when system date may have changed but markets haven't opened yet
 */
const isAfterHoursWeekday = (): boolean => {
  const now = getCurrentISTDate();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Only applies to weekdays (Monday=1 to Friday=5)
  if (day === 0 || day === 6) return false;

  // Check if time is between 12:00 AM (00:00) and 9:15 AM (09:15)
  if (hours < 9 || (hours === 9 && minutes < 15)) {
    return true;
  }

  return false;
};

/**
 * Checks if current time is in the problematic night hours (3:55 AM to 9:15 AM IST)
 * During this period, regular APIs often fail and historical fallback should be prioritized
 */
const isProblematicNightHours = (): boolean => {
  const now = getCurrentISTDate();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Only applies to weekdays (Monday=1 to Friday=5)
  if (day === 0 || day === 6) return false;

  // Check if time is between 3:55 AM (03:55) and 9:15 AM (09:15)
  if (hours > 3 && hours < 9) {
    return true;
  }
  if (hours === 3 && minutes >= 55) {
    return true;
  }
  if (hours === 9 && minutes < 15) {
    return true;
  }

  return false;
};

/**
 * Gets the previous trading day, accounting for weekends and after-hours
 * This is crucial for after-hours weekday polling when system date has changed
 * but we need previous day's market data
 */
const getPreviousTradingDay = (): Date => {
  const now = getCurrentISTDate();
  const previousDay = new Date(now);

  // Go back one day
  previousDay.setDate(now.getDate() - 1);

  // If the previous day is weekend, keep going back to Friday
  while (previousDay.getDay() === 0 || previousDay.getDay() === 6) {
    previousDay.setDate(previousDay.getDate() - 1);
  }

  return previousDay;
};

/**
 * Formats date to YYYY-MM-DD string in local timezone
 */
const formatDateOnly = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Checks if two dates are the same day
 */
const isSameDayIST = (date1: Date, date2: Date): boolean => {
  return formatDateOnly(date1) === formatDateOnly(date2);
};

/**
 * Gets the most recent Friday's date
 */
const getLastFriday = (): Date => {
  const date = getCurrentISTDate();
  const day = date.getDay();
  const diff = (day + 2) % 7; // Days since last Friday
  const friday = new Date(date);
  friday.setDate(date.getDate() - diff);
  return friday;
};

/**
 * Retry mechanism for API calls with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Fetches price ticks for a given symbol and date range
 * @param symbol The stock symbol (e.g., 'TAJGVK')
 * @param fromDate Start date (default: today's market open)
 * @param toDate End date (default: current time)
 * @param interval Candle interval (default: '1m')
 * @returns Promise with price ticks data
 */
export const fetchPriceTicks = async (
  symbol: string,
  fromDate?: Date,
  toDate?: Date,
  interval?: string
): Promise<PriceTicksResponse> => {
  return retryWithBackoff(async () => {
    const now = getCurrentISTDate();
    const isWeekend = isWeekendIST();
    const isAfterHours = isAfterHoursWeekday();
    let from: Date, to: Date;
    let actualInterval: string;

    // Check if this symbol requires 1d timeframe
    const forceDaily = requiresDailyTimeframe(symbol);

    // Determine interval and date range based on market status
    if (isWeekend && !fromDate && !toDate) {
      // Weekend: Use daily candles and get data from last working days
      actualInterval = interval || '1d';

      // Get last working day (Friday or earlier)
      const lastWorkingDay = getLastWorkingDay();

      // Set 'to' date to end of last working day
      to = new Date(lastWorkingDay);
      to.setHours(23, 59, 59, 999);

      // Set 'from' date to cover sufficient historical data (e.g., last 30 working days)
      from = new Date(lastWorkingDay);
      from.setDate(from.getDate() - 45); // Go back ~45 days to ensure we get 30 working days
      from.setHours(9, 15, 59, 0); // Market open time

    } else if (isAfterHours && !fromDate && !toDate) {
      // After-hours weekday (12:00 AM to 9:15 AM): Use previous trading day's data
      actualInterval = forceDaily ? '1d' : (interval || '1m');

      // Get previous trading day (even if system date changed at midnight)
      const previousTradingDay = getPreviousTradingDay();

      // Set 'from' to previous trading day market open
      from = new Date(previousTradingDay);
      from.setHours(9, 15, 59, 0);

      // Set 'to' to previous trading day end (or market close)
      to = new Date(previousTradingDay);
      to.setHours(23, 59, 59, 999); // Full day data
      // Alternative: to.setHours(15, 30, 0, 0); // Market close only

    } else if (!fromDate && !toDate) {
      // Normal weekday during/after market hours: Use current day
      actualInterval = forceDaily ? '1d' : (interval || '1m');

      if (forceDaily) {
        // For symbols requiring 1d timeframe, use historical date range
        const today = getCurrentISTDate();
        to = new Date(today);
        to.setDate(to.getDate() - 1); // Yesterday as end date
        to.setHours(23, 59, 59, 999);

        from = new Date(to);
        from.setDate(from.getDate() - 30); // 30 days of historical data
        from.setHours(9, 15, 59, 0);
      } else {
        from = getTodayMarketOpen();
        to = new Date();
      }

    } else {
      // Explicit dates provided
      actualInterval = forceDaily ? '1d' : (interval || '1m');
      from = fromDate || getTodayMarketOpen();
      to = toDate || new Date();

    }

    // Format dates to match the required API format
    const formatForApi = (date: Date, isToDate: boolean = false) => {
      const pad = (num: number) => num.toString().padStart(2, '0');

      // Always use full timestamp format to ensure proper time handling
      // This fixes the issue where hardcoded symbols with 1d interval were getting
      // incomplete date format causing them to run one day prior
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}%3A${pad(date.getMinutes())}%3A${pad(date.getSeconds())}%2B05%3A30`;
    };

    const fromStr = formatForApi(from, false);
    const toStr = formatForApi(to, true);

    // Encode symbol for API (handles both regular stocks and indices)
    const encodedSymbol = encodeSymbolForApi(symbol);

    // Updated to use the correct API URL format with dynamic interval
    const url = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=${actualInterval}&from=${fromStr}&to=${toStr}&securities=${encodedSymbol}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      // Add additional options to handle SSL issues
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `API request failed with status ${response.status}: ${errorText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();
    // Store Friday's close price if today is Friday and market is closed
    // This logic is still relevant for potential caching but won't prevent calls
    if (isFriday(now) && now > getTodayMarketClose()) {
      const ticks = data.data.ticks[symbol];
      if (ticks && ticks.length > 0) {
        const lastTick = ticks[ticks.length - 1];
        if (lastTick && lastTick[4]) { // index 4 is close price
          fridayClosePrice = lastTick[4];
          lastFridayDate = new Date(now);
          // You might want to store this in localStorage for persistence across page reloads
          if (typeof window !== 'undefined') {
            localStorage.setItem('fridayClosePrice', fridayClosePrice.toString());
            localStorage.setItem('lastFridayDate', lastFridayDate.toISOString());
          }
        }
      }
    }

    return data;
  }, 3, 1000); // Retry up to 3 times with 1 second base delay
};

/**
 * Alternative fetch function with different error handling strategies
 * Fallback mechanism for when the primary API fails
 */
export const fetchPriceTicksWithFallback = async (
  symbol: string,
  fromDate?: Date,
  toDate?: Date,
  interval?: string
): Promise<PriceTicksResponse> => {
  const fallbackUrls = [
    'https://api-prod-v21.strike.money',
    'https://api.strike.money'
  ];

  let lastError: Error;

  for (const baseUrl of fallbackUrls) {
    try {
      const now = getCurrentISTDate();
      const isWeekend = isWeekendIST();
      const isAfterHours = isAfterHoursWeekday();
      let from: Date, to: Date;
      let actualInterval: string;

      // Check if this symbol requires 1d timeframe
      const forceDaily = requiresDailyTimeframe(symbol);

      // Use same logic as main function
      if (isWeekend && !fromDate && !toDate) {
        actualInterval = interval || '1d';
        const lastWorkingDay = getLastWorkingDay();
        to = new Date(lastWorkingDay);
        to.setHours(23, 59, 59, 999);
        from = new Date(lastWorkingDay);
        from.setDate(from.getDate() - 45);
        from.setHours(9, 15, 59, 0);
      } else if (isAfterHours && !fromDate && !toDate) {
        actualInterval = forceDaily ? '1d' : (interval || '1m');
        const previousTradingDay = getPreviousTradingDay();
        from = new Date(previousTradingDay);
        from.setHours(9, 15, 59, 0);
        to = new Date(previousTradingDay);
        to.setHours(23, 59, 59, 999);
      } else if (!fromDate && !toDate) {
        actualInterval = forceDaily ? '1d' : (interval || '1m');

        if (forceDaily) {
          // For symbols requiring 1d timeframe, use historical date range
          const today = getCurrentISTDate();
          to = new Date(today);
          to.setDate(to.getDate() - 1); // Yesterday as end date
          to.setHours(23, 59, 59, 999);

          from = new Date(to);
          from.setDate(from.getDate() - 30); // 30 days of historical data
          from.setHours(9, 15, 59, 0);
        } else {
          from = getTodayMarketOpen();
          to = new Date();
        }
      } else {
        actualInterval = forceDaily ? '1d' : (interval || '1m');
        from = fromDate || getTodayMarketOpen();
        to = toDate || new Date();
      }

      const formatForApi = (date: Date, isToDate: boolean = false) => {
        const pad = (num: number) => num.toString().padStart(2, '0');

        // Always use full timestamp format to ensure proper time handling
        // This fixes the issue where hardcoded symbols with 1d interval were getting
        // incomplete date format causing them to run one day prior
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}%3A${pad(date.getMinutes())}%3A${pad(date.getSeconds())}%2B05%3A30`;
      };

      const fromStr = formatForApi(from, false);
      const toStr = formatForApi(to, true);

      // Encode symbol for API (handles both regular stocks and indices)
      const encodedSymbol = encodeSymbolForApi(symbol);
      const url = `${baseUrl}/v2/api/equity/priceticks?candleInterval=${actualInterval}&from=${fromStr}&to=${toStr}&securities=${encodedSymbol}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        mode: 'cors',
        cache: 'no-cache',
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  throw lastError || new Error('All API endpoints failed');
};

/**
 * Smart fetch function that prioritizes historical fallback during problematic night hours
 * Uses historical data first during 3:55 AM to 9:15 AM IST on weekdays
 */
export const fetchPriceTicksSmart = async (
  symbol: string,
  fromDate?: Date,
  toDate?: Date,
  interval?: string
): Promise<PriceTicksResponse> => {
  const isNightHours = isProblematicNightHours();

  if (isNightHours) {
    try {
      // Try historical fallback first during night hours
      return await fetchPriceTicksWithHistoricalFallback(symbol);
    } catch (historicalError) {
      try {
        // If historical fails, try primary API
        return await fetchPriceTicks(symbol, fromDate, toDate, interval);
      } catch (primaryError) {
        // If primary fails, try secondary fallback
        return await fetchPriceTicksWithFallback(symbol, fromDate, toDate, interval);
      }
    }
  } else {
    // Normal hours: use regular priority order
    try {
      // Try primary API first
      return await fetchPriceTicks(symbol, fromDate, toDate, interval);
    } catch (primaryError) {
      try {
        // If primary fails, try secondary fallback
        return await fetchPriceTicksWithFallback(symbol, fromDate, toDate, interval);
      } catch (fallbackError) {
        // If all else fails, try historical fallback
        return await fetchPriceTicksWithHistoricalFallback(symbol);
      }
    }
  }
};

/**
 * Final fallback function that uses daily data with historical date range
 * This is used when all other methods fail, especially during after-hours/pre-market times
 */
export const fetchPriceTicksWithHistoricalFallback = async (
  symbol: string
): Promise<PriceTicksResponse> => {
  const now = getCurrentISTDate();
  const currentDate = new Date(now);

  // Set 'to' date to current system date (or previous working day if weekend)
  const to = isWeekendIST() ? getLastWorkingDay() : currentDate;
  to.setHours(23, 59, 59, 999);

  // Set 'from' date to go back significantly to ensure we get data
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1); // Go back 1 year to ensure data availability
  from.setMonth(11); // December
  from.setDate(4);   // December 4th
  from.setHours(9, 15, 59, 0);

  const formatForApi = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}%3A${pad(date.getMinutes())}%3A${pad(date.getSeconds())}%2B05%3A30`;
  };

  const fromStr = formatForApi(from);
  const toStr = formatForApi(to);

  // Encode symbol for API (handles both regular stocks and indices)
  const encodedSymbol = encodeSymbolForApi(symbol);

  // Use daily interval for historical data
  const url = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=1d&from=${fromStr}&to=${toStr}&securities=${encodedSymbol}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      signal: AbortSignal.timeout(20000), // 20 second timeout for historical data
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Historical fallback failed with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    // Verify we got data
    const ticks = data.data?.ticks?.[symbol.toUpperCase()];
    if (!ticks || ticks.length === 0) {
      throw new Error(`No historical data available for ${symbol}`);
    }

    return data;

  } catch (error) {
    throw error;
  }
};

/**
 * Test function to verify API URL construction
 * This demonstrates weekday, after-hours, and weekend URL formats
 */
export const testApiUrlConstruction = (symbol: string = 'TATACOMM'): {
  weekday: string;
  afterHours: string;
  weekend: string
} => {
  const formatForApi = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}%3A${pad(date.getMinutes())}%3A${pad(date.getSeconds())}%2B05%3A30`;
  };

  const encodedSymbol = `EQ%3A${symbol.toUpperCase()}`;

  // Normal Weekday URL (1m interval) - Market hours
  const weekdayFrom = new Date('2025-06-11T09:15:59+05:30');
  const weekdayTo = new Date('2025-06-11T15:30:00+05:30');
  const weekdayFromStr = formatForApi(weekdayFrom);
  const weekdayToStr = formatForApi(weekdayTo);
  const weekdayUrl = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=1m&from=${weekdayFromStr}&to=${weekdayToStr}&securities=${encodedSymbol}`;

  // After-Hours Weekday URL (1m interval) - Previous trading day data
  // Example: It's Friday 13th at 2:00 AM, system date changed to Saturday 14th
  // But we use Friday 13th data because markets haven't opened yet
  const afterHoursFrom = new Date('2025-06-13T09:15:59+05:30'); // Previous trading day (Friday)
  const afterHoursTo = new Date('2025-06-13T23:59:59+05:30');   // Previous trading day end
  const afterHoursFromStr = formatForApi(afterHoursFrom);
  const afterHoursToStr = formatForApi(afterHoursTo);
  const afterHoursUrl = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=1m&from=${afterHoursFromStr}&to=${afterHoursToStr}&securities=${encodedSymbol}`;

  // Weekend URL (1d interval) - Historical data
  const weekendFrom = new Date('2023-11-29T09:15:59+05:30');
  const weekendTo = new Date('2025-06-13T23:59:59+05:30');
  const weekendFromStr = formatForApi(weekendFrom);
  const weekendToStr = formatForApi(weekendTo);
  const weekendUrl = `https://api-v2.strike.money/v2/api/equity/priceticks?candleInterval=1d&from=${weekendFromStr}&to=${weekendToStr}&securities=${encodedSymbol}`;

  return {
    weekday: weekdayUrl,
    afterHours: afterHoursUrl,
    weekend: weekendUrl
  };
};
