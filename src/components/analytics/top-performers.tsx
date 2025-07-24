import React, { useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { Trade } from "../../types/trade";
import { useTopPerformers } from "../../hooks/use-top-performers";
import { useAccountingMethodDisplay } from "../../hooks/use-accounting-calculations";
import { MetricType, isPositiveValue, isNegativeValue } from "../../utils/topPerformersUtils";

interface TopPerformerStatProps {
  label: string;
  value: string;
  stock?: string;
  date?: string;
  isPositive?: boolean;
  isNegative?: boolean;
  index?: number;
}

// Format a date string to a readable format
function formatDate(dateString: string) {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    });
  } catch {
    return dateString;
  }
}

const TopPerformerStat: React.FC<TopPerformerStatProps> = ({
  label,
  value,
  stock,
  date,
  isPositive = false,
  isNegative = false,
  index = 0
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getValueColor = () => {
    if (isPositive) return 'text-success-600 dark:text-success-400';
    if (isNegative) return 'text-danger-600 dark:text-danger-400';
    return 'text-foreground-800 dark:text-white';
  };

  const getGradientColor = () => {
    if (isPositive) return 'from-success-500/5';
    if (isNegative) return 'from-danger-500/5';
    return 'from-primary-500/5';
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Animated gradient background */}
      <motion.div
        className={`absolute inset-0 bg-gradient-to-r ${getGradientColor()} via-transparent to-transparent`}
        initial={{ x: "-100%" }}
        animate={{ x: isHovered ? "0%" : "-100%" }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      />

      <motion.div
        className="relative flex flex-col gap-2 px-3 py-2.5 bg-content2 dark:bg-gray-900 border border-foreground-200/10 dark:border-gray-800 backdrop-blur-sm"
        whileHover={{ x: 4, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        {/* Header with label and value */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground-700 dark:text-gray-300">
            {label}
          </span>

          <motion.div
            className={`font-bold text-xl tracking-tight ${getValueColor()}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            layout
            style={{
              fontFeatureSettings: '"tnum" 1', // Tabular numbers for better alignment
              letterSpacing: '-0.025em' // Tighter letter spacing
            }}
          >
            {value}
          </motion.div>
        </div>

        {/* Trade details */}
        {(stock || date) && (
          <motion.div
            className="flex items-center justify-between text-xs border-t border-foreground-100/50 dark:border-gray-800/50 pt-2"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.2 }}
          >
            {stock && (
              <div className="flex items-center gap-2">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Icon icon="lucide:trending-up" className="w-3 h-3 text-foreground-400 dark:text-gray-500" />
                </motion.div>
                <span className="font-semibold text-foreground-700 dark:text-gray-300 truncate tracking-wide">
                  {stock}
                </span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-1.5">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Icon icon="lucide:calendar" className="w-3 h-3 text-foreground-400 dark:text-gray-500" />
                </motion.div>
                <span className="text-foreground-500 dark:text-gray-500 font-medium">
                  {formatDate(date)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};

interface TopPerformersProps {
  trades: Trade[];
}

export const TopPerformers: React.FC<TopPerformersProps> = ({ trades }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('stockMove');
  const { displayName } = useAccountingMethodDisplay();

  const hookResult = useTopPerformers(trades, selectedMetric);

  // Add error handling for hook result
  if (!hookResult) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-danger-500">Error loading top performers hook</div>
      </div>
    );
  }

  const {
    topPerformers,
    availableMetrics,
    getMetricLabel,
    getMetricValue,
    getFormattedValue,
    isLoading,
    error
  } = hookResult;

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-foreground-500">Loading top performers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-danger-500">{error}</div>
      </div>
    );
  }

  const { highest, lowest, hasMultipleTrades } = topPerformers;

  // Fallback function for metric labels
  const getMetricLabelSafe = (metricType: MetricType): string => {
    try {
      if (getMetricLabel && typeof getMetricLabel === 'function') {
        return getMetricLabel(metricType);
      }
    } catch (error) {
      // Debug logging removed for production
    }

    // Fallback labels
    switch (metricType) {
      case 'stockMove': return 'Stock Move';
      case 'pfImpact': return 'Portfolio Impact';
      case 'rewardRisk': return 'Risk:Reward';
      case 'plRs': return 'P/L (₹)';
      default: return 'Unknown';
    }
  };

  // Helper function to render a performer stat
  const renderPerformerStat = (trade: Trade, label: string, index: number) => {
    try {
      const value = getMetricValue ? getMetricValue(trade, selectedMetric) : 0;
      const formattedValue = getFormattedValue ? getFormattedValue(trade, selectedMetric) : '0';
      const isPositive = isPositiveValue(value, selectedMetric);
      const isNegative = isNegativeValue(value, selectedMetric);

      return (
        <TopPerformerStat
          key={`${trade.id}-${index}`}
          label={label || 'Unknown'}
          value={formattedValue}
          stock={trade.name || 'Unknown'}
          date={trade.date}
          isPositive={isPositive}
          isNegative={isNegative}
          index={index}
        />
      );
    } catch (error) {
      console.error('Error rendering performer stat:', error);
      return (
        <div key={`error-${index}`} className="p-4 text-danger-500 text-sm">
          Error rendering trade data
        </div>
      );
    }
  };

  // Handle empty state
  if (!highest && !lowest) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Icon icon="lucide:bar-chart-3" className="w-8 h-8 text-foreground-400 mx-auto mb-2" />
          <div className="text-sm text-foreground-500">No trades found for the selected period</div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Header with metric selector */}
      <div className="flex items-center justify-end">

        {/* Sleek metric selector */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="flat"
                size="sm"
                className="bg-content2 dark:bg-gray-900 text-foreground dark:text-white min-w-[140px] h-9 border border-foreground-200/10 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                endContent={
                  <motion.div
                    animate={{ rotate: 0 }}
                    whileHover={{ rotate: 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon icon="lucide:chevron-down" className="text-sm dark:text-gray-400" />
                  </motion.div>
                }
              >
                {getMetricLabelSafe(selectedMetric)}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Metric selection"
              className="dark:bg-gray-900"
              selectedKeys={[selectedMetric]}
              selectionMode="single"
              onSelectionChange={(keys) => setSelectedMetric(Array.from(keys)[0] as MetricType)}
            >
              {availableMetrics.map((metric) => (
                <DropdownItem
                  key={metric}
                  textValue={getMetricLabelSafe(metric)}
                  className="dark:text-white dark:hover:bg-gray-800"
                >
                  {getMetricLabelSafe(metric)}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </motion.div>
      </div>

      {/* Performers stats */}
      <div className="space-y-2">
        <AnimatePresence mode="wait">
          {hasMultipleTrades ? (
            // Show highest and lowest when multiple trades exist
            <motion.div
              key="multiple-trades"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {highest && renderPerformerStat(highest, `Highest ${getMetricLabelSafe(selectedMetric)}`, 0)}
              {lowest && renderPerformerStat(lowest, `Lowest ${getMetricLabelSafe(selectedMetric)}`, 1)}
            </motion.div>
          ) : (
            // Show single trade information
            <motion.div
              key="single-trade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {highest && renderPerformerStat(highest, getMetricLabelSafe(selectedMetric), 0)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};