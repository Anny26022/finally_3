import React from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tooltip, Input, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useTrades } from "../hooks/use-trades";
import { useTruePortfolioWithTrades } from "../hooks/use-true-portfolio-with-trades";
import { calcXIRR, calcWeightedRewardRisk } from "../lib/calculations";
import { useAccountingMethod } from "../context/AccountingMethodContext";
import { useGlobalFilter } from "../context/GlobalFilterContext";
import { getTradesForMonth, calculateTradePL, getTradeDateForAccounting } from "../utils/accountingUtils";
import MobileTooltip from "../components/ui/MobileTooltip";
import { SupabaseService } from "../services/supabaseService";
import { supabase } from "../lib/supabase";
import { AuthService } from "../services/authService";

// Consolidated cache and utilities
const xirrCache = new Map<string, number>();
const memoizedCalcXIRR = (startDate: Date, startingCapital: number, endDate: Date, endingCapital: number, capitalChanges: { date: Date; amount: number }[]): number => {
  const key = `${startDate.getTime()}-${startingCapital}-${endDate.getTime()}-${endingCapital}-${capitalChanges.map(c => `${c.date.getTime()}:${c.amount}`).join(',')}`;
  if (xirrCache.has(key)) return xirrCache.get(key)!;
  const result = calcXIRR(startDate, startingCapital, endDate, endingCapital, capitalChanges);
  xirrCache.set(key, result);
  if (xirrCache.size > 1000) xirrCache.delete(xirrCache.keys().next().value);
  return result;
};

interface MonthlyData {
  month: string; addedWithdrawn: number; startingCapital: number; pl: number; plPercentage: number; finalCapital: number;
  yearPlPercentage: string; trades: number; winPercentage: number; avgGain: number; avgLoss: number; avgRR: number;
  biggestImpact: number; smallestLoss: number; avgHoldingDays: number; cagr: number;
  rollingReturn1M: number; rollingReturn3M: number; rollingReturn6M: number; rollingReturn12M: number;
}

// Default visible columns for monthly performance - matching user's screenshot
const DEFAULT_VISIBLE_COLUMNS = [
  'month', 'startingCapital', 'addedWithdrawn', 'pl', 'plPercentage', 'finalCapital', 'trades', 'winPercentage', 'avgGain', 'avgLoss', 'avgRR', 'avgHoldingDays'
];

// All available columns
const ALL_COLUMNS = [
  'month', 'startingCapital', 'addedWithdrawn', 'pl', 'plPercentage', 'finalCapital', 'cagr',
  'rollingReturn1M', 'rollingReturn3M', 'rollingReturn6M', 'rollingReturn12M',
  'trades', 'winPercentage', 'avgGain', 'avgLoss', 'avgRR', 'avgHoldingDays'
];

const MonthlyPerformanceTableComponent: React.FC = () => {
  const { trades } = useTrades();
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';
  const { portfolioSize, getPortfolioSize, getAllMonthlyTruePortfolios, yearlyStartingCapitals, setYearlyStartingCapital,
    setMonthlyStartingCapitalOverride, removeMonthlyStartingCapitalOverride, getMonthlyStartingCapitalOverride,
    capitalChanges, addCapitalChange, updateCapitalChange, deleteCapitalChange, monthlyStartingCapitalOverrides } = useTruePortfolioWithTrades(trades);

  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const [editingCell, setEditingCell] = React.useState<{ row: number; col: string } | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [yearlyStartingCapital, setYearlyStartingCapitalState] = React.useState(portfolioSize);
  const [visibleColumns, setVisibleColumns] = React.useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [isResetting, setIsResetting] = React.useState(false);

  // CRITICAL: Comprehensive data readiness check to prevent cascade calculation errors
  const [isDataFullyReady, setIsDataFullyReady] = React.useState(false);
  const [dataLoadingStage, setDataLoadingStage] = React.useState<'loading' | 'processing' | 'ready'>('loading');

  // CRITICAL FIX: Simplified data readiness check to prevent data loss
  const isEssentialDataReady = React.useMemo(() => {
    // CRITICAL: Only check for basic data structure, not content
    const hasValidTrades = Array.isArray(trades); // Don't check length
    const hasValidCapitalChanges = Array.isArray(capitalChanges);
    const hasValidGetters = typeof getPortfolioSize === 'function' && typeof getAllMonthlyTruePortfolios === 'function';

    // CRITICAL: Always consider data ready if basic structures exist
    return hasValidTrades && hasValidCapitalChanges && hasValidGetters;
  }, [trades, capitalChanges, getPortfolioSize, getAllMonthlyTruePortfolios]);

  // Staged data loading to prevent calculation cascade errors
  React.useEffect(() => {
    if (!isEssentialDataReady) {
      setDataLoadingStage('loading');
      setIsDataFullyReady(false);
      return;
    }

    setDataLoadingStage('processing');

    // CRITICAL FIX: Reduced timeout since we now show starting capital during loading
    const processingTimer = setTimeout(() => {
      setDataLoadingStage('ready');
      setIsDataFullyReady(true);
    }, 100); // Reduced timeout since starting capital is now shown immediately

    return () => clearTimeout(processingTimer);
  }, [isEssentialDataReady, selectedYear, accountingMethod]);

  const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // CRITICAL FIX: Add memoization key to prevent excessive recalculations
  // FIXED: Include yearlyStartingCapitals and monthlyStartingCapitalOverrides in calculation key
  // CRITICAL FIX: Include trades hash to ensure P/L calculations are updated when trades change
  // CRITICAL FIX: Include actual values, not just lengths, to detect content changes
  const calculationKey = React.useMemo(() => {
    const tradesHash = trades.map(t => `${t.id}-${t.plRs}-${t.positionStatus}`).join('|');
    const yearlyCapitalsHash = yearlyStartingCapitals.map(y => `${y.year}-${y.startingCapital}`).join('|');
    const monthlyOverridesHash = monthlyStartingCapitalOverrides.map(m => `${m.month}-${m.year}-${m.startingCapital}`).join('|');
    return `${trades.length}-${selectedYear}-${accountingMethod}-${capitalChanges.length}-${yearlyCapitalsHash}-${monthlyOverridesHash}-${tradesHash.slice(0, 100)}`;
  }, [trades, selectedYear, accountingMethod, capitalChanges.length, yearlyStartingCapitals, monthlyStartingCapitalOverrides]);

  // CRITICAL FIX: Use existing calculationKey for consistency

  // CRITICAL FIX: Always calculate data, don't wait for loading states
  const { monthlyPortfolios, filteredTrades, capitalChangesByMonth, monthlyMap } = React.useMemo(() => {
    // CRITICAL FIX: Removed loading state check that was causing data loss

    try {
      // Get monthly portfolios with proper error handling
      const portfolios = getAllMonthlyTruePortfolios(trades, useCashBasis)
        .filter(mp => mp.year === selectedYear);





      // Filter trades with validation
      const filtered = trades?.filter(trade => {
        if (!trade.date) return false;
        try {
          const tradeYear = new Date(trade.date).getFullYear();
          return tradeYear === selectedYear;
        } catch {
          return false;
        }
      }) || [];

      // Calculate capital changes with validation
      const changesByMonth: Record<string, number> = {};
      capitalChanges.forEach(change => {
        try {
          const changeDate = new Date(change.date);
          if (changeDate.getUTCFullYear() === selectedYear) {
            const month = monthOrder[changeDate.getUTCMonth()];
            if (month) {
              changesByMonth[month] = (changesByMonth[month] || 0) + (change.type === 'deposit' ? change.amount : -change.amount);
            }
          }
        } catch (error) {

        }
      });

      // Build monthly map with validation
      const map: Record<string, { trades: typeof trades; date: Date }> = {};
      const tradesByMonth: Record<string, typeof trades> = {};

      filtered.forEach(trade => {
        try {
          const tradeDate = new Date(getTradeDateForAccounting(trade, useCashBasis));
          const month = monthOrder[tradeDate.getMonth()];
          if (month) {
            if (!tradesByMonth[month]) tradesByMonth[month] = [];
            tradesByMonth[month].push(trade);
          }
        } catch (error) {

        }
      });

      Object.entries(tradesByMonth).forEach(([month, trades]) => {
        if (trades.length > 0) {
          trades.sort((a, b) => {
            try {
              return new Date(getTradeDateForAccounting(a, useCashBasis)).getTime() -
                     new Date(getTradeDateForAccounting(b, useCashBasis)).getTime();
            } catch {
              return 0;
            }
          });
          try {
            map[month] = { trades, date: new Date(getTradeDateForAccounting(trades[0], useCashBasis)) };
          } catch (error) {

          }
        }
      });

      return {
        monthlyPortfolios: portfolios,
        filteredTrades: filtered,
        capitalChangesByMonth: changesByMonth,
        monthlyMap: map
      };
    } catch (error) {

      return {
        monthlyPortfolios: [],
        filteredTrades: [],
        capitalChangesByMonth: {},
        monthlyMap: {}
      };
    }
  }, [calculationKey, getAllMonthlyTruePortfolios, trades, useCashBasis, selectedYear, capitalChanges, monthOrder, yearlyStartingCapitals, monthlyStartingCapitalOverrides]);

  // Load column visibility preferences on mount
  React.useEffect(() => {
    const loadColumnPreferences = async () => {
      try {
        const preferences = await SupabaseService.getMiscData('monthlyPerformance_visibleColumns');

        if (preferences && Array.isArray(preferences) && preferences.length > 0) {
          // User has saved preferences, use them
          setVisibleColumns(preferences);
        } else {
          // No saved preferences, use new defaults and save them
          setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          await SupabaseService.saveMiscData('monthlyPerformance_visibleColumns', DEFAULT_VISIBLE_COLUMNS);
        }
      } catch (error) {
        // Fallback to defaults on error
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
      }
    };
    loadColumnPreferences();
  }, []);

  // Save column visibility preferences when changed (but not on initial load)
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);

  React.useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }

    const saveColumnPreferences = async () => {
      try {
        // Create a direct save function that bypasses debouncing for preferences
        const saveDirectly = async () => {
          const userId = await AuthService.getUserId();
          if (!userId) return false;

          const { error } = await supabase
            .from('misc_data')
            .upsert({
              user_id: userId,
              key: 'monthlyPerformance_visibleColumns',
              value: visibleColumns
            }, {
              onConflict: 'user_id,key'
            });

          if (error) throw error;
          return true;
        };

        await saveDirectly();
      } catch (error) {
        // Silent error handling
      }
    };

    saveColumnPreferences();
  }, [visibleColumns, isInitialLoad]);

  // CRITICAL FIX: Prevent infinite loop by only updating when value actually changes
  React.useEffect(() => {
    if (yearlyStartingCapital !== portfolioSize) {
      setYearlyStartingCapitalState(portfolioSize);
    }
  }, [portfolioSize, yearlyStartingCapital]);

  // CRITICAL FIX: Always calculate starting capital data, even during loading
  const initialMonthlyData = React.useMemo(() => {
    // CRITICAL FIX: Show actual starting capital data even during loading states
    // This prevents the "₹ 0" display issue and ensures historical data is visible
    const calculateStartingCapitalForMonth = (month: string): number => {
      try {
        // Try to get monthly override first
        const override = getMonthlyStartingCapitalOverride(month, selectedYear);
        if (override !== null) {
          return override;
        }

        // Try to get calculated portfolio size
        const calculatedSize = getPortfolioSize(month, selectedYear);
        if (calculatedSize && calculatedSize > 0) {
          return calculatedSize;
        }

        // Fallback to yearly starting capital for January
        if (month === 'Jan') {
          const yearlyCapital = yearlyStartingCapitals.find(c => c.year === selectedYear);
          if (yearlyCapital) {
            return yearlyCapital.startingCapital;
          }
        }

        return 0;
      } catch (error) {
        return 0;
      }
    };

    // CRITICAL FIX: Always show actual data, don't hide it during loading states
    // The loading state check was causing data loss - removed completely

    return monthOrder.map((month) => {
      const monthTrades = monthlyMap[month]?.trades || [];
      const tradesCount = monthTrades.length;
      let winCount = 0, totalGain = 0, totalLoss = 0, totalHoldingDays = 0;

      monthTrades.forEach(trade => {
        const accountingPL = calculateTradePL(trade, useCashBasis);
        const stockMove = trade.stockMove || 0;
        if (accountingPL > 0) { winCount++; totalGain += stockMove; }
        else if (accountingPL < 0) totalLoss += stockMove;
        totalHoldingDays += trade.holdingDays || 0;
      });

      const winPercentage = tradesCount > 0 ? (winCount / tradesCount) * 100 : 0;
      const avgGain = winCount > 0 ? totalGain / winCount : 0;
      const avgLoss = (tradesCount - winCount) > 0 ? totalLoss / (tradesCount - winCount) : 0;

      // CRITICAL FIX: Use proper weighted RR calculation instead of gain/loss ratio
      const avgRR = tradesCount > 0
        ? monthTrades.reduce((sum, trade) => sum + calcWeightedRewardRisk(trade), 0) / tradesCount
        : 0;

      const avgHoldingDays = tradesCount > 0 ? totalHoldingDays / tradesCount : 0;

      // FIXED: Always use TruePortfolioContext data which handles all the complex logic correctly
      const monthPortfolio = monthlyPortfolios.find(mp => mp.month === month) ||
        { month, year: selectedYear, openingCapital: 0, capitalChanges: 0, effectiveStartingCapital: 0, pl: 0, finalCapital: 0 };



      const netAddedWithdrawn = monthPortfolio.capitalChanges;

      // FIXED: Always use effectiveStartingCapital from TruePortfolioContext
      // This already includes the proper sequential inheritance and capital changes
      const adjustedStartingCapital = monthPortfolio.effectiveStartingCapital;

      const shouldShowPL = tradesCount > 0 || monthPortfolio.pl !== 0;

      // CRITICAL FIX: Fallback P/L calculation if monthPortfolio.pl is 0 but we have trades
      let actualPL = monthPortfolio.pl;
      if (tradesCount > 0 && monthPortfolio.pl === 0) {
        // Recalculate P/L directly from trades as fallback
        actualPL = monthTrades.reduce((sum, trade) => {
          return sum + calculateTradePL(trade, useCashBasis);
        }, 0);


      }

      return {
        month, addedWithdrawn: netAddedWithdrawn, startingCapital: adjustedStartingCapital,
        pl: shouldShowPL ? actualPL : '-', plPercentage: shouldShowPL ? 0 : '-',
        finalCapital: shouldShowPL ? (adjustedStartingCapital + actualPL) : adjustedStartingCapital, yearPlPercentage: '',
        trades: tradesCount > 0 ? tradesCount : '-', winPercentage: tradesCount > 0 ? winPercentage : '-',
        avgGain: tradesCount > 0 ? avgGain : '-', avgLoss: tradesCount > 0 ? avgLoss : '-',
        avgRR: tradesCount > 0 ? avgRR : '-', biggestImpact: 0, smallestLoss: 0,
        avgHoldingDays: tradesCount > 0 ? avgHoldingDays : '-', cagr: 0,
        rollingReturn1M: 0, rollingReturn3M: 0, rollingReturn6M: 0, rollingReturn12M: 0
      };
    });
  }, [monthOrder, monthlyMap, monthlyPortfolios, selectedYear, capitalChangesByMonth, getPortfolioSize, useCashBasis, yearlyStartingCapitals, monthlyStartingCapitalOverrides, getMonthlyStartingCapitalOverride]);

  // CRITICAL FIX: Always process capital changes, don't wait for loading states
  const allCapitalChanges = React.useMemo(() => {
    try {
      return capitalChanges
        .filter(change => {
          try {
            return new Date(change.date).getFullYear() === selectedYear;
          } catch {
            return false;
          }
        })
        .map(change => {
          try {
            return {
              date: new Date(change.date),
              amount: change.type === 'deposit' ? change.amount : -change.amount
            };
          } catch {
            return null;
          }
        })
        .filter(change => change !== null)
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {

      return [];
    }
  }, [capitalChanges, selectedYear]);

  // CRITICAL FIX: Always compute data, don't wait for loading states
  const computedData = React.useMemo(() => {
    // FIXED: Always use TruePortfolioContext data, don't fall back to broken initialMonthlyData
    // The TruePortfolioContext handles all the complex logic correctly

    return initialMonthlyData.map((row, i) => {
      const { startingCapital, pl, finalCapital } = row;
      const monthIndex = monthOrder.indexOf(row.month);
      const currentDate = new Date(selectedYear, monthIndex, 1);
      const relevantChanges = allCapitalChanges.filter(change => change.date <= currentDate);

      // Calculate XIRR values
      const xirrYTD = (typeof startingCapital === 'number' && typeof finalCapital === 'number' && startingCapital !== 0)
        ? memoizedCalcXIRR(new Date(selectedYear, 0, 1), yearlyStartingCapital || startingCapital, currentDate, finalCapital, relevantChanges) : 0;

      // Helper function for rolling returns
      const calcRollingXirr = (monthsBack: number) => {
        const prevData = initialMonthlyData[i - monthsBack];
        if (i >= monthsBack && prevData && typeof prevData.finalCapital === 'number' && typeof finalCapital === 'number') {
          const prevDate = new Date(selectedYear, monthIndex - monthsBack, 1);
          return memoizedCalcXIRR(prevDate, prevData.finalCapital, currentDate, finalCapital,
            relevantChanges.filter(c => c.date >= prevDate));
        }
        return 0;
      };

      // CRITICAL FIX: Use proper starting capital for percentage calculation
      // Need to get the actual effective starting capital, not the potentially 0 value
      let effectiveStartingCapitalForPercentage = startingCapital;

      if (effectiveStartingCapitalForPercentage === 0 || effectiveStartingCapitalForPercentage === null) {
        // Fallback: Get the override value or yearly starting capital
        const override = getMonthlyStartingCapitalOverride(row.month, selectedYear);
        if (override !== null) {
          effectiveStartingCapitalForPercentage = override;
        } else if (row.month === 'Jan') {
          const yearlyCapital = yearlyStartingCapitals.find(c => c.year === selectedYear);
          effectiveStartingCapitalForPercentage = yearlyCapital?.startingCapital || 0;
        }
      }

      const plPercentage = (typeof effectiveStartingCapitalForPercentage === 'number' &&
                           typeof pl === 'number' &&
                           effectiveStartingCapitalForPercentage !== 0)
        ? (pl / effectiveStartingCapitalForPercentage) * 100
        : '-';



      return {
        ...row,
        plPercentage,
        cagr: xirrYTD, rollingReturn1M: calcRollingXirr(1), rollingReturn3M: calcRollingXirr(3),
        rollingReturn6M: calcRollingXirr(6), rollingReturn12M: calcRollingXirr(12)
      };
    });
  }, [initialMonthlyData, yearlyStartingCapital, allCapitalChanges, monthOrder, selectedYear, yearlyStartingCapitals, monthlyStartingCapitalOverrides, calculationKey]);

  // Ensure we have valid data before rendering the table
  if (!computedData || computedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-default-400 mb-2">
          <Icon icon="lucide:calendar-x" className="w-12 h-12 mx-auto mb-3 opacity-50" />
        </div>
        <div className="text-default-500 text-lg font-medium mb-1">
          No monthly data available
        </div>
        <div className="text-default-400 text-sm">
          Add some trades to see monthly performance breakdown
        </div>
      </div>
    );
  }

  // Helper to get the date string for the first day of a month/year
  const getMonthDateString = (month: string, year: number) => {
    const monthIndex = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(month);
    return new Date(year, monthIndex, 1).toISOString();
  };

  // Helper to get relevant years based on actual data
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = new Set<number>();

    // Add current year and next year
    years.add(currentYear);
    years.add(currentYear + 1);

    // Add years from trades
    trades.forEach(trade => {
      if (trade.date) {
        const tradeYear = new Date(trade.date).getFullYear();
        if (tradeYear >= 2020) { // Only include years from 2020 onwards
          years.add(tradeYear);
        }
      }
    });

    // Add years from capital changes
    capitalChanges.forEach(change => {
      if (change.date) {
        const changeYear = new Date(change.date).getFullYear();
        if (changeYear >= 2020) { // Only include years from 2020 onwards
          years.add(changeYear);
        }
      }
    });

    // Add years from yearly starting capitals
    yearlyStartingCapitals.forEach(yearly => {
      if (yearly.year >= 2020) { // Only include years from 2020 onwards
        years.add(yearly.year);
      }
    });

    // Convert to sorted array
    return Array.from(years).sort((a, b) => a - b);
  };

  // Consolidated handlers and lookup
  const capitalChangesLookup = React.useMemo(() => {
    const lookup = new Map<string, any>();
    capitalChanges.forEach(change => {
      const d = new Date(change.date);
      lookup.set(`${d.getUTCFullYear()}-${d.getUTCMonth()}`, change);
    });
    return lookup;
  }, [capitalChanges]);

  const handleSaveAddedWithdrawn = (rowIndex: number, month: string, year: number) => {
    const value = Number(editingValue);
    if (isNaN(value)) return;
    const monthIndex = monthOrder.indexOf(month);
    if (monthIndex === -1) return;

    const monthDate = new Date(Date.UTC(selectedYear, monthIndex, 1));
    const existingChange = capitalChangesLookup.get(`${selectedYear}-${monthIndex}`);

    // DISABLED: Automatic deletion of monthly overrides when setting capital changes
    // This was causing unwanted data deletion
    // const existingOverride = getMonthlyStartingCapitalOverride(month, year);
    // if (existingOverride !== null && value !== 0) {

    //   removeMonthlyStartingCapitalOverride(month, year);
    // }

    // CRITICAL FIX: Store the actual signed value, not absolute value
    // Positive values = deposits, Negative values = withdrawals
    if (existingChange) {
      updateCapitalChange({
        ...existingChange,
        amount: value, // Store the actual signed value
        type: value >= 0 ? 'deposit' : 'withdrawal',
        date: monthDate.toISOString(),
        description: 'Manual edit from performance table'
      });
    } else if (value !== 0) {
      addCapitalChange({
        amount: value, // Store the actual signed value
        type: value >= 0 ? 'deposit' : 'withdrawal',
        date: monthDate.toISOString(),
        description: 'Manual edit from performance table'
      });
    } else if (value === 0 && existingChange) {
      deleteCapitalChange(existingChange.id);
    }
    setEditingCell(null); setEditingValue("");
  };

  const handleSaveStartingCapital = (rowIndex: number, month: string, year: number) => {
    const value = parseFloat(editingValue);
    if (isNaN(value) || value < 0) { setEditingCell(null); setEditingValue(''); return; }



    // DISABLED: Automatic deletion of capital changes when setting monthly overrides
    // This was causing unwanted data deletion
    // const monthIndex = monthOrder.indexOf(month);
    // if (monthIndex !== -1) {
    //   const existingChange = capitalChangesLookup.get(`${year}-${monthIndex}`);
    //   if (existingChange) {
    //     deleteCapitalChange(existingChange.id);
    //   }
    // }

    setMonthlyStartingCapitalOverride(month, year, value);

    setEditingCell(null); setEditingValue('');
  };

  // Consolidated columns definition
  const createTooltipLabel = (text: string, tooltip: string, icon = "lucide:info") => (
    <div className="flex items-center gap-1">
      {text}
      <MobileTooltip content={<div className="max-w-xs text-xs p-1">{tooltip}</div>} placement="top">
        <Icon icon={icon} className="text-base text-foreground-400 cursor-pointer" />
      </MobileTooltip>
    </div>
  );

  const allColumns = [
    { key: 'month', label: 'Month' },
    { key: 'startingCapital', label: createTooltipLabel('Starting Capital',
      'Capital at the start of the month. Priority: 1. Manual Override 2. January: Yearly starting capital 3. Other months: Previous month\'s final capital') },
    { key: 'addedWithdrawn', label: createTooltipLabel('Added/Withdrawn',
      'For XIRR calculation, all additions/withdrawals are assumed to occur on the first day of the month.') },
    { key: 'pl', label: createTooltipLabel('P/L',
      `P/L Calculation (${useCashBasis ? 'Cash Basis' : 'Accrual Basis'}): ${useCashBasis ? 'P/L attributed to exit month' : 'P/L attributed to entry month'}`) },
    { key: 'plPercentage', label: createTooltipLabel('% P/L',
      `P/L as percentage of starting capital (${useCashBasis ? 'Cash Basis' : 'Accrual Basis'})`) },
    { key: 'finalCapital', label: createTooltipLabel('Final Capital', 'Starting Capital + P/L + (Added - Withdrawn)') },
    { key: 'cagr', label: createTooltipLabel('YTD Return %', 'Year-to-Date Return using XIRR. Accounts for timing and size of all cash flows.') },
    { key: 'rollingReturn1M', label: createTooltipLabel('1M Return %', '1-Month Return using XIRR. Considers all cash flows in the last month.') },
    { key: 'rollingReturn3M', label: createTooltipLabel('3M Return %', '3-Month Return using XIRR. Annualized return over the 3-month period.') },
    { key: 'rollingReturn6M', label: createTooltipLabel('6M Return %', '6-Month Return using XIRR. Annualized return over the 6-month period.') },
    { key: 'rollingReturn12M', label: createTooltipLabel('12M Return %', '12-Month Return using XIRR. True annual return considering all capital changes.') },
    { key: 'trades', label: createTooltipLabel('Trades', 'Number of trades closed in this month.') },
    { key: 'winPercentage', label: createTooltipLabel('% Win', 'Percentage of trades closed with a profit in this month.') },
    { key: 'avgGain', label: createTooltipLabel('Avg Gain', 'Average percentage gain for winning trades in this month.') },
    { key: 'avgLoss', label: createTooltipLabel('Avg Loss', 'Average percentage loss for losing trades in this month.') },
    { key: 'avgRR', label: createTooltipLabel('Avg R:R', 'Average reward-to-risk ratio for trades in this month.') },
    { key: 'avgHoldingDays', label: createTooltipLabel('Avg Days', 'Average holding period (in days) for trades closed in this month.') },
  ];

  // Filter columns based on visibility
  const columns = React.useMemo(() => {
    return allColumns.filter(col => visibleColumns.includes(col.key));
  }, [allColumns, visibleColumns]);

  // Consolidated editing effect
  const prevEditingCell = React.useRef(editingCell);
  React.useEffect(() => {
    if (!editingCell || (prevEditingCell.current?.row === editingCell.row && prevEditingCell.current?.col === editingCell.col)) return;

    const item = computedData[editingCell.row];
    if (!item) return;

    if (editingCell.col === 'addedWithdrawn') {
      const existingChange = capitalChangesLookup.get(`${selectedYear}-${monthOrder.indexOf(item.month)}`);
      // CRITICAL FIX: Show the actual stored value (positive for deposits, negative for withdrawals)
      setEditingValue(existingChange ? String(existingChange.amount) : '');
    } else if (editingCell.col === 'startingCapital') {
      // CRITICAL FIX: Use the same calculation logic as display to ensure consistency
      const override = getMonthlyStartingCapitalOverride(item.month, selectedYear);
      if (override !== null) {
        // Show the manual override value (raw user input)
        setEditingValue(String(override));
      } else {
        // FIXED: Use the computed data value (same as display logic)
        const computedItem = computedData.find(d => d.month === item.month);
        const inheritedValue = computedItem?.startingCapital || 0;
        setEditingValue(String(inheritedValue));
      }
    }
    prevEditingCell.current = editingCell;
  }, [editingCell, computedData, capitalChangesLookup, selectedYear, monthOrder, getMonthlyStartingCapitalOverride, monthlyPortfolios]);

  // Utility functions

  const formatValue = (value: any, type: string) => {
    if (value === '-' || value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';

    switch (type) {
      case 'currency': return `₹ ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'percentage': return `${num.toFixed(2)}%`;
      case 'number': return num.toFixed(2);
      default: return value;
    }
  };

  // Reset all capital data function
  const handleResetCapitalData = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete ALL capital data including:\n\n• All yearly starting capitals\n• All monthly capital additions/withdrawals\n• All monthly starting capital overrides\n\nThis action cannot be undone. Are you sure you want to continue?')) {
      return;
    }

    setIsResetting(true);
    try {
      // Delete all capital changes
      const deleteCapitalPromises = capitalChanges.map(change => deleteCapitalChange(change.id));
      await Promise.all(deleteCapitalPromises);

      // Delete all monthly overrides
      const deleteOverridePromises = monthlyStartingCapitalOverrides.map(override =>
        removeMonthlyStartingCapitalOverride(override.month, override.year)
      );
      await Promise.all(deleteOverridePromises);

      // Reset all yearly starting capitals to 0 (or you could delete them entirely)
      const resetYearlyPromises = yearlyStartingCapitals.map(yearly =>
        setYearlyStartingCapital(yearly.year, 0)
      );
      await Promise.all(resetYearlyPromises);



      // Show success message
      alert('✅ All capital data has been successfully reset.');

    } catch (error) {

      alert('❌ Failed to reset capital data. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  // CRITICAL FIX: Removed loading state that was hiding data
  // Always show the actual data, never hide it behind loading states

  if (!computedData || computedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Icon icon="lucide:calendar-x" className="w-12 h-12 mx-auto mb-3 opacity-50 text-default-400" />
        <h3 className="text-lg font-medium text-default-600 mb-2">No Monthly Data Available</h3>
        <p className="text-default-400 max-w-md">No trades or portfolio data found for the selected year. Add some trades or adjust your filters to see monthly performance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <label htmlFor="year-picker" className="font-medium text-black dark:text-white">Year:</label>
          <select
            id="year-picker"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ height: 32, borderRadius: 6, border: '1px solid #ccc', padding: '0 8px', fontSize: 16 }}
          >
            {getYearOptions().map(y => (
              <option key={`monthly-perf-${y}`} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Column Visibility Selector and Reset Button */}
        <div className="flex items-center gap-2">
          {/* Reset Capital Data Button */}
          <Button
            variant="bordered"
            size="sm"
            color="danger"
            className="min-w-0 px-2 h-7 text-xs font-normal border-danger-300 hover:border-danger-400"
            startContent={<Icon icon="lucide:trash-2" className="text-sm" />}
            onClick={handleResetCapitalData}
            isLoading={isResetting}
            isDisabled={isResetting}
          >
            {isResetting ? 'Resetting...' : 'Reset'}
          </Button>

          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="bordered"
                size="sm"
                className="min-w-0 px-2 h-7 text-xs font-normal border-default-300 hover:border-default-400"
                startContent={<Icon icon="lucide:columns-3" className="text-sm" />}
                endContent={<Icon icon="lucide:chevron-down" className="text-sm" />}
              >
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Column visibility"
              className="dark:bg-gray-900 max-h-60 overflow-y-auto"
              closeOnSelect={false}
              selectionMode="multiple"
              selectedKeys={new Set(visibleColumns)}
              onSelectionChange={(keys) => setVisibleColumns(Array.from(keys as Set<string>))}
            >
              {/* Select All / Deselect All Controls */}
              <DropdownItem
                key="select-all"
                className="dark:text-white border-b border-divider mb-1 pb-2"
                startContent={
                  <Icon
                    icon={visibleColumns.length === allColumns.length ? "lucide:check-square-2" : "lucide:square"}
                    className={`text-sm ${visibleColumns.length === allColumns.length ? "text-primary" : "text-default-400"}`}
                  />
                }
                onPress={() => {
                  const allColumnKeys = allColumns.map(col => col.key);
                  setVisibleColumns(allColumnKeys);
                }}
              >
                Select All
              </DropdownItem>
              <DropdownItem
                key="deselect-all"
                className="dark:text-white border-b border-divider mb-1 pb-2"
                startContent={
                  <Icon
                    icon="lucide:minus-square"
                    className="text-sm text-default-400"
                  />
                }
                onPress={() => {
                  // Keep essential columns visible - all the columns user specified as essential
                  const essentialColumns = [
                    "month", "startingCapital", "addedWithdrawn", "pl", "plPercentage",
                    "finalCapital", "trades", "winPercentage", "avgGain", "avgLoss",
                    "avgRR", "avgHoldingDays"
                  ];
                  setVisibleColumns(essentialColumns);
                }}
              >
                Show Essential Only
              </DropdownItem>

              {/* Individual Column Controls */}
              {allColumns.map((column) => (
                <DropdownItem
                  key={column.key}
                  className="dark:text-white"
                  startContent={
                    <Icon
                      icon={visibleColumns.includes(column.key) ? "lucide:check-square-2" : "lucide:square"}
                      className={`text-sm ${visibleColumns.includes(column.key) ? "text-primary" : "text-default-400"}`}
                    />
                  }
                >
                  {typeof column.label === 'string' ? column.label :
                   column.label?.props?.children?.[0] || column.key}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <div className="rounded-lg border border-default-200 dark:border-default-100 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <Table
            aria-label="Monthly performance table"
            classNames={{
              base: "min-w-[1800px]",
              wrapper: "shadow-none p-0 rounded-none",
              table: "table-auto w-full",
              thead: "[&>tr]:first:shadow-none",
              th: "bg-default-100 dark:bg-gray-950 text-foreground-600 dark:text-white text-xs font-medium uppercase border-b border-default-200 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm whitespace-nowrap",
              td: "py-3 px-4 border-b border-default-200 dark:border-gray-800 text-foreground-800 dark:text-gray-200 whitespace-nowrap",
            }}
            removeWrapper
          >
          <TableHeader columns={columns}>
            {(column) => {
              const getColumnWidth = (key: string) => {
                switch (key) {
                  case 'month': return 'min-w-[60px]';
                  case 'startingCapital': case 'finalCapital': case 'pl': return 'min-w-[120px]';
                  case 'addedWithdrawn': return 'min-w-[140px]';
                  case 'plPercentage': case 'cagr': case 'rollingReturn1M': case 'rollingReturn3M':
                  case 'rollingReturn6M': case 'rollingReturn12M': return 'min-w-[100px]';
                  case 'trades': case 'winPercentage': case 'avgGain': case 'avgLoss':
                  case 'avgRR': case 'avgHoldingDays': return 'min-w-[80px]';
                  default: return 'min-w-[100px]';
                }
              };
              return (
                <TableColumn key={column.key} className={`whitespace-nowrap ${getColumnWidth(column.key)}`}>
                  {column.label}
                </TableColumn>
              );
            }}
          </TableHeader>
          <TableBody items={computedData}>
            {(item) => (
              <TableRow key={item.month} className="group hover:bg-default-50 dark:hover:bg-gray-800">
                {(columnKey) => {
                  // Skip columns that are not visible
                  if (!visibleColumns.includes(columnKey as string)) return null;
                  if (columnKey === 'yearPlPercentage') return null;
                  const rowIndex = computedData.findIndex(d => d.month === item.month);
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === columnKey;
                  const value = item[columnKey as keyof typeof item];

                  // Editable fields
                  if ((columnKey === 'addedWithdrawn' || columnKey === 'startingCapital') && isEditing) {
                    return (
                      <TableCell key={`${item.month}-${String(columnKey)}`}>
                        <Input autoFocus size="sm" variant="bordered" type="number" value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => columnKey === 'addedWithdrawn' ? handleSaveAddedWithdrawn(rowIndex, item.month, selectedYear) : handleSaveStartingCapital(rowIndex, item.month, selectedYear)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') columnKey === 'addedWithdrawn' ? handleSaveAddedWithdrawn(rowIndex, item.month, selectedYear) : handleSaveStartingCapital(rowIndex, item.month, selectedYear);
                            else if (e.key === 'Escape') { setEditingCell(null); setEditingValue(''); }
                          }}
                          className="h-8 min-w-[120px] text-right" startContent={<span className="text-foreground-500 text-sm">₹</span>} />
                      </TableCell>
                    );
                  }

                  if (columnKey === 'addedWithdrawn') {
                    // CRITICAL FIX: Get the actual stored value from capital changes
                    const existingChange = capitalChangesLookup.get(`${selectedYear}-${monthOrder.indexOf(item.month)}`);
                    const actualValue = existingChange ? existingChange.amount : 0;

                    return (
                      <TableCell key={`${item.month}-${String(columnKey)}`} className="cursor-pointer"
                        onClick={() => { setEditingCell({ row: rowIndex, col: columnKey }); setEditingValue(actualValue === 0 ? "" : String(actualValue)); }}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={actualValue < 0 ? "text-danger-600" : actualValue > 0 ? "text-success-600" : "text-foreground-500"}>
                            {actualValue < 0 ? `Withdrawn ₹${Math.abs(actualValue).toLocaleString()}` :
                             actualValue > 0 ? `Added ₹${actualValue.toLocaleString()}` :
                             '₹0'}
                          </span>
                          <Icon icon="lucide:edit-2" className="h-2.5 w-2.5 text-foreground-400" />
                        </div>
                      </TableCell>
                    );
                  }

                  // Consolidated cell rendering
                  const renderCell = () => {
                    if (columnKey === 'month') return <span className="font-medium">{value}</span>;

                    if (['pl', 'plPercentage', 'cagr', 'rollingReturn1M', 'rollingReturn3M', 'rollingReturn6M', 'rollingReturn12M'].includes(String(columnKey))) {
                      const isPositive = value !== '-' && Number(value) >= 0;
                      const color = value === '-' ? '' : isPositive ? 'text-success-600' : 'text-danger-600';
                      const displayValue = value === '-' ? '-' : (columnKey === 'pl' ? formatValue(value, 'currency') : formatValue(value, 'percentage'));
                      return <span className={color}>{displayValue}</span>;
                    }

                    if (columnKey === 'winPercentage') {
                      return value === '-' ? '-' : (
                        <div className="flex items-center gap-1">
                          <Icon icon={Number(value) > 0 ? "lucide:check" : "lucide:x"}
                            className={`w-3 h-3 ${Number(value) > 0 ? 'text-success-600' : 'text-danger-600'}`} />
                          {formatValue(value, 'percentage')}
                        </div>
                      );
                    }

                    if (columnKey === 'avgGain') return value === '-' ? '-' : <span className="text-success-600">{formatValue(value, 'percentage')}</span>;
                    if (columnKey === 'avgLoss') return value === '-' ? '-' : <span className="text-danger-600">{formatValue(value, 'percentage')}</span>;
                    if (columnKey === 'avgRR') return <span className={value !== '-' && Number(value) >= 0 ? 'text-success-600' : 'text-danger-600'}>{formatValue(value, 'number')}</span>;

                    // Trades column should show just the number without currency symbol
                    if (columnKey === 'trades') return <span>{value === '-' ? '-' : value}</span>;

                    // Average holding days should show just the number without currency symbol
                    if (columnKey === 'avgHoldingDays') return <span>{value === '-' ? '-' : formatValue(value, 'number')}</span>;

                    return <span>{value === '-' ? '-' : formatValue(value, typeof value === 'number' ? 'currency' : 'string')}</span>;
                  };

                  // Handle starting capital special case
                  if (columnKey === 'startingCapital') {
                    const override = getMonthlyStartingCapitalOverride(item.month, selectedYear);
                    const hasCustomSize = override !== null;

                    // CRITICAL FIX: Use the same calculation logic as initialMonthlyData
                    // This ensures display matches the actual calculated values
                    const calculateDisplayValue = (month: string): number => {
                      // Try to get monthly override first
                      const override = getMonthlyStartingCapitalOverride(month, selectedYear);
                      if (override !== null) {
                        return override;
                      }

                      // Use the computed data value (which includes inheritance logic)
                      if (typeof value === 'number' && value > 0) {
                        return value;
                      }

                      // Fallback to yearly starting capital for January
                      if (month === 'Jan') {
                        const yearlyCapital = yearlyStartingCapitals.find(c => c.year === selectedYear);
                        return yearlyCapital?.startingCapital || 0;
                      }

                      return 0;
                    };

                    const displayValue = calculateDisplayValue(item.month);
                    const editValue = override !== null ? override : displayValue;

                    return (
                      <TableCell key={`${item.month}-${String(columnKey)}`} className="cursor-pointer"
                        onClick={() => { setEditingCell({ row: rowIndex, col: columnKey }); setEditingValue(String(editValue)); }}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={hasCustomSize ? "text-primary-600 font-medium" : ""}>{formatValue(displayValue, 'currency')}</span>
                          <Icon icon="lucide:edit-2" className="h-2.5 w-2.5 text-foreground-400" />
                        </div>
                      </TableCell>
                    );
                  }

                  return <TableCell key={`${item.month}-${String(columnKey)}`} className="whitespace-nowrap">{renderCell()}</TableCell>;
                }}
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

// Performance optimization: Memoize the component to prevent unnecessary re-renders
export const MonthlyPerformanceTable = React.memo(MonthlyPerformanceTableComponent);
