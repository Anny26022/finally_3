import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo, useRef } from "react";
import { getExitDatesWithFallback } from './accountingUtils';
import { SupabaseService } from '../services/supabaseService';
import { v4 as uuidv4 } from 'uuid';

// FIXED SEQUENTIAL MONTHLY CAPITAL INHERITANCE SYSTEM:
// This interface implements the proper capital flow logic where each month inherits from the previous month.
export interface MonthlyTruePortfolio {
  month: string;
  year: number;
  openingCapital: number;           // Raw starting capital (user input or inherited from previous month's final capital)
  capitalChanges: number;           // Net deposits/withdrawals made during the month
  effectiveStartingCapital: number; // Capital available for trading (openingCapital + capitalChanges) - DISPLAY THIS
  pl: number;                       // P&L from trades for the month (calculated on effectiveStartingCapital)
  finalCapital: number;             // Final balance (effectiveStartingCapital + pl) - becomes next month's openingCapital
}

export interface YearlyStartingCapital {
  id: string;
  year: number;
  startingCapital: number;
  updatedAt: string;
}

export interface MonthlyStartingCapitalOverride {
  id: string;
  month: string;
  year: number;
  startingCapital: number;
  updatedAt: string;
}

export interface CapitalChange {
  id: string;
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description: string;
}

interface TruePortfolioContextType {
  getTruePortfolioSize: (month: string, year: number, trades?: any[], useCashBasis?: boolean) => number;
  getLatestTruePortfolioSize: (trades?: any[], useCashBasis?: boolean) => number;
  yearlyStartingCapitals: YearlyStartingCapital[];
  setYearlyStartingCapital: (year: number, amount: number) => Promise<void>;
  getYearlyStartingCapital: (year: number) => number;
  monthlyStartingCapitalOverrides: MonthlyStartingCapitalOverride[];
  setMonthlyStartingCapitalOverride: (month: string, year: number, amount: number) => Promise<void>;
  removeMonthlyStartingCapitalOverride: (month: string, year: number) => Promise<void>;
  getMonthlyStartingCapitalOverride: (month: string, year: number) => number | null;
  capitalChanges: CapitalChange[];
  addCapitalChange: (change: Omit<CapitalChange, 'id'>) => Promise<void>;
  updateCapitalChange: (change: CapitalChange) => Promise<void>;
  deleteCapitalChange: (id: string) => Promise<void>;
  getMonthlyTruePortfolio: (month: string, year: number, trades?: any[], useCashBasis?: boolean) => MonthlyTruePortfolio;
  getAllMonthlyTruePortfolios: (trades?: any[], useCashBasis?: boolean) => MonthlyTruePortfolio[];
  cleanupDuplicates: () => Promise<{
    yearlyCapitals: { before: number; after: number };
    capitalChanges: { before: number; after: number };
    monthlyOverrides: { before: number; after: number };
  }>;
  portfolioSize: number;
}

// Define action keys for cleaner type definitions
type ActionKeys = 'setYearlyStartingCapital' | 'setMonthlyStartingCapitalOverride' | 'removeMonthlyStartingCapitalOverride' | 'addCapitalChange' | 'updateCapitalChange' | 'deleteCapitalChange' | 'cleanupDuplicates';

// Split context types for better readability
type TruePortfolioStateType = Omit<TruePortfolioContextType, ActionKeys>;
type TruePortfolioActionsType = Pick<TruePortfolioContextType, ActionKeys>;

const TruePortfolioStateContext = createContext<TruePortfolioStateType | undefined>(undefined);
const TruePortfolioActionsContext = createContext<TruePortfolioActionsType | undefined>(undefined);

async function fetchYearlyStartingCapitals(): Promise<YearlyStartingCapital[]> {
  try {
    const data = await SupabaseService.getYearlyStartingCapitals();
    return data.map(item => ({ id: item.id, year: item.year, startingCapital: item.amount, updatedAt: item.updated_at }));
  } catch (error) { return []; }
}

async function fetchCapitalChanges(): Promise<CapitalChange[]> {
  try {
    const data = await SupabaseService.getCapitalChanges();
    return data.map(item => ({ id: item.id, date: item.date, amount: item.amount, type: item.amount >= 0 ? 'deposit' : 'withdrawal', description: item.description || '' }));
  } catch (error) { return []; }
}

async function fetchMonthlyStartingCapitalOverrides(): Promise<MonthlyStartingCapitalOverride[]> {
  try {
    const data = await SupabaseService.getMonthlyStartingCapitalOverrides();
    return data.map(item => ({ id: item.id, month: item.month, year: item.year, startingCapital: item.amount, updatedAt: item.updated_at }));
  } catch (error) { return []; }
}

export const TruePortfolioProvider = ({ children }: { children: ReactNode }) => {
  const [yearlyStartingCapitals, setYearlyStartingCapitals] = useState<YearlyStartingCapital[]>([]);
  const [capitalChanges, setCapitalChanges] = useState<CapitalChange[]>([]);
  const [monthlyStartingCapitalOverrides, setMonthlyStartingCapitalOverrides] = useState<MonthlyStartingCapitalOverride[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const isLoadingRef = useRef(false);
  const calculationCache = useRef(new Map<string, MonthlyTruePortfolio>());

  useEffect(() => {
    const loadData = async () => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      try {
        const [capitals, changes, overrides] = await Promise.all([
          fetchYearlyStartingCapitals(),
          fetchCapitalChanges(),
          fetchMonthlyStartingCapitalOverrides()
        ]);
        setYearlyStartingCapitals(Array.isArray(capitals) ? capitals : []);
        setCapitalChanges(Array.isArray(changes) ? changes : []);
        setMonthlyStartingCapitalOverrides(Array.isArray(overrides) ? overrides : []);
      } catch (error) {

      } finally {
        setHydrated(true);
        isLoadingRef.current = false;
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    calculationCache.current.clear();
  }, [yearlyStartingCapitals, capitalChanges, monthlyStartingCapitalOverrides]);

  const normalizeMonth = useCallback((month: string): string => {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (shortMonths.includes(month)) return month;

    // Handle various month formats
    const monthMap: Record<string, string> = {
      "January": "Jan", "February": "Feb", "March": "Mar", "April": "Apr",
      "May": "May", "June": "Jun", "July": "Jul", "August": "Aug",
      "September": "Sep", "October": "Oct", "November": "Nov", "December": "Dec",
      // Handle alternative abbreviations
      "Sept": "Sep", // Common alternative for September
      "JAN": "Jan", "FEB": "Feb", "MAR": "Mar", "APR": "Apr",
      "JUN": "Jun", "JUL": "Jul", "AUG": "Aug", "SEP": "Sep",
      "OCT": "Oct", "NOV": "Nov", "DEC": "Dec"
    };
    return monthMap[month] || month;
  }, []);

  const setYearlyStartingCapital = useCallback(async (year: number, amount: number) => {
    let existingItem = yearlyStartingCapitals.find(item => item.year === year);
    const newItem: YearlyStartingCapital = { id: existingItem ? existingItem.id : uuidv4(), year, startingCapital: amount, updatedAt: new Date().toISOString() };
    try {
      // ATOMIC OPERATION: Persist ONLY the specific item to database first
      await SupabaseService.saveYearlyStartingCapital(newItem);
      // Update local state ONLY on success
      setYearlyStartingCapitals(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(item => item.year === year);
        if (existingIndex >= 0) updated[existingIndex] = newItem; else updated.push(newItem);
        return updated.sort((a, b) => a.year - b.year);
      });
    } catch (error) { }
  }, [yearlyStartingCapitals]);

  const setMonthlyStartingCapitalOverride = useCallback(async (month: string, year: number, amount: number) => {
    const normalizedMonth = normalizeMonth(month);
    let existingItem = monthlyStartingCapitalOverrides.find(item => item.month === normalizedMonth && item.year === year);
    const newOverride: MonthlyStartingCapitalOverride = { id: existingItem ? existingItem.id : uuidv4(), month: normalizedMonth, year, startingCapital: amount, updatedAt: new Date().toISOString() };
    try {
      // ATOMIC OPERATION: Persist ONLY the specific item to database first
      await SupabaseService.saveMonthlyStartingCapitalOverride(newOverride);
      // Update local state ONLY on success
      setMonthlyStartingCapitalOverrides(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(item => item.month === normalizedMonth && item.year === year);
        if (existingIndex >= 0) updated[existingIndex] = newOverride; else updated.push(newOverride);
        return updated.sort((a, b) => a.year - b.year || a.month.localeCompare(b.month));
      });
    } catch (error) { }
  }, [monthlyStartingCapitalOverrides, normalizeMonth]);

  const removeMonthlyStartingCapitalOverride = useCallback(async (month: string, year: number) => {
    const normalizedMonth = normalizeMonth(month);
    const itemToRemove = monthlyStartingCapitalOverrides.find(item => item.month === normalizedMonth && item.year === year);
    if (!itemToRemove) return;
    try {
      // ATOMIC OPERATION: Delete ONLY the specific item from database first
      await SupabaseService.deleteMonthlyStartingCapitalOverride(itemToRemove.id);
      // Update local state ONLY on success
      setMonthlyStartingCapitalOverrides(prev => prev.filter(item => item.id !== itemToRemove.id));
    } catch (error) { }
  }, [monthlyStartingCapitalOverrides, normalizeMonth]);

  const addCapitalChange = useCallback(async (change: Omit<CapitalChange, 'id'>) => {
    const newChange = { ...change, id: uuidv4() };
    try {
      // ATOMIC OPERATION: Persist ONLY the new item to database first
      await SupabaseService.addCapitalChange(newChange);
      // Update local state ONLY on success
      setCapitalChanges(prev => [...prev, newChange]);
    } catch (error) { }
  }, []);

  const updateCapitalChange = useCallback(async (updatedChange: CapitalChange) => {
    try {
      // ATOMIC OPERATION: Update ONLY the specific item in database first
      await SupabaseService.updateCapitalChange(updatedChange);
      // Update local state ONLY on success
      setCapitalChanges(prev => prev.map(change => (change.id === updatedChange.id ? updatedChange : change)));
    } catch (error) { }
  }, []);

  const deleteCapitalChange = useCallback(async (id: string) => {
    try {
      // ATOMIC OPERATION: Delete ONLY the specific item from database first
      await SupabaseService.deleteCapitalChange(id);
      // Update local state ONLY on success
      setCapitalChanges(prev => prev.filter(change => change.id !== id));
    } catch (error) { }
  }, []);

  const getYearlyStartingCapital = useCallback((year: number): number => {
    return yearlyStartingCapitals.find(item => item.year === year)?.startingCapital || 0;
  }, [yearlyStartingCapitals]);

  const getMonthlyStartingCapitalOverride = useCallback((month: string, year: number): number | null => {
    const normalizedMonth = normalizeMonth(month);
    const override = monthlyStartingCapitalOverrides.find(item => item.month === normalizedMonth && item.year === year);
    return override ? override.startingCapital : null;
  }, [monthlyStartingCapitalOverrides, normalizeMonth]);

  const getCapitalChangesForMonth = useCallback((month: string, year: number): number => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return capitalChanges
      .filter(change => {
        if (!change.date) return false;
        const changeDate = new Date(change.date);
        const changeMonth = monthNames[changeDate.getUTCMonth()];
        const changeYear = changeDate.getUTCFullYear();
        return changeMonth === month && changeYear === year;
      })
      .reduce((sum, change) => sum + change.amount, 0);
  }, [capitalChanges]);

  const getTradesPLForMonth = useCallback((month: string, year: number, trades: any[] = [], useCashBasis: boolean = false): number => {
    if (!trades || trades.length === 0) return 0;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (useCashBasis) {
      return trades
        .filter(trade => trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial')
        .reduce((sum, trade) => {
          let monthPL = 0;
          const exits = getExitDatesWithFallback(trade);
          exits.forEach(exit => {
            const exitDate = new Date(exit.date);
            if (isNaN(exitDate.getTime())) return;
            const exitMonth = monthNames[exitDate.getUTCMonth()];
            const exitYear = exitDate.getUTCFullYear();
            if (exitMonth === month && exitYear === year) {
              const avgEntry = trade.avgEntry || trade.entry || 0;
              if (avgEntry > 0 && exit.price > 0 && exit.qty > 0) {
                 monthPL += trade.buySell === 'Buy' ? (exit.price - avgEntry) * exit.qty : (avgEntry - exit.price) * exit.qty;
              }
            }
          });
          return sum + monthPL;
        }, 0);
    } else {
      return trades
        .filter(trade => {
          if (!trade.date) return false;
          const tradeDate = new Date(trade.date);
          if (isNaN(tradeDate.getTime())) return false;
          const tradeMonth = monthNames[tradeDate.getUTCMonth()];
          const tradeYear = tradeDate.getUTCFullYear();
          return tradeMonth === month && tradeYear === year;
        })
        .reduce((sum, trade) => sum + (trade.plRs || 0), 0);
    }
  }, []);

  const calculateMonthlyTruePortfolio = useCallback((month: string, year: number, trades: any[], memo: Map<string, MonthlyTruePortfolio>, useCashBasis: boolean): MonthlyTruePortfolio => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const normalizedMonth = normalizeMonth(month);
    const monthIndex = months.indexOf(normalizedMonth);
    if (monthIndex === -1) throw new Error(`Invalid month: ${month}`);

    const key = `${normalizedMonth}-${year}-${useCashBasis}`;
    if (memo.has(key)) return memo.get(key)!;

    // CRITICAL FIX: Add base case to prevent infinite recursion
    // Don't calculate more than 5 years back from current date (reasonable trading history)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const minYear = Math.max(2020, currentYear - 5); // Don't go before 2020 or more than 5 years back

    if (year < minYear) {
      // Return a base case with yearly starting capital (no default fallback for old years)
      const baseCapital = getYearlyStartingCapital(year) || 0;
      const result: MonthlyTruePortfolio = {
        month: normalizedMonth,
        year,
        openingCapital: baseCapital,
        capitalChanges: 0,
        effectiveStartingCapital: baseCapital,
        pl: 0,
        finalCapital: baseCapital,
      };
      memo.set(key, result);
      return result;
    }

    // FIXED SEQUENTIAL MONTHLY CAPITAL INHERITANCE SYSTEM
    let openingCapital = 0;
    const override = getMonthlyStartingCapitalOverride(normalizedMonth, year);
    const capitalChangesAmount = getCapitalChangesForMonth(normalizedMonth, year);

    if (override !== null) {
      // Manual override takes precedence - this is the raw user input
      openingCapital = override;

    } else {
      if (monthIndex === 0) {
        // January Logic: Check if user set yearly starting capital first
        const yearlyCapital = getYearlyStartingCapital(year);
        if (yearlyCapital > 0) {
          // User explicitly set starting capital for this year
          openingCapital = yearlyCapital;

        } else {
          // No yearly capital set, inherit from previous December
          const prevYearData = calculateMonthlyTruePortfolio('Dec', year - 1, trades, memo, useCashBasis);
          openingCapital = prevYearData.finalCapital;

        }
      } else {
        // February onwards: ALWAYS inherit from previous month's final capital
        const prevMonthData = calculateMonthlyTruePortfolio(months[monthIndex - 1], year, trades, memo, useCashBasis);
        openingCapital = prevMonthData.finalCapital;

      }
    }

    const pl = getTradesPLForMonth(normalizedMonth, year, trades, useCashBasis);

    // FIXED CAPITAL FLOW CALCULATION:
    // 1. Effective starting capital = opening capital + additions/withdrawals
    // 2. P/L is calculated on effective starting capital
    // 3. Final capital = effective starting capital + P/L
    const effectiveStartingCapital = openingCapital + capitalChangesAmount;
    const finalCapital = effectiveStartingCapital + pl;



    const result: MonthlyTruePortfolio = {
      month: normalizedMonth,
      year,
      openingCapital,                    // Raw starting capital (what user types or inherits)
      capitalChanges: capitalChangesAmount,
      effectiveStartingCapital,          // What should be displayed (opening + changes)
      pl,
      finalCapital,                      // This becomes next month's opening capital
    };

    memo.set(key, result);
    return result;
  }, [getYearlyStartingCapital, getCapitalChangesForMonth, getTradesPLForMonth, normalizeMonth, getMonthlyStartingCapitalOverride]);

  const getMonthlyTruePortfolio = useCallback((month: string, year: number, trades: any[] = [], useCashBasis: boolean = false): MonthlyTruePortfolio => {
    return calculateMonthlyTruePortfolio(month, year, trades, calculationCache.current, useCashBasis);
  }, [calculateMonthlyTruePortfolio]);
  
  const getTruePortfolioSize = useCallback((month: string, year: number, trades: any[] = [], useCashBasis: boolean = false): number => {
    try {
      return getMonthlyTruePortfolio(month, year, trades, useCashBasis).finalCapital;
    } catch (error) {

      return getYearlyStartingCapital(year) || 0;
    }
  }, [getMonthlyTruePortfolio, getYearlyStartingCapital]);
  
  const getLatestTruePortfolioSize = useCallback((trades: any[] = [], useCashBasis: boolean = false): number => {
    const currentDate = new Date();
    const currentMonth = normalizeMonth(currentDate.toLocaleString('default', { month: 'short' }));
    const currentYear = currentDate.getFullYear();
    const calculatedSize = getTruePortfolioSize(currentMonth, currentYear, trades, useCashBasis);
    return (calculatedSize > 0 && isFinite(calculatedSize)) ? calculatedSize : (getYearlyStartingCapital(currentYear) || 0);
  }, [getTruePortfolioSize, getYearlyStartingCapital, normalizeMonth]);
  
  const getAllMonthlyTruePortfolios = useCallback((trades: any[] = [], useCashBasis: boolean = false): MonthlyTruePortfolio[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result: MonthlyTruePortfolio[] = [];
    const allDates = [
        ...trades.map(t => new Date(t.date)),
        ...capitalChanges.map(c => new Date(c.date)),
        ...yearlyStartingCapitals.map(y => new Date(y.year, 0, 1))
    ].filter(d => !isNaN(d.getTime()));
    if (allDates.length === 0) allDates.push(new Date());



    // CRITICAL FIX: Add reasonable bounds to prevent infinite recursion
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const minYear = Math.max(2020, currentYear - 5); // Don't go before 2020 or more than 5 years back
    const maxYear = currentYear; // Don't calculate future months

    // FIXED: Always start from January of the earliest relevant year
    const earliestDataYear = allDates.length > 0
      ? Math.min(...allDates.map(d => d.getFullYear()))
      : currentYear;

    const startYear = Math.max(minYear, Math.min(earliestDataYear, currentYear));
    const minDate = new Date(startYear, 0, 1); // Always start from January 1st

    const maxDate = new Date(maxYear, 11, 31); // End of current year



    let iterationDate = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
    let iterationCount = 0;
    const maxIterations = 12 * 6; // Maximum 6 years of data (reasonable for trading history)



    while (iterationDate <= maxDate && iterationCount < maxIterations) {
      const year = iterationDate.getUTCFullYear();
      const month = months[iterationDate.getUTCMonth()];
      try {
        result.push(calculateMonthlyTruePortfolio(month, year, trades, calculationCache.current, useCashBasis));
      } catch (error) {

      }
      iterationDate.setUTCMonth(iterationDate.getUTCMonth() + 1);
      iterationCount++;
    }


    return result;
  }, [yearlyStartingCapitals, capitalChanges, calculateMonthlyTruePortfolio]);

  const cleanupDuplicates = useCallback(async () => {
    const uniqueCapitalChanges = new Map<string, CapitalChange>();
    capitalChanges.forEach(change => {
      const key = `${change.date}-${change.amount}-${change.type}-${change.description || ''}`;
      if (!uniqueCapitalChanges.has(key)) uniqueCapitalChanges.set(key, change);
    });
    const cleanCapitalChanges = Array.from(uniqueCapitalChanges.values());

    const uniqueYearlyCapitals = new Map<number, YearlyStartingCapital>();
    yearlyStartingCapitals.forEach(c => {
      const existing = uniqueYearlyCapitals.get(c.year);
      if (!existing || new Date(c.updatedAt) > new Date(existing.updatedAt)) uniqueYearlyCapitals.set(c.year, c);
    });
    const cleanYearlyCapitals = Array.from(uniqueYearlyCapitals.values());

    const uniqueMonthlyOverrides = new Map<string, MonthlyStartingCapitalOverride>();
    monthlyStartingCapitalOverrides.forEach(o => {
      const key = `${o.month}-${o.year}`;
      const existing = uniqueMonthlyOverrides.get(key);
      if (!existing || new Date(o.updatedAt) > new Date(existing.updatedAt)) uniqueMonthlyOverrides.set(key, o);
    });
    const cleanMonthlyOverrides = Array.from(uniqueMonthlyOverrides.values());

    try {
      await Promise.all([
        SupabaseService.saveYearlyStartingCapitals(cleanYearlyCapitals),
        SupabaseService.saveCapitalChanges(cleanCapitalChanges),
        SupabaseService.saveMonthlyStartingCapitalOverrides(cleanMonthlyOverrides),
      ]);
      setYearlyStartingCapitals(cleanYearlyCapitals);
      setCapitalChanges(cleanCapitalChanges);
      setMonthlyStartingCapitalOverrides(cleanMonthlyOverrides);
    } catch (error) { }

    return {
      yearlyCapitals: { before: yearlyStartingCapitals.length, after: cleanYearlyCapitals.length },
      capitalChanges: { before: capitalChanges.length, after: cleanCapitalChanges.length },
      monthlyOverrides: { before: monthlyStartingCapitalOverrides.length, after: cleanMonthlyOverrides.length }
    };
  }, [yearlyStartingCapitals, capitalChanges, monthlyStartingCapitalOverrides]);

  const portfolioSize = useMemo(() => {
    if (!hydrated) return 0;
    return getLatestTruePortfolioSize();
  }, [hydrated, getLatestTruePortfolioSize]);

  const actions = useMemo(() => ({
    setYearlyStartingCapital, setMonthlyStartingCapitalOverride, removeMonthlyStartingCapitalOverride,
    addCapitalChange, updateCapitalChange, deleteCapitalChange, cleanupDuplicates,
  }), [setYearlyStartingCapital, setMonthlyStartingCapitalOverride, removeMonthlyStartingCapitalOverride, addCapitalChange, updateCapitalChange, deleteCapitalChange, cleanupDuplicates]);

  const state = useMemo(() => ({
    getTruePortfolioSize, getLatestTruePortfolioSize, yearlyStartingCapitals, getYearlyStartingCapital,
    monthlyStartingCapitalOverrides, getMonthlyStartingCapitalOverride, capitalChanges,
    getMonthlyTruePortfolio, getAllMonthlyTruePortfolios, portfolioSize,
  }), [
    getTruePortfolioSize, getLatestTruePortfolioSize, yearlyStartingCapitals, getYearlyStartingCapital,
    monthlyStartingCapitalOverrides, getMonthlyStartingCapitalOverride, capitalChanges,
    getMonthlyTruePortfolio, getAllMonthlyTruePortfolios, portfolioSize
  ]);

  return (
    <TruePortfolioActionsContext.Provider value={actions}>
      <TruePortfolioStateContext.Provider value={state}>
        {children}
      </TruePortfolioStateContext.Provider>
    </TruePortfolioActionsContext.Provider>
  );
};

export const useTruePortfolio = (): TruePortfolioContextType => {
  const state = useContext(TruePortfolioStateContext);
  const actions = useContext(TruePortfolioActionsContext);
  if (!state || !actions) {
    throw new Error("useTruePortfolio must be used within a TruePortfolioProvider");
  }
  return { ...state, ...actions };
};