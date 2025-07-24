import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Chip, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Trade } from "../../types/trade";
import { useTruePortfolioWithTrades } from "../../hooks/use-true-portfolio-with-trades";
import { useAccountingMethod } from "../../context/AccountingMethodContext";
import { useGlobalFilter } from "../../context/GlobalFilterContext";
import { isTradeInGlobalFilter } from "../../utils/dateFilterUtils";
import { fetchPriceTicksSmart } from "../../utils/priceTickApi";
import { calculateTradePL } from "../../utils/accountingUtils";

export interface ChartDataPoint {
  month: string;
  capital: number;
  pl: number;
  plPercentage: number;
  cummPf: number; // Cumulative portfolio performance
  startingCapital?: number;
  capitalChanges?: number;
  indexValue?: number;
  indexPercentage?: number;
}

interface IndexDataPoint {
  date: string;
  close: number;
  percentage: number;
}

interface PerformanceChartProps {
  trades: Trade[];
  onDataUpdate?: (data: ChartDataPoint[]) => void;
  selectedView: string;
}

function getMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = (props) => {
  const { trades, onDataUpdate, selectedView } = props;
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';
  const { filter: globalFilter } = useGlobalFilter();

  // Index comparison state
  const [showIndexComparison, setShowIndexComparison] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState('NIFTY');
  const [indexData, setIndexData] = React.useState<IndexDataPoint[]>([]);
  const [indexLoading, setIndexLoading] = React.useState(false);
  const [indexError, setIndexError] = React.useState<string | null>(null);

  // Available indices for comparison - Using correct Strike API symbols
  const availableIndices = [
    { symbol: 'NIFMSC400', name: 'NIFTY MIDSMALLCAP 400', color: '#6366f1' },
    { symbol: 'BANKNIFTY', name: 'BANK NIFTY', color: '#2ecc71' },
    { symbol: 'CNXSCAP', name: 'NIFTY SMALLCAP 100', color: '#f39c12' },
    { symbol: 'CNX500', name: 'NIFTY 500', color: '#0ea5e9' },
    { symbol: 'NIFTY', name: 'NIFTY 50', color: '#e74c3c' }
  ];

  // CRITICAL FIX: Remove memoization to prevent caching issues
  // Filter trades based on global filter and accounting method
  const filteredTrades = React.useMemo(() => {
    // Create fresh copies to prevent any mutations
    const freshTrades = trades.map(trade => ({ ...trade }));

    if (globalFilter.type === 'all') {
      return freshTrades; // No filtering for "All Time"
    }

    return freshTrades.filter(trade => isTradeInGlobalFilter(trade, globalFilter, useCashBasis));
  }, [trades, globalFilter, useCashBasis]);

  const { getPortfolioSize, getAllMonthlyTruePortfolios } = useTruePortfolioWithTrades(filteredTrades);

  // Fetch index data when comparison is enabled
  const fetchIndexData = React.useCallback(async (indexSymbol: string, startDate: Date, endDate: Date) => {
    if (!showIndexComparison) return;

    setIndexLoading(true);
    setIndexError(null);

    try {
      // Fetching index data for comparison

      const response = await fetchPriceTicksSmart(
        indexSymbol,
        startDate,
        endDate,
        '1d' // Daily interval for index comparison
      );

      // Handle Strike API response structure: data.data.ticks[symbol]
      if (response?.data?.ticks && response.data.ticks[indexSymbol]) {
        const ticks = response.data.ticks[indexSymbol];

        if (ticks.length > 0) {
          // CRITICAL FIX: Calculate cumulative performance from portfolio start date
          // This ensures fair comparison with portfolio cumulative returns
          const baselinePrice = ticks[0][4]; // First tick's close price (portfolio start)

          const processedData: IndexDataPoint[] = ticks.map((tick: any, index: number) => {
            // Strike API tick format: [dateTime, open, high, low, close, volume, dayVolume]
            const dateTime = tick[0]; // DateTime string
            const open = tick[1];     // Open price
            const high = tick[2];     // High price
            const low = tick[3];      // Low price
            const close = tick[4];    // Close price
            const volume = tick[5];   // Volume

            // Parse date and format for consistency
            const date = new Date(dateTime).toISOString().split('T')[0];

            // Calculate cumulative percentage from portfolio start date
            // This matches the portfolio's cumulative return calculation
            const percentage = ((close - baselinePrice) / baselinePrice) * 100;

            return {
              date,
              close,
              percentage
            };
          });

          setIndexData(processedData);
        } else {
          throw new Error('No ticks data received');
        }
      } else {
        console.error('❌ Invalid response structure:', response);
        throw new Error('Invalid API response structure');
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${indexSymbol} data:`, error);
      setIndexError(`Failed to load ${indexSymbol} data`);
      setIndexData([]);
    } finally {
      setIndexLoading(false);
    }
  }, [showIndexComparison]);

  // Memoize the monthly portfolios to prevent infinite re-renders
  // Pass accounting method to ensure correct P/L attribution
  // Use filtered trades to respect global filter selection
  const monthlyPortfolios = React.useMemo(() => {
    return getAllMonthlyTruePortfolios();
  }, [getAllMonthlyTruePortfolios, filteredTrades, useCashBasis]);

  // Effect to fetch index data when comparison is enabled
  React.useEffect(() => {
    if (showIndexComparison && trades.length > 0) {
      // Calculate date range from trades directly to avoid circular dependency
      const getAllRelevantDates = (trades: any[]) => {
        const dates: Date[] = [];

        trades.forEach(trade => {
          if (trade.date) {
            dates.push(new Date(trade.date));
          }
          if (useCashBasis && (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial')) {
            if (trade.exit1Date) dates.push(new Date(trade.exit1Date));
            if (trade.exit2Date) dates.push(new Date(trade.exit2Date));
            if (trade.exit3Date) dates.push(new Date(trade.exit3Date));
          }
        });

        return dates.filter(date => !isNaN(date.getTime()));
      };

      const allDates = getAllRelevantDates(trades);
      if (allDates.length > 0) {
        const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];

        // Extend the range to ensure we capture all needed data
        const extendedStartDate = new Date(startDate);
        extendedStartDate.setDate(1); // Start from beginning of month

        const extendedEndDate = new Date(endDate);
        extendedEndDate.setMonth(extendedEndDate.getMonth() + 1); // Extend to next month
        extendedEndDate.setDate(0); // Last day of the month

        // Fetch index data for comparison

        fetchIndexData(selectedIndex, extendedStartDate, extendedEndDate);
      }
    }
  }, [showIndexComparison, selectedIndex, trades, useCashBasis, fetchIndexData]);

  // Get the earliest and latest trade dates to determine the date range
  // For cash basis, we need to consider exit dates as well
  const { startDate, endDate } = React.useMemo(() => {
    const getAllRelevantDates = (trades: any[]) => {
      const dates: Date[] = [];

      trades.forEach(trade => {
        // Add entry date
        if (trade.date) {
          dates.push(new Date(trade.date));
        }

        // For cash basis, also add exit dates
        if (useCashBasis && (trade.positionStatus === 'Closed' || trade.positionStatus === 'Partial')) {
          if (trade.exit1Date) dates.push(new Date(trade.exit1Date));
          if (trade.exit2Date) dates.push(new Date(trade.exit2Date));
          if (trade.exit3Date) dates.push(new Date(trade.exit3Date));
        }
      });

      return dates.filter(date => !isNaN(date.getTime()));
    };

    const allDates = getAllRelevantDates(trades);
    const sortedDates = allDates.sort((a, b) => a.getTime() - b.getTime());
    return {
      startDate: sortedDates[0] || new Date(),
      endDate: sortedDates[sortedDates.length - 1] || new Date()
    };
  }, [trades, useCashBasis]);

  // Helper function to check if a month is within the global filter range
  const isMonthInGlobalFilter = React.useCallback((month: string, year: number) => {
    if (globalFilter.type === 'all') {
      return true;
    }

    const monthDate = new Date(year, getMonthIndex(month), 1);

    switch (globalFilter.type) {
      case 'week': {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return monthDate >= weekAgo && monthDate <= now;
      }
      case 'month': {
        const filterMonth = globalFilter.month ?? new Date().getMonth();
        const filterYear = globalFilter.year ?? new Date().getFullYear();
        return monthDate.getMonth() === filterMonth && monthDate.getFullYear() === filterYear;
      }
      case 'fy': {
        const now = new Date();
        const fyStartYear = globalFilter.fyStartYear ?? (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1);
        const fyStart = new Date(fyStartYear, 3, 1); // April 1st
        const fyEnd = new Date(fyStartYear + 1, 2, 31); // March 31st next year
        return monthDate >= fyStart && monthDate <= fyEnd;
      }
      case 'cy': {
        const cyYear = globalFilter.year ?? new Date().getFullYear();
        return monthDate.getFullYear() === cyYear;
      }
      case 'custom': {
        if (!globalFilter.startDate || !globalFilter.endDate) return true;
        return monthDate >= globalFilter.startDate && monthDate <= globalFilter.endDate;
      }
      default:
        return true;
    }
  }, [globalFilter]);

  // Helper function to get month index from month name
  const getMonthIndex = (month: string): number => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(month);
  };

  // Helper function to match index data with portfolio months
  const getIndexDataForMonth = React.useCallback((monthStr: string) => {
    if (!showIndexComparison || indexData.length === 0) return null;

    // Parse month string (e.g., "Jul 2024")
    const [month, year] = monthStr.split(' ');
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
    const targetDate = new Date(parseInt(year), monthIndex, 15); // Use mid-month for better matching

    // Find closest index data point within the same month
    let closestData = null;
    let minDiff = Infinity;

    indexData.forEach(dataPoint => {
      const dataDate = new Date(dataPoint.date);

      // Prefer data points from the same month/year
      if (dataDate.getMonth() === monthIndex && dataDate.getFullYear() === parseInt(year)) {
        const diff = Math.abs(dataDate.getTime() - targetDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestData = dataPoint;
        }
      }
    });

    // If no data found for exact month, find the closest overall
    if (!closestData) {
      indexData.forEach(dataPoint => {
        const dataDate = new Date(dataPoint.date);
        const diff = Math.abs(dataDate.getTime() - targetDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestData = dataPoint;
        }
      });
    }

    // If still no data found, interpolate from nearby months to avoid gaps
    if (!closestData && indexData.length > 0) {
      // Find the closest data point before and after the target month
      let beforeData = null;
      let afterData = null;

      indexData.forEach(dataPoint => {
        const dataDate = new Date(dataPoint.date);
        if (dataDate < targetDate) {
          if (!beforeData || dataDate > new Date(beforeData.date)) {
            beforeData = dataPoint;
          }
        } else if (dataDate > targetDate) {
          if (!afterData || dataDate < new Date(afterData.date)) {
            afterData = dataPoint;
          }
        }
      });

      // Use the closer of the two, or interpolate if both exist
      if (beforeData && afterData) {
        // Use the closer one for simplicity
        const beforeDiff = Math.abs(new Date(beforeData.date).getTime() - targetDate.getTime());
        const afterDiff = Math.abs(new Date(afterData.date).getTime() - targetDate.getTime());
        closestData = beforeDiff < afterDiff ? beforeData : afterData;
      } else if (beforeData) {
        closestData = beforeData;
      } else if (afterData) {
        closestData = afterData;
      }
    }

    return closestData;
  }, [showIndexComparison, indexData]);

  // Find the first trade date to determine when to start showing data
  const firstTradeDate = React.useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return null;

    const tradeDates = filteredTrades
      .map(trade => trade.date)
      .filter(date => date)
      .map(date => new Date(date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    return tradeDates.length > 0 ? tradeDates[0] : null;
  }, [filteredTrades]);

  // Use monthlyPortfolios data which already accounts for capital changes and P/L
  // Filter out months with no meaningful data AND months outside global filter range
  const processedChartData = React.useMemo(() => {

    const filteredData = monthlyPortfolios
      .filter(monthData => {
        // First check if month is within global filter range
        if (!isMonthInGlobalFilter(monthData.month, monthData.year)) {
          return false;
        }

        // CRITICAL FIX: Only show months from the first trade onwards
        if (firstTradeDate) {
          const monthDate = new Date(monthData.year, getMonthIndex(monthData.month), 1);
          const firstTradeMonth = new Date(firstTradeDate.getFullYear(), firstTradeDate.getMonth(), 1);

          // Skip months before the first trade
          if (monthDate < firstTradeMonth) {
            return false;
          }
        }

        // Then include months that have:
        // 1. Actual P/L (trading activity), OR
        // 2. Capital changes (deposits/withdrawals), OR
        // 3. Non-zero effective starting capital (portfolio setup)
        return monthData.pl !== 0 ||
               monthData.capitalChanges !== 0 ||
               (monthData.effectiveStartingCapital || 0) > 0;
      });

    // Calculate cumulative portfolio performance (like trade journal dashboard)
    let cummPf = 0; // Start at 0% cumulative profit factor

    return filteredData.map(monthData => {
      const monthStr = `${monthData.month} ${monthData.year}`;
      const indexDataPoint = getIndexDataForMonth(monthStr);

      // CRITICAL FIX: Apply same fallback logic as monthly performance table and tax chart
      // Get trades for this month to recalculate P/L if needed
      const monthTrades = filteredTrades.filter(trade => {
        if (!trade.date) return false;
        const tradeDate = new Date(trade.date);
        if (isNaN(tradeDate.getTime())) return false;
        const tradeMonth = tradeDate.toLocaleString('default', { month: 'short' });
        const tradeYear = tradeDate.getFullYear();
        return tradeMonth === monthData.month && tradeYear === monthData.year;
      });

      // If monthData.pl is 0 but we have trades, recalculate P/L directly from trades
      let actualPL = monthData.pl;
      if (monthTrades.length > 0 && monthData.pl === 0) {
        // Recalculate P/L directly from trades as fallback
        actualPL = monthTrades.reduce((sum, trade) => {
          return sum + calculateTradePL(trade, useCashBasis);
        }, 0);
      }

      // Calculate monthly return percentage using corrected P/L
      // CRITICAL FIX: Use effectiveStartingCapital instead of startingCapital (which doesn't exist)
      const effectiveCapital = monthData.effectiveStartingCapital || 0;
      const monthlyReturn = (effectiveCapital !== 0 && isFinite(effectiveCapital) && isFinite(actualPL))
        ? (actualPL / effectiveCapital) * 100
        : 0;

      // Add this month's return to cumulative PF (same logic as drawdown-curve.tsx)
      // Only add finite values to prevent NaN propagation
      if (isFinite(monthlyReturn)) {
        cummPf += monthlyReturn;
      }

      // Calculate corrected final capital using actual P/L
      const correctedFinalCapital = effectiveCapital + actualPL;

      return {
        month: monthStr,
        capital: correctedFinalCapital, // Use corrected final capital
        pl: actualPL, // Use corrected P/L
        startingCapital: monthData.effectiveStartingCapital, // Use effectiveStartingCapital for display
        capitalChanges: monthData.capitalChanges,
        plPercentage: monthlyReturn, // Monthly return using corrected P/L
        cummPf: cummPf, // Cumulative portfolio performance
        indexValue: indexDataPoint?.close || null,
        indexPercentage: indexDataPoint?.percentage ?? null // Use nullish coalescing to handle 0 values
      };
    });
  }, [monthlyPortfolios, isMonthInGlobalFilter, getIndexDataForMonth]);

  // CRITICAL FIX: Cleanup effect to prevent interference
  React.useEffect(() => {
    return () => {
      // Clear any potential caches when component unmounts
      if (typeof window !== 'undefined') {
        (window as any).performanceChartCache = undefined;
      }
    };
  }, []);

  // Notify parent component about data update with debouncing to prevent infinite loops
  React.useEffect(() => {
    if (onDataUpdate && processedChartData.length > 0) {
      const timeoutId = setTimeout(() => {
        onDataUpdate(processedChartData);
      }, 100); // 100ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [processedChartData]); // Removed onDataUpdate from dependencies to prevent infinite loop

  // Recalculate Drawdown and Volatility based on processedChartData
  const drawdownData = React.useMemo(() => {
    let runningMax = processedChartData[0]?.capital || 0;
    return processedChartData.map((d) => {
      if (d.capital > runningMax) runningMax = d.capital;
      const drawdown = runningMax !== 0 ? ((runningMax - d.capital) / runningMax) * 100 : 0;
      return { ...d, drawdown };
    });
  }, [processedChartData]);

  const volatilityData = React.useMemo(() => {
    function rollingStd(arr: number[], window: number) {
      return arr.map((_, i) => {
        if (i < window - 1) return 0;
        const slice = arr.slice(i - window + 1, i + 1);
        const mean = slice.reduce((a, b) => a + b, 0) / window;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
        return Math.sqrt(variance);
      });
    }
    const plPercentages = processedChartData.map(d => d.plPercentage);
    const volatilityArr = rollingStd(plPercentages, 3);
    return processedChartData.map((d, i) => ({ ...d, volatility: volatilityArr[i] }));
  }, [processedChartData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Show empty state if no data to display
  if (processedChartData.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center">
        <div className="text-center text-default-500">
          <div className="text-lg font-medium mb-2">No Portfolio Data</div>
          <div className="text-sm">Start trading to see your portfolio performance</div>
        </div>
      </div>
    );
  }

  // Get current index info
  const currentIndexInfo = availableIndices.find(idx => idx.symbol === selectedIndex);

  return (
    <div className="space-y-4">
      {/* Sleek Mini Toggle UI */}
      <motion.div
        className="flex items-center justify-between p-3 bg-content2/50 backdrop-blur-sm rounded-xl border border-divider/50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Switch
              size="sm"
              color="primary"
              isSelected={showIndexComparison}
              onValueChange={setShowIndexComparison}
              classNames={{
                wrapper: "group-data-[selected=true]:bg-primary-500",
                thumb: "group-data-[selected=true]:bg-white"
              }}
            />
            <span className="text-sm font-medium text-foreground-700">
              VS
            </span>
          </motion.div>

          <AnimatePresence>
            {showIndexComparison && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="h-4 w-px bg-divider mx-1" />
                <div className="flex items-center gap-1">
                  {availableIndices.map((index) => (
                    <motion.button
                      key={index.symbol}
                      onClick={() => setSelectedIndex(index.symbol)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 ${
                        selectedIndex === index.symbol
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'text-foreground-600 hover:bg-content3 hover:text-foreground-800'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {index.name}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showIndexComparison && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {indexLoading && (
                <div className="flex items-center gap-1">
                  <Icon icon="lucide:loader-2" className="w-3 h-3 animate-spin text-primary-500" />
                  <span className="text-xs text-foreground-600">Loading...</span>
                </div>
              )}
              {indexError && (
                <Chip size="sm" color="danger" variant="flat" className="text-xs">
                  {indexError}
                </Chip>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
        {selectedView === "capital" ? (
          showIndexComparison ? (
            <LineChart
              data={processedChartData}
              margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                dy={10}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="percentage"
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                axisLine={false}
                tickLine={false}
                dx={-10}
                width={60}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const dataPoint = props.payload;
                  const items = [];

                  if (name === "Portfolio Performance") {
                    items.push([`${value.toFixed(2)}%`, "Cumulative Performance"]);
                    if (dataPoint.capital) {
                      items.push([formatCurrency(dataPoint.capital), "Portfolio Value"]);
                    }
                    if (dataPoint.plPercentage !== undefined) {
                      items.push([`${dataPoint.plPercentage.toFixed(2)}%`, "Monthly Return"]);
                    }
                  }

                  if (name === currentIndexInfo?.name) {
                    items.push([`${value.toFixed(2)}%`, currentIndexInfo.name]);
                    if (dataPoint.indexValue) {
                      items.push([dataPoint.indexValue.toFixed(2), "Index Value"]);
                    }
                  }

                  return items;
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "hsl(var(--heroui-content1))",
                  border: "1px solid hsl(var(--heroui-divider))",
                  borderRadius: "8px",
                  padding: "8px 12px"
                }}
              />
              <Line
                yAxisId="percentage"
                type="monotone"
                dataKey="cummPf"
                name="Portfolio Performance"
                stroke="hsl(var(--heroui-primary))"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              {showIndexComparison && (
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="indexPercentage"
                  name={currentIndexInfo?.name || selectedIndex}
                  stroke={currentIndexInfo?.color || '#e74c3c'}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 1 }}
                />
              )}
            </LineChart>
          ) : (
            <AreaChart
              data={processedChartData}
              margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
            >
              <defs>
                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--heroui-primary-500))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--heroui-primary-500))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
                axisLine={false}
                tickLine={false}
                dx={-10}
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  if (name === "Portfolio Value") {
                    const dataPoint = props.payload;
                    const capitalChange = dataPoint.capitalChanges;
                    const startingCapital = dataPoint.startingCapital;
                    const plPercentage = dataPoint.plPercentage;
                    const items = [
                      [formatCurrency(value), "Portfolio Value"],
                    ];
                    if (startingCapital !== undefined && startingCapital !== null) {
                      items.push([formatCurrency(startingCapital), "Starting Capital"]);
                    }
                    if (capitalChange !== undefined && capitalChange !== 0) {
                      items.push([formatCurrency(capitalChange), capitalChange > 0 ? "Deposit" : "Withdrawal"]);
                    }
                    if (plPercentage !== undefined && plPercentage !== null) {
                      items.push([`${plPercentage.toFixed(2)}%`, "Monthly P/L %"]);
                    }
                    return items;
                  }
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "hsl(var(--heroui-content1))",
                  border: "1px solid hsl(var(--heroui-divider))",
                  borderRadius: "8px",
                  padding: "8px 12px"
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="capital"
                name="Portfolio Value"
                stroke="hsl(var(--heroui-primary))"
                fillOpacity={1}
                fill="url(#colorCapital)"
                strokeWidth={2}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </AreaChart>
          )
        ) : (
          showIndexComparison ? (
            <LineChart
              data={processedChartData}
              margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                dy={10}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                axisLine={false}
                tickLine={false}
                dx={-10}
                width={60}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const dataPoint = props.payload;
                  const items = [];

                  if (name === "Portfolio P&L %") {
                    items.push([`${value.toFixed(2)}%`, "Cumulative Performance"]);
                    if (dataPoint.pl) {
                      items.push([formatCurrency(dataPoint.pl), "Monthly P&L"]);
                    }
                    if (dataPoint.plPercentage !== undefined) {
                      items.push([`${dataPoint.plPercentage.toFixed(2)}%`, "Monthly Return"]);
                    }
                  }

                  if (name === currentIndexInfo?.name) {
                    items.push([`${value.toFixed(2)}%`, currentIndexInfo.name]);
                    if (dataPoint.indexValue) {
                      items.push([dataPoint.indexValue.toFixed(2), "Index Value"]);
                    }
                  }

                  return items;
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "hsl(var(--heroui-content1))",
                  border: "1px solid hsl(var(--heroui-divider))",
                  borderRadius: "8px",
                  padding: "8px 12px"
                }}
              />
              <Line
                type="monotone"
                dataKey="cummPf"
                name="Portfolio P&L %"
                stroke="hsl(var(--heroui-success))"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
              {showIndexComparison && (
                <Line
                  type="monotone"
                  dataKey="indexPercentage"
                  name={currentIndexInfo?.name || selectedIndex}
                  stroke={currentIndexInfo?.color || '#e74c3c'}
                  strokeWidth={2}
                  connectNulls={true}
                  dot={{ r: 3, strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 1 }}
                />
              )}
            </LineChart>
          ) : (
            <AreaChart
              data={processedChartData}
              margin={{ top: 10, right: 30, left: 30, bottom: 30 }}
            >
              <defs>
                <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--heroui-success-500))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--heroui-success-500))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--heroui-divider))" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tickFormatter={(value) => `${value.toFixed(0)}%`}
                axisLine={false}
                tickLine={false}
                dx={-10}
                width={80}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  if (name === "P&L Percentage") {
                    const dataPoint = props.payload;
                    const items = [
                      [`${value.toFixed(2)}%`, "P&L Percentage"],
                    ];
                    if (dataPoint.pl !== undefined && dataPoint.pl !== null) {
                      items.push([formatCurrency(dataPoint.pl), "Total P&L"]);
                    }
                    if (dataPoint.startingCapital !== undefined && dataPoint.startingCapital !== null) {
                      items.push([formatCurrency(dataPoint.startingCapital), "Starting Capital"]);
                    }
                    return items;
                  }
                  return [`${value.toFixed(2)}%`, name];
                }}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "hsl(var(--heroui-content1))",
                  border: "1px solid hsl(var(--heroui-divider))",
                  borderRadius: "8px",
                  padding: "8px 12px"
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="plPercentage"
                name="P&L Percentage"
                stroke="hsl(var(--heroui-success))"
                fillOpacity={1}
                fill="url(#colorPL)"
                strokeWidth={2}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </AreaChart>
          )
        )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};