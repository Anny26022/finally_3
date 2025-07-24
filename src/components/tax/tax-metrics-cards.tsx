import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { Trade } from "../../types/trade";
import { useTrades } from "../../hooks/use-trades";
import { useAccountingCalculations, useAccountingMethodDisplay } from "../../hooks/use-accounting-calculations";
import { calculateTradePL } from "../../utils/accountingUtils";

export const TaxMetricsCards: React.FC<{ isEditMode: boolean }> = ({ isEditMode }) => {
  const { trades } = useTrades();
  const {
    totalTrades,
    winRate,
    grossPL,
    useCashBasis
  } = useAccountingCalculations(trades);

  // PERFORMANCE: Stabilize trades reference to prevent constant recalculation
  const tradesHash = React.useMemo(() => {
    return trades.map(t => `${t.id}-${t.positionStatus}-${t.cummPf || 0}`).join('|');
  }, [trades]);

  // Calculate actual metrics using the same logic as drawdown breakdown
  const metricsCalculation = React.useMemo(() => {
    // PERFORMANCE: Early return if no trades to prevent unnecessary calculations
    if (!trades || trades.length === 0) {
      return {
        maxCumulativePerformance: 0,
        minCumulativePerformance: 0,
        maxDrawdown: 0,
        currentCumulativePerformance: 0
      };
    }

    // Filter trades for current year and closed/partial positions
    const currentYear = new Date().getFullYear().toString();
    let tradesForYear = trades.filter(t => t.date.startsWith(currentYear));

    // For cash basis, deduplicate trades to avoid double counting
    if (useCashBasis) {
      const seenTradeIds = new Set();
      const beforeDedup = tradesForYear.length;
      tradesForYear = tradesForYear.filter(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) return false;
        seenTradeIds.add(originalId);
        return true;
      });
    }

    const closedTrades = tradesForYear
      .filter(t => t.positionStatus === "Closed" || t.positionStatus === "Partial")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (closedTrades.length === 0) {
      return {
        maxCumulativePerformance: 0,
        minCumulativePerformance: 0,
        maxDrawdown: 0,
        currentCumulativePerformance: 0
      };
    }

    const cummPfs = closedTrades.map(t => t.cummPf).filter(v => typeof v === 'number' && !isNaN(v));

    // Calculate drawdown using the same logic as drawdown breakdown
    let runningMax = cummPfs.length > 0 ? cummPfs[0] : 0;
    let maxDrawdownPoints = 0;

    cummPfs.forEach(pf => {
      if (pf > runningMax) runningMax = pf;
      if (runningMax > 0) {
        const ddPoints = runningMax - pf;
        if (ddPoints > maxDrawdownPoints) maxDrawdownPoints = ddPoints;
      }
    });

    // Calculate current drawdown from peak (not max drawdown)
    const currentCummPF = cummPfs.length ? cummPfs[cummPfs.length - 1] : 0;
    const maxCummPF = cummPfs.length ? Math.max(...cummPfs) : 0;
    const minCummPF = cummPfs.length ? Math.min(...cummPfs) : 0;

    // CRITICAL FIX: Ensure drawdown calculation handles negative PF values correctly
    // If current PF is negative and max PF is also negative, we might still be in drawdown
    let currentDrawdownFromPeak = 0;
    if (cummPfs.length > 0) {
      if (maxCummPF > currentCummPF) {
        currentDrawdownFromPeak = maxCummPF - currentCummPF;
      }
      // Special case: if all PFs are negative, we're always in drawdown from 0
      else if (maxCummPF <= 0 && currentCummPF < 0) {
        currentDrawdownFromPeak = Math.abs(currentCummPF);
      }
    }

    return {
      maxCumulativePerformance: maxCummPF,
      minCumulativePerformance: minCummPF,
      maxDrawdown: maxDrawdownPoints, // Maximum drawdown ever experienced
      currentDrawdownFromPeak: currentDrawdownFromPeak, // Current drawdown from peak
      currentCumulativePerformance: currentCummPF
    };
  }, [tradesHash, useCashBasis]); // PERFORMANCE: Use stable hash instead of trades array

  const { maxCumulativePerformance, minCumulativePerformance, maxDrawdown, currentDrawdownFromPeak, currentCumulativePerformance } = metricsCalculation;
  const { displayName, description } = useAccountingMethodDisplay();

  // If you have taxes in Trade, subtract here. For now, netPL = grossPL
  const netPL = grossPL;

  // PERFORMANCE: Memoize tooltip content to prevent flickering
  const tooltipContent = React.useMemo(() => ({
    maxCummPF: (
      <div className="max-w-xs p-2 space-y-2 text-sm">
        <p className="font-medium text-default-600">Maximum Cumulative Profit Factor</p>
        <p>The highest point your cumulative profit factor reached during this period.</p>
        <div className="space-y-1">
          <p className="font-medium">What it means:</p>
          <p>• Higher values indicate stronger performance peaks</p>
          <p>• Shows your best momentum in the market</p>
          <p>• Helps identify optimal trading conditions</p>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Tip: Use this as a benchmark for your trading potential
        </p>
      </div>
    ),
    minCummPF: (
      <div className="max-w-xs p-2 space-y-2 text-sm">
        <p className="font-medium text-default-600">Minimum Cumulative Profit Factor</p>
        <p>The lowest point your cumulative profit factor reached during this period.</p>
        <div className="space-y-1">
          <p className="font-medium">What it means:</p>
          <p>• Shows your worst performance period</p>
          <p>• Helps identify challenging market conditions</p>
          <p>• Useful for risk management planning</p>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Tip: Learn from these periods to improve your strategy
        </p>
      </div>
    ),
    drawdown: (
      <div className="max-w-xs p-2 space-y-2 text-sm">
        <p className="font-medium text-default-600">Current Drawdown</p>
        <p>The decline from your peak cumulative profit factor to the current level.</p>
        <div className="space-y-1">
          <p className="font-medium">What it means:</p>
          <p>• 0% = At peak performance</p>
          <p>• Higher % = Further from peak</p>
          <p>• Helps track recovery progress</p>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Tip: Monitor this to manage risk and expectations
        </p>
      </div>
    ),
    totalTaxes: (
      <div className="max-w-xs p-2 space-y-2 text-sm">
        <p className="font-medium text-default-600">Total Taxes</p>
        <p>Estimated tax liability on your trading profits.</p>
        <div className="space-y-1">
          <p className="font-medium">Important:</p>
          <p>• This is an estimate only</p>
          <p>• Consult a tax professional</p>
          <p>• Actual taxes may vary</p>
        </div>
        <p className="text-xs text-default-400 mt-2">
          Tip: Set aside funds for tax obligations
        </p>
      </div>
    )
  }), []); // Empty dependency array - content never changes

  // PERFORMANCE: Memoize helper function to prevent re-creation
  const formatDrawdown = React.useCallback((drawdown: number) => {
    // CRITICAL FIX: Use a small threshold instead of exact 0 to handle floating point precision
    if (drawdown < 0.001) {
      return "🚀 Hurray! Flying high";
    }
    // Display as negative percentage to match drawdown breakdown format
    return `-${drawdown.toFixed(2)}%`;
  }, []);

  return (
    <div className="space-y-4">
      {/* Portfolio Performance Metrics - Accounting Method Aware */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-foreground-700 dark:text-foreground-300">
            Portfolio Performance
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            useCashBasis
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
          }`}>
            {useCashBasis ? 'Cash Basis' : 'Accrual Basis'}
          </span>
        </div>
        <p className="text-sm text-foreground-500 dark:text-foreground-400 mb-4">
          {useCashBasis
            ? "Portfolio performance calculated based on trade exit dates (when P/L is realized)"
            : "Portfolio performance calculated based on trade entry dates (including unrealized P/L)"
          }
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Max Cumm PF"
            value={`${maxCumulativePerformance.toFixed(2)}%`}
            icon="lucide:trending-up"
            color="success"
            change=""
            isPositive={maxCumulativePerformance >= 0}
            isEditMode={isEditMode}
          />
          <MetricCard
            title="Min Cumm PF"
            value={`${minCumulativePerformance.toFixed(2)}%`}
            icon="lucide:trending-down"
            color="danger"
            change=""
            isPositive={minCumulativePerformance >= 0}
            isEditMode={isEditMode}
          />
          <MetricCard
            title="Drawdown"
            value={formatDrawdown(currentDrawdownFromPeak)}
            icon={currentDrawdownFromPeak < 0.001 ? "lucide:rocket" : "lucide:arrow-down"}
            color={currentDrawdownFromPeak < 0.001 ? "success" : "warning"}
            change=""
            isPositive={currentDrawdownFromPeak < 0.001}
            isEditMode={isEditMode}
          />
          <MetricCard
            title="Current PF"
            value={`${currentCumulativePerformance.toFixed(2)}%`}
            icon="lucide:bar-chart-3"
            color="primary"
            change=""
            isPositive={currentCumulativePerformance >= 0}
            isEditMode={isEditMode}
          />
        </div>
      </div>

      {/* Trade Statistics */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground-700 dark:text-foreground-300">
          Trade Statistics
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Trades"
          value={totalTrades.toString()}
          icon="lucide:activity"
          color="primary"
          change=""
          isPositive={true}
          isEditMode={isEditMode}
        />
        <MetricCard
          title="Win Rate"
          value={winRate.toFixed(2) + '%'}
          icon="lucide:target"
          color="success"
          change=""
          isPositive={true}
          isEditMode={isEditMode}
        />
        <MetricCard
          title="Gross P/L"
          value={grossPL.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })}
          icon="lucide:trending-up"
          color="warning"
          change=""
          isPositive={grossPL >= 0}
          isEditMode={isEditMode}
        />
        <MetricCard
          title="Net P/L"
          value={netPL.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 })}
          icon="lucide:wallet"
          color="secondary"
          change=""
          isPositive={netPL >= 0}
          isEditMode={isEditMode}
        />
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  color: "primary" | "success" | "warning" | "secondary" | "danger";
  change: string;
  isPositive: boolean;
  isEditMode: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  change,
  isPositive,
  isEditMode
}) => {
  const [editValue, setEditValue] = React.useState(value);

  React.useEffect(() => {
    setEditValue(value);
  }, [value]);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <Card className="overflow-visible">
        <CardBody className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-default-500 text-sm mb-1">{title}</p>
              {isEditMode ? (
                <input
                  className="bg-transparent border-b border-primary-500 text-xl font-semibold focus:outline-none w-full"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              ) : (
                <p className="text-xl font-semibold">{value}</p>
              )}
              <div className={`flex items-center mt-2 text-xs ${isPositive ? 'text-success' : 'text-danger'}`}>
                <Icon icon={isPositive ? "lucide:trending-up" : "lucide:trending-down"} className="mr-1" />
                <span>{change} from last month</span>
              </div>
            </div>
            <div className={`p-2 rounded-lg bg-${color}-100 text-${color}-500`}>
              <Icon icon={icon} className="text-xl" />
            </div>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
};