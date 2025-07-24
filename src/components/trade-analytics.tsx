import React, { Suspense, useMemo, useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Button,
  ButtonGroup,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Tabs,
  Tab
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useTrades } from "../hooks/use-trades";
import { useDashboardConfig } from "../hooks/use-dashboard-config";
import { pageVariants, cardVariants, fadeInVariants } from "../utils/animations";
import { useAnalyticsCalculations, AnalyticsCalculationResult } from "../hooks/calculations/useAnalyticsCalculations";
import { useAccountingMethod } from "../context/AccountingMethodContext";
import { useTruePortfolioWithTrades } from "../hooks/use-true-portfolio-with-trades";
import { calculateTradePL } from "../utils/accountingUtils";
import { Loader } from "./Loader";
import { useGlobalFilter } from "../context/GlobalFilterContext";
import { Trade } from "../types/trade";
import {
  calcPerformanceMetrics,
  calcSetupPerformance,
  calcTopPerformers,
  calculateDailyPortfolioValues,
  calculateMaxDrawdown,
  calculateDailyReturns,
  calculateStandardDeviation,
  calculateSharpeRatio,
  calculateCalmarRatio,
  calculateSortinoRatio,
  annualizeMetric,
  safeCalculation
} from "../lib/calculations";
// IMPORTANT: This solution uses a tiny helper for persistent caching.
// Please ensure you have run `npm install idb-keyval` or `yarn add idb-keyval`.
import { get, set } from 'idb-keyval';

/**
 * Standalone analytics calculation function for caching
 * This mirrors the logic from useAnalyticsCalculations but without React hooks
 */
function calculateAnalytics(
  trades: Trade[],
  capitalChanges: any[] = [],
  portfolioSize: number = 100000,
  useCashBasis: boolean = false,
  riskFreeRate: number = 0.05
): AnalyticsCalculationResult {
  if (!trades || trades.length === 0) {
    return {
      performanceMetrics: {
        totalTrades: 0,
        winRate: 0,
        avgGain: 0,
        avgLoss: 0,
        avgPosMove: 0,
        avgNegMove: 0,
        avgPositionSize: 0,
        avgHoldingDays: 0,
        avgR: 0,
        planFollowed: 0,
        openPositions: 0,
        expectancy: 0,
        profitFactor: 0,
        maxWinStreak: 0,
        maxLossStreak: 0
      },
      riskMetrics: {
        maxDrawdown: 0,
        volatility: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        sortinoRatio: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0
      },
      setupPerformance: [],
      topPerformers: {
        byStockMove: { highest: null, lowest: null, hasMultipleTrades: false },
        byPfImpact: { highest: null, lowest: null, hasMultipleTrades: false },
        byRewardRisk: { highest: null, lowest: null, hasMultipleTrades: false },
        byPlRs: { highest: null, lowest: null, hasMultipleTrades: false }
      }
    };
  }

  try {
    // Performance metrics
    const performanceMetrics = safeCalculation(
      () => calcPerformanceMetrics(trades, useCashBasis),
      {
        totalTrades: 0,
        winRate: 0,
        avgGain: 0,
        avgLoss: 0,
        avgPosMove: 0,
        avgNegMove: 0,
        avgPositionSize: 0,
        avgHoldingDays: 0,
        avgR: 0,
        planFollowed: 0,
        openPositions: 0,
        expectancy: 0,
        profitFactor: 0,
        maxWinStreak: 0,
        maxLossStreak: 0
      },
      'Failed to calculate performance metrics'
    );

    // Risk metrics calculation
    const dailyPortfolioValues = safeCalculation(
      () => calculateDailyPortfolioValues(trades, capitalChanges, useCashBasis),
      new Map(),
      'Failed to calculate daily portfolio values'
    );

    const maxDrawdown = safeCalculation(
      () => calculateMaxDrawdown(dailyPortfolioValues),
      0,
      'Failed to calculate max drawdown'
    );

    const dailyReturns = safeCalculation(
      () => {
        if (!dailyPortfolioValues || dailyPortfolioValues.size === 0) {
          return [];
        }
        return calculateDailyReturns(dailyPortfolioValues);
      },
      [],
      'Failed to calculate daily returns'
    );

    const volatility = safeCalculation(
      () => {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
          return 0;
        }
        return calculateStandardDeviation(dailyReturns);
      },
      0,
      'Failed to calculate volatility'
    );

    const sharpeRatio = safeCalculation(
      () => {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
          return 0;
        }
        return calculateSharpeRatio(dailyReturns, riskFreeRate);
      },
      0,
      'Failed to calculate Sharpe ratio'
    );

    const calmarRatio = safeCalculation(
      () => {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0 || maxDrawdown === 0) {
          return 0;
        }
        return calculateCalmarRatio(dailyReturns, maxDrawdown);
      },
      0,
      'Failed to calculate Calmar ratio'
    );

    const sortinoRatio = safeCalculation(
      () => {
        if (!Array.isArray(dailyReturns) || dailyReturns.length === 0) {
          return 0;
        }
        return calculateSortinoRatio(dailyReturns, riskFreeRate);
      },
      0,
      'Failed to calculate Sortino ratio'
    );

    // Calculate annualized metrics
    const avgDailyReturn = Array.isArray(dailyReturns) && dailyReturns.length > 0
      ? dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
      : 0;

    const annualizedReturn = safeCalculation(
      () => annualizeMetric(avgDailyReturn, 252),
      0,
      'Failed to calculate annualized return'
    );

    const annualizedVolatility = safeCalculation(
      () => annualizeMetric(volatility, 252),
      0,
      'Failed to calculate annualized volatility'
    );

    const riskMetrics = {
      maxDrawdown,
      volatility,
      sharpeRatio,
      calmarRatio,
      sortinoRatio,
      annualizedReturn,
      annualizedVolatility
    };

    // Setup performance
    const setupPerformance = safeCalculation(
      () => calcSetupPerformance(trades, useCashBasis),
      [],
      'Failed to calculate setup performance'
    );

    // Top performers
    const topPerformers = safeCalculation(
      () => calcTopPerformers(trades, useCashBasis),
      {
        byStockMove: { highest: null, lowest: null, hasMultipleTrades: false },
        byPfImpact: { highest: null, lowest: null, hasMultipleTrades: false },
        byRewardRisk: { highest: null, lowest: null, hasMultipleTrades: false },
        byPlRs: { highest: null, lowest: null, hasMultipleTrades: false }
      },
      'Failed to calculate top performers'
    );

    return {
      performanceMetrics,
      riskMetrics,
      setupPerformance,
      topPerformers
    };

  } catch (error) {
    console.error('Error in calculateAnalytics:', error);
    // Return empty structure on error
    return {
      performanceMetrics: {
        totalTrades: 0,
        winRate: 0,
        avgGain: 0,
        avgLoss: 0,
        avgPosMove: 0,
        avgNegMove: 0,
        avgPositionSize: 0,
        avgHoldingDays: 0,
        avgR: 0,
        planFollowed: 0,
        openPositions: 0,
        expectancy: 0,
        profitFactor: 0,
        maxWinStreak: 0,
        maxLossStreak: 0
      },
      riskMetrics: {
        maxDrawdown: 0,
        volatility: 0,
        sharpeRatio: 0,
        calmarRatio: 0,
        sortinoRatio: 0,
        annualizedReturn: 0,
        annualizedVolatility: 0
      },
      setupPerformance: [],
      topPerformers: {
        byStockMove: { highest: null, lowest: null, hasMultipleTrades: false },
        byPfImpact: { highest: null, lowest: null, hasMultipleTrades: false },
        byRewardRisk: { highest: null, lowest: null, hasMultipleTrades: false },
        byPlRs: { highest: null, lowest: null, hasMultipleTrades: false }
      }
    };
  }
}

// Lazy load analytics components. NO CHANGES ARE REQUIRED IN THESE FILES.
const PerformanceMetrics = React.lazy(() => import("./analytics/performance-metrics").then(module => ({ default: module.PerformanceMetrics })));
const TradeStatistics = React.lazy(() => import("./analytics/trade-statistics").then(module => ({ default: module.TradeStatistics })));
const TopPerformers = React.lazy(() => import("./analytics/top-performers").then(module => ({ default: module.TopPerformers })));
const PerformanceChart = React.lazy(() => import("./analytics/performance-chart").then(module => ({ default: module.PerformanceChart })));


// ===================================================================================
// === MAIN COMPONENT (STABLE, CACHED, FLICKER-FREE, AND SELF-CONTAINED)
// ===================================================================================
export const TradeAnalytics = React.memo(function TradeAnalytics() {
  // --- HOOKS & STATE SETUP ---

  // WORLD-CLASS ARCHITECTURE: Use declarative hook (TanStack Query handles caching automatically)
  // Use 'trades' instead of 'originalTrades' to get the cash basis expanded trades
  const { trades: processedTrades } = useTrades();

  const { dashboardConfig, toggleWidgetVisibility } = useDashboardConfig();
  const { globalFilter } = useGlobalFilter();
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';
  
  // This is the component's single source of truth for the analytics results and loading state.
  const [analyticsResult, setAnalyticsResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // State from original code, preserved as requested.
  const [selectedView, setSelectedView] = useState("performance");
  const [chartData, setChartData] = useState([]);
  const handleChartDataUpdate = useCallback((data) => { setChartData(data); }, []);




  // --- DATA PROCESSING & PERFORMANCE OPTIMIZATION ---

  // WORLD-CLASS ARCHITECTURE: Use processed trades that already have cash basis expansion
  const trades = useMemo(() => {
    return processedTrades?.map(trade => ({ ...trade })) || [];
  }, [processedTrades]);

  // Get portfolio functions for YTD calculation (after trades is defined)
  const { getAllMonthlyTruePortfolios } = useTruePortfolioWithTrades(trades);

  // Calculate YTD percentage using the same logic as other components
  const ytdPercentage = useMemo(() => {
    try {
      const currentYear = new Date().getFullYear();
      const monthlyPortfolios = getAllMonthlyTruePortfolios();

      if (!monthlyPortfolios || monthlyPortfolios.length === 0) return 0;

      // Filter for current year only
      const currentYearPortfolios = monthlyPortfolios.filter(mp => mp.year === currentYear);

      if (currentYearPortfolios.length === 0) return 0;

      // Calculate YTD cumulative performance using same logic as stablePercentPF
      let ytdCummPf = 0;

      currentYearPortfolios.forEach(monthData => {
        // Get trades for this month to apply the same fallback logic
        const monthTrades = trades.filter(trade => {
          if (!trade.date) return false;
          const tradeDate = new Date(trade.date);
          if (isNaN(tradeDate.getTime())) return false;
          const tradeMonth = tradeDate.toLocaleString('default', { month: 'short' });
          const tradeYear = tradeDate.getFullYear();
          return tradeMonth === monthData.month && tradeYear === monthData.year;
        });

        // Apply fallback P/L calculation if needed
        let actualPL = monthData.pl;
        if (monthTrades.length > 0 && monthData.pl === 0) {
          actualPL = monthTrades.reduce((sum, trade) => {
            return sum + calculateTradePL(trade, useCashBasis);
          }, 0);
        }

        // Calculate monthly return percentage
        const effectiveCapital = monthData.effectiveStartingCapital || 0;
        const monthlyReturn = (effectiveCapital !== 0 && isFinite(effectiveCapital) && isFinite(actualPL))
          ? (actualPL / effectiveCapital) * 100
          : 0;

        // Add to YTD cumulative performance
        if (isFinite(monthlyReturn)) {
          ytdCummPf += monthlyReturn;
        }
      });

      return ytdCummPf;
    } catch (error) {
      return 0;
    }
  }, [trades, getAllMonthlyTruePortfolios, useCashBasis]);

  // 1. Apply the global filter first. This is memoized for performance.
  const filteredTrades = useMemo(() => {
    if (!globalFilter || typeof globalFilter.fn !== 'function') return trades;
    return trades.filter(globalFilter.fn);
  }, [trades, globalFilter]);

  // 2. We'll calculate analytics on-demand using the standalone function

  // 3. This is the "Orchestrator Effect". It manages caching and state to prevent flickering.
  useEffect(() => {
    // This effect runs whenever the user changes the global filter (which changes filteredTrades).
    let isCancelled = false;

    const manageAnalytics = async () => {
      if (trades.length === 0) {
        // No trades at all
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Create a unique fingerprint for the full dataset (not filtered)
      const lastTradeDate = new Date(trades[trades.length - 1].date).getTime();
      const cacheKey = `analytics-${trades.length}-${lastTradeDate}`;

      try {
        // Check the persistent cache first.
        const cachedResult = await get(cacheKey);

        if (cachedResult) {
          // CACHE HIT: Found a matching result in the cache.
          if (!isCancelled) {
            setAnalyticsResult(cachedResult);
          }
        } else {
          // CACHE MISS: No matching result found.
          // Calculate the result and save it for next time.
          const calculatedResult = calculateAnalytics(trades, [], 10000000, useCashBasis);
          if (!isCancelled) {
            setAnalyticsResult(calculatedResult);
            // Asynchronously save to the cache without blocking the UI.
            await set(cacheKey, calculatedResult);
          }
        }
      } catch (error) {
        console.error("Cache management failed, calculating fresh data:", error);
        // If caching fails, calculate fresh data to ensure the app doesn't crash.
        if (!isCancelled) {
          const fallbackResult = calculateAnalytics(trades, [], 10000000, useCashBasis);
          setAnalyticsResult(fallbackResult);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    manageAnalytics();

    return () => {
      // Cleanup function to prevent state updates on unmounted components.
      isCancelled = true;
    };
  }, [trades, useCashBasis]); // Only depend on stable values that actually change

  
  // --- UI ---
  const getWidgetVisibility = (id) => dashboardConfig.find(widget => widget.id === id)?.isVisible;
  const lastPlPercentage = chartData?.length > 0 ?
    (isFinite(chartData[chartData.length - 1].plPercentage) ? chartData[chartData.length - 1].plPercentage : 0) : 0;
  
  return (
    <motion.div className="space-y-6" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {/* --- HEADER --- */}
      <motion.div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" variants={fadeInVariants}>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Analytics Dashboard</h2>
        <Dropdown placement="bottom-end">
          <DropdownTrigger><Button variant="flat" startContent={<Icon icon="lucide:customize" />} size="sm" radius="full">Customize Dashboard</Button></DropdownTrigger>
          <DropdownMenu aria-label="Customize Dashboard" closeOnSelect={false} selectionMode="multiple" selectedKeys={new Set(dashboardConfig.filter(w => w.isVisible).map(w => w.id))} onSelectionChange={(keys) => { const selectedIds = new Set(Array.from(keys)); dashboardConfig.forEach(widget => { const newVisibility = selectedIds.has(widget.id); if (widget.isVisible !== newVisibility) toggleWidgetVisibility(widget.id); }); }}>
            {dashboardConfig.map((widget) => (<DropdownItem key={widget.id} textValue={widget.name}>{widget.name}</DropdownItem>))}
          </DropdownMenu>
        </Dropdown>
      </motion.div>
      
      {/* --- DASHBOARD WRAPPER with STABLE LOADER --- */}
      <div className="relative">
        <AnimatePresence>
          {isLoading && (
            <motion.div key="loader" className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg" style={{minHeight: '500px'}} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader message="Calculating analytics..." />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div key="dashboard-content" initial={false} animate={{ opacity: isLoading ? 0.5 : 1 }} transition={{ duration: 0.3 }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {getWidgetVisibility('portfolio-performance') && (
                  <motion.div className="lg:col-span-2" variants={cardVariants}>
                    <Card>
                      <CardHeader className="flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl font-semibold tracking-tight">Portfolio Performance</h3>
                          <div className="flex items-center gap-3">
                            <motion.div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${ytdPercentage >= 0 ? 'bg-success/10' : 'bg-danger/10'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <Icon icon={ytdPercentage >= 0 ? "lucide:trending-up" : "lucide:trending-down"} className={ytdPercentage >= 0 ? "text-success" : "text-danger"} />
                              <span className={`text-sm font-medium ${ytdPercentage >= 0 ? 'text-success' : 'text-danger'}`}>
                                {ytdPercentage !== 0 ? `${ytdPercentage > 0 ? '+' : ''}${ytdPercentage.toFixed(2)}%` : '0.00%'}
                              </span>
                            </motion.div>
                            <span className="text-sm text-default-500 font-medium">YTD</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <Suspense fallback={<Loader size="sm" />}><PerformanceChart trades={filteredTrades} onDataUpdate={handleChartDataUpdate} selectedView={selectedView} /></Suspense>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}
                {getWidgetVisibility('performance-metrics') && (
                  <motion.div variants={cardVariants}>
                    <Card>
                      <CardHeader><h3 className="text-xl font-semibold tracking-tight">Performance Metrics</h3></CardHeader>
                      <CardBody><Suspense fallback={<Loader size="sm" />}><PerformanceMetrics trades={filteredTrades} isEditing={false} /></Suspense></CardBody>
                    </Card>
                  </motion.div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {getWidgetVisibility('trade-statistics') && (
                  <motion.div variants={cardVariants}>
                    <Card>
                      <CardHeader><h3 className="text-xl font-semibold tracking-tight">Trade Statistics</h3></CardHeader>
                      <Divider />
                      <CardBody><Suspense fallback={<Loader size="sm" />}><TradeStatistics trades={filteredTrades} /></Suspense></CardBody>
                    </Card>
                  </motion.div>
                )}
                {getWidgetVisibility('top-performers') && (
                  <motion.div variants={cardVariants}>
                    <Card>
                      <CardHeader><h3 className="text-xl font-semibold tracking-tight">Top Performers</h3></CardHeader>
                      <Divider />
                      <CardBody><Suspense fallback={<Loader size="sm" />}><TopPerformers trades={filteredTrades} /></Suspense></CardBody>
                    </Card>
                  </motion.div>
                )}
            </div>
        </motion.div>
      </div>
    </motion.div>
  );
});

export default TradeAnalytics;