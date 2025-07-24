/**
 * Date Utilities for Calculations
 * Centralized location for all date-related calculation utilities
 */

import { Trade } from '../../../types/trade';
import { getTradeDateForAccounting } from '../../../utils/accountingUtils';

/**
 * Get unique sorted dates from trades based on accounting method
 */
export function getUniqueSortedDates(
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
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate weighted holding days for FIFO trades
 */
export function calculateWeightedHoldingDays(
  tradeLegs: Array<{
    entryDate: Date;
    exitDate: Date | null;
    qty: number;
    exited: boolean;
  }>
): number {
  if (tradeLegs.length === 0) return 0;

  const totalQty = tradeLegs.reduce((sum, leg) => sum + leg.qty, 0);
  if (totalQty === 0) return 0;

  const weightedDays = tradeLegs.reduce((sum, leg) => {
    const exitDate = leg.exitDate || new Date();
    const days = calculateDaysBetween(leg.entryDate, exitDate);
    return sum + (days * leg.qty);
  }, 0);

  return Math.round(weightedDays / totalQty);
}

/**
 * Calculate holding days for a trade using FIFO method
 */
export function calcHoldingDays(
  entryDate: string,
  exitDate: string | null,
  pyramidDates: string[],
  exitDates: string[]
): number {
  try {
    if (!entryDate) return 0;

    // Create entry lots with dates
    const entryLots = [
      { date: new Date(entryDate), qty: 1 } // Simplified for calculation
    ];

    // Add pyramid entries if they exist
    pyramidDates.forEach(date => {
      if (date) {
        entryLots.push({ date: new Date(date), qty: 1 });
      }
    });

    // Create exit lots with dates
    const exitLots = exitDates
      .filter(date => date)
      .map(date => ({ date: new Date(date), qty: 1 }));

    // If no exits, calculate from entry to current date
    if (exitLots.length === 0) {
      const currentDate = new Date();
      const avgEntryDate = new Date(
        entryLots.reduce((sum, lot) => sum + lot.date.getTime(), 0) / entryLots.length
      );
      return calculateDaysBetween(avgEntryDate, currentDate);
    }

    // Calculate FIFO holding days
    const tradeLegs: Array<{
      entryDate: Date;
      exitDate: Date | null;
      qty: number;
      exited: boolean;
    }> = [];

    // Match entries with exits using FIFO
    const entriesCopy = [...entryLots];
    const exitsCopy = [...exitLots];

    while (entriesCopy.length > 0 && exitsCopy.length > 0) {
      const entry = entriesCopy.shift()!;
      const exit = exitsCopy.shift()!;
      
      tradeLegs.push({
        entryDate: entry.date,
        exitDate: exit.date,
        qty: 1,
        exited: true
      });
    }

    // Add remaining entries as open positions
    entriesCopy.forEach(entry => {
      tradeLegs.push({
        entryDate: entry.date,
        exitDate: null,
        qty: 1,
        exited: false
      });
    });

    return calculateWeightedHoldingDays(tradeLegs);
  } catch (error) {
    return 0;
  }
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "-";

  let date: Date;

  // Handle DD-MM-YYYY format (with dashes)
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('-').map(Number);
    date = new Date(year, month - 1, day);
  }
  // Handle DD.MM.YYYY format (with dots)
  else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('.').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    // Handle other formats (ISO, etc.)
    date = new Date(dateString);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return dateString; // Return original string if parsing fails
  }

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

/**
 * Get month and year from date string
 */
export function getMonthYear(dateStr: string): string {
  const d = new Date(dateStr);
  const month = normalizeMonthName(d.toLocaleString('default', { month: 'short' }));
  return `${month} ${d.getFullYear()}`;
}

/**
 * Check if a date is within a specific month and year
 */
export function isDateInMonth(dateStr: string, month: string, year: number): boolean {
  const date = new Date(dateStr);
  const dateMonth = normalizeMonthName(date.toLocaleString('default', { month: 'short' }));
  const dateYear = date.getFullYear();

  return dateMonth === month && dateYear === year;
}

/**
 * Get all months between two dates
 */
export function getMonthsBetween(startDate: Date, endDate: Date): Array<{ month: string; year: number }> {
  const months: Array<{ month: string; year: number }> = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    months.push({
      month: current.toLocaleString('default', { month: 'short' }),
      year: current.getFullYear()
    });
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

/**
 * Normalize month name (e.g., "Sept" -> "Sep")
 */
export function normalizeMonthName(month: string): string {
  const monthMap: Record<string, string> = {
    'Sept': 'Sep',
    'September': 'Sep',
    'January': 'Jan',
    'February': 'Feb',
    'March': 'Mar',
    'April': 'Apr',
    'May': 'May',
    'June': 'Jun',
    'July': 'Jul',
    'August': 'Aug',
    'October': 'Oct',
    'November': 'Nov',
    'December': 'Dec'
  };
  
  return monthMap[month] || month;
}

/**
 * Get financial year start and end dates
 */
export function getFinancialYearDates(fyStartYear: number): { start: Date; end: Date } {
  return {
    start: new Date(fyStartYear, 3, 1), // April 1st
    end: new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999) // March 31st next year
  };
}

/**
 * Get calendar year start and end dates
 */
export function getCalendarYearDates(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1), // January 1st
    end: new Date(year, 11, 31, 23, 59, 59, 999) // December 31st
  };
}

/**
 * Check if a date falls within a date range
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Convert days to years for annualization
 */
export function daysToYears(days: number): number {
  return days / 365;
}

/**
 * Get trading days between two dates (approximate)
 */
export function getTradingDaysBetween(startDate: Date, endDate: Date): number {
  const totalDays = calculateDaysBetween(startDate, endDate);
  // Approximate: 5/7 of days are trading days (excluding weekends)
  return Math.round(totalDays * (5/7));
}

/**
 * Get the last day of a month
 */
export function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/**
 * Get the first day of a month
 */
export function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}


