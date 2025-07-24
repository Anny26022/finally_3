/**
 * Mathematical Utility Functions
 * Centralized location for common mathematical operations
 */

/**
 * Safe division with zero protection
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  return denominator !== 0 ? numerator / denominator : fallback;
}

/**
 * Safe percentage calculation
 */
export function calcSafePercentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Safe average calculation with zero division protection
 */
export function calcSafeAverage(values: number[]): number {
  return values.length > 0 
    ? values.reduce((sum, val) => sum + val, 0) / values.length 
    : 0;
}

/**
 * Calculate average from array of objects with accounting P/L
 * Used for consistent average calculations across performance analytics
 */
export function calcAccountingAwareAverage(
  trades: Array<{ accountingPL: number }>,
  filterPositive: boolean = true
): number {
  const filteredTrades = filterPositive 
    ? trades.filter(t => t.accountingPL > 0)
    : trades.filter(t => t.accountingPL < 0);
    
  return filteredTrades.length > 0
    ? filteredTrades.reduce((sum, t) => sum + t.accountingPL, 0) / filteredTrades.length
    : 0;
}

/**
 * Calculate absolute average (for loss calculations)
 */
export function calcAbsoluteAverage(
  trades: Array<{ accountingPL: number }>
): number {
  const negativeTrades = trades.filter(t => t.accountingPL < 0);
  return negativeTrades.length > 0
    ? Math.abs(negativeTrades.reduce((sum, t) => sum + t.accountingPL, 0) / negativeTrades.length)
    : 0;
}

/**
 * Round to specified decimal places
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate percentage change between two values
 * Used for stock move calculations
 */
export function calcPercentageChange(oldValue: number, newValue: number): number {
  if (!oldValue || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate percentage of value relative to total
 * Used for allocation, win rate, and other percentage calculations
 */
export function calcPercentageOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * Calculate stock move percentage with buy/sell direction
 * Centralized function to eliminate all stock move duplicates
 */
export function calcStockMovePercentage(
  entryPrice: number,
  currentPrice: number,
  buySell: 'Buy' | 'Sell' = 'Buy'
): number {
  if (!entryPrice || !currentPrice || entryPrice <= 0 || currentPrice <= 0) return 0;

  return buySell === 'Buy'
    ? ((currentPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - currentPrice) / entryPrice) * 100;
}

/**
 * Calculate allocation percentage
 * Centralized function to eliminate all allocation duplicates
 */
export function calcAllocationPercentage(
  positionSize: number,
  portfolioSize: number
): number {
  return portfolioSize > 0 ? (positionSize / portfolioSize) * 100 : 0;
}
