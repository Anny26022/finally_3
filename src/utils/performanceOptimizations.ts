// Performance optimization utilities for monthly performance calculations

import { calcXIRR } from '../lib/calculations';

// Enhanced memoization with LRU cache
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global XIRR cache with LRU eviction
const xirrCache = new LRUCache<string, number>(2000);

// Optimized XIRR calculation with caching
export const memoizedCalcXIRR = (
  startDate: Date,
  startingCapital: number,
  endDate: Date,
  endingCapital: number,
  capitalChanges: { date: Date; amount: number }[]
): number => {
  // Create cache key from inputs
  const key = `${startDate.getTime()}-${startingCapital}-${endDate.getTime()}-${endingCapital}-${capitalChanges.map(c => `${c.date.getTime()}:${c.amount}`).join(',')}`;
  
  const cached = xirrCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  
  const result = calcXIRR(startDate, startingCapital, endDate, endingCapital, capitalChanges);
  xirrCache.set(key, result);
  
  return result;
};

// Batch XIRR calculation for multiple periods
export interface XirrCalculationInput {
  id: string;
  startDate: Date;
  startingCapital: number;
  endDate: Date;
  endingCapital: number;
  capitalChanges: { date: Date; amount: number }[];
}

export interface XirrCalculationResult {
  id: string;
  result: number;
}

export const batchCalculateXirr = (
  calculations: XirrCalculationInput[]
): XirrCalculationResult[] => {
  return calculations.map(calc => ({
    id: calc.id,
    result: memoizedCalcXIRR(
      calc.startDate,
      calc.startingCapital,
      calc.endDate,
      calc.endingCapital,
      calc.capitalChanges
    )
  }));
};

// Debounced calculation to prevent excessive recalculations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttled calculation to limit calculation frequency
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimized capital changes filtering
export const createCapitalChangesLookup = (
  capitalChanges: Array<{ date: Date; type: 'deposit' | 'withdrawal'; amount: number }>,
  year: number
) => {
  const lookup = new Map<string, number>();
  const yearChanges = capitalChanges.filter(change => 
    new Date(change.date).getFullYear() === year
  );
  
  yearChanges.forEach(change => {
    const date = new Date(change.date);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const amount = change.type === 'deposit' ? change.amount : -change.amount;
    
    lookup.set(key, (lookup.get(key) || 0) + amount);
  });
  
  return lookup;
};

// Optimized trade grouping by month
export const groupTradesByMonth = (
  trades: any[],
  year: number,
  useCashBasis: boolean,
  monthOrder: string[]
) => {
  const tradesByMonth: Record<string, any[]> = {};
  
  trades.forEach(trade => {
    if (!trade.date) return;
    
    const tradeDate = new Date(useCashBasis ? (trade.exitDate || trade.date) : trade.date);
    if (tradeDate.getFullYear() !== year) return;
    
    const month = monthOrder[tradeDate.getMonth()];
    if (!tradesByMonth[month]) {
      tradesByMonth[month] = [];
    }
    tradesByMonth[month].push(trade);
  });
  
  // Sort trades within each month
  Object.values(tradesByMonth).forEach(monthTrades => {
    monthTrades.sort((a, b) => {
      const dateA = new Date(useCashBasis ? (a.exitDate || a.date) : a.date);
      const dateB = new Date(useCashBasis ? (b.exitDate || b.date) : b.date);
      return dateA.getTime() - dateB.getTime();
    });
  });
  
  return tradesByMonth;
};

// Clear caches when needed
export const clearPerformanceCaches = () => {
  xirrCache.clear();
};

// Performance monitoring
export const measurePerformance = <T>(
  name: string,
  fn: () => T
): T => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  // Debug logging removed for production
  return result;
};

// Async batch processing with progress callback
export const batchCalculateXirrAsync = async (
  calculations: XirrCalculationInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<XirrCalculationResult[]> => {
  const results: XirrCalculationResult[] = [];
  const batchSize = 10; // Process in batches to avoid blocking
  
  for (let i = 0; i < calculations.length; i += batchSize) {
    const batch = calculations.slice(i, i + batchSize);
    const batchResults = batchCalculateXirr(batch);
    results.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, calculations.length), calculations.length);
    }
    
    // Yield control to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
};
