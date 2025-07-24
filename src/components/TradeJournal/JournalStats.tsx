import React from 'react';
import { Card, CardBody, Button, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { Trade } from "../../types/trade";
import MobileTooltip from "../ui/MobileTooltip";
import {
  RealizedPLTooltip,
  UnrealizedPLTooltip,
  OpenHeatTooltip,
  PercentInvestedTooltip,
  LeverageWarningTooltip
} from "../EnhancedStatsTooltips";

interface JournalStatsProps {
  // Stats data - all 8 stats from original
  totalTrades: number;
  openPositions: number;
  winRate: number;
  totalRealizedPL: number;
  totalUnrealizedPL: number;
  openHeat: number;
  percentInvested: number;
  percentPF: number;

  // Processed trades for tooltip calculations
  processedTrades: Trade[];
  trades: Trade[];

  // Configuration
  useCashBasis: boolean;
  isStatsMasked: boolean;
  onToggleStatsMask: () => void;

  // Loading states
  isLoading?: boolean;
  isRecalculating?: boolean;
  statsLoaded?: boolean;

  // Formatting functions
  formatCurrency: (value: number) => string;
  maskValue: (value: string) => string;

  // Stats titles for customization
  statsTitle?: {
    totalTrades?: string;
    openPositions?: string;
    winRate?: string;
    totalPL?: string;
  };

  // Portfolio data for enhanced tooltips
  portfolioSize?: number;
  getAccountingAwareValues: (trade: any) => any;
  getTradeCalculation?: (id: string) => any;
  calcTradeOpenHeat?: (trade: any, portfolioSize: number, getPortfolioSize?: any) => number;
  getPortfolioSize?: (month: string, year: number) => number;
}

interface StatsCardProps {
  title: string;
  value: string;
  icon: string;
  color: "primary" | "success" | "warning" | "danger";
  isMasked?: boolean;
}

// Circular loader component
const CircularLoader: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = "text-gray-400" }) => (
  <>
    <style>{`
      @keyframes circular-dash {
        0% {
          stroke-dasharray: 1, 150;
          stroke-dashoffset: 0;
        }
        50% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -35;
        }
        100% {
          stroke-dasharray: 90, 150;
          stroke-dashoffset: -124;
        }
      }
    `}</style>
    <div className="inline-flex items-center justify-center">
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 50 50"
      >
        <circle
          className={color}
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            animation: 'circular-dash 1.5s ease-in-out infinite'
          }}
        />
      </svg>
    </div>
  </>
);

// Stats card component
const StatsCard: React.FC<StatsCardProps> = React.memo(function StatsCard({
  title,
  value,
  icon,
  color,
  isMasked = false
}) {
  const getColors = () => {
    switch (color) {
      case "primary":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/10",
          text: "text-blue-700 dark:text-blue-400",
          icon: "text-blue-600 dark:text-blue-400",
          loader: "text-blue-500"
        };
      case "success":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-900/10",
          text: "text-emerald-700 dark:text-emerald-400",
          icon: "text-emerald-600 dark:text-emerald-400",
          loader: "text-emerald-500"
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/10",
          text: "text-amber-700 dark:text-amber-400",
          icon: "text-amber-600 dark:text-amber-400",
          loader: "text-amber-500"
        };
      case "danger":
        return {
          bg: "bg-red-50 dark:bg-red-900/10",
          text: "text-red-700 dark:text-red-400",
          icon: "text-red-600 dark:text-red-400",
          loader: "text-red-500"
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-900/10",
          text: "text-gray-700 dark:text-gray-400",
          icon: "text-gray-600 dark:text-gray-400",
          loader: "text-gray-500"
        };
    }
  };

  const colors = getColors();

  return (
    <Card className="border border-gray-100 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900 min-w-[180px] max-w-[220px]">
      <CardBody className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              {title}
            </p>
            <p className={`text-2xl font-semibold tracking-tight ${colors.text}`}>
              {isMasked ? value.replace(/[₹$€£¥0-9.,]/g, '*').replace(/\*+/g, '****') : value}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${colors.bg} ${colors.icon}`}>
            <Icon icon={icon} className="text-xl" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
});

/**
 * JournalStats - Extracted stats component containing all trade statistics
 * 
 * ARCHITECTURAL BENEFITS:
 * - Single responsibility: Only handles stats display and calculations
 * - Isolated state: Stats changes only re-render this component
 * - Reusable: Can be used in different contexts (dashboard, reports, etc.)
 * - Testable: Easy to unit test individual stats calculations
 * - Performance: Memoized to prevent unnecessary re-renders
 */
export const JournalStats: React.FC<JournalStatsProps> = React.memo(function JournalStats({
  totalTrades,
  openPositions,
  winRate,
  totalRealizedPL,
  totalUnrealizedPL,
  openHeat,
  percentInvested,
  percentPF,
  processedTrades,
  trades,
  useCashBasis,
  getAccountingAwareValues,
  isStatsMasked,
  onToggleStatsMask,
  isLoading = false,
  isRecalculating = false,
  statsLoaded = true,
  formatCurrency,
  maskValue,
  portfolioSize,
  getTradeCalculation,
  calcTradeOpenHeat,
  getPortfolioSize,
  statsTitle = {
    totalTrades: "Total Trades",
    openPositions: "Open Positions",
    winRate: "Win Rate",
    totalPL: "Total P/L"
  }
}) {
  // First three stats (matches original exactly)
  const firstThreeStats = [
    {
      title: statsTitle.totalTrades || "Total Trades",
      value: totalTrades.toString(),
      icon: "lucide:list",
      color: "primary" as const,
      tooltip: `Total number of ${useCashBasis ? 'unique trades' : 'trades you have recorded'} matching current search/filter.`
    },
    {
      title: statsTitle.openPositions || "Open Positions",
      value: openPositions.toString(),
      icon: "lucide:activity",
      color: "warning" as const,
      tooltip: "Number of trades that are currently open (filtered by search)."
    },
    {
      title: statsTitle.winRate || "Win Rate",
      value: `${(isFinite(winRate) ? winRate : 0).toFixed(2)}%`,
      icon: "lucide:target",
      color: "success" as const,
      tooltip: `Percentage of trades that are profitable (${useCashBasis ? 'Cash Basis' : 'Accrual Basis'}) matching current search/filter.`
    }
  ];

  return (
    <div className="mb-6">
      {/* Stats Mask Toggle */}
      <div className="flex justify-end mb-4">
        <Tooltip content={isStatsMasked ? "Show figures" : "Hide figures"}>
          <Button
            isIconOnly
            variant="light"
            onPress={onToggleStatsMask}
            className={`w-6 h-6 min-w-6 rounded p-0.5 transition-all duration-200 ${
              isStatsMasked
                ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 hover:bg-warning-200 dark:hover:bg-warning-900/50'
                : 'hover:bg-default-100 dark:hover:bg-default-800 text-default-600 dark:text-default-400'
            }`}
          >
            <Icon
              icon={isStatsMasked ? "lucide:eye-off" : "lucide:eye"}
              className="w-3 h-3"
            />
          </Button>
        </Tooltip>
      </div>

      {/* Stats Grid - Match original layout exactly: grid-cols-2 lg:grid-cols-6 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-center">
        {/* First three stats: Total Trades, Open Positions, Win Rate */}
        {firstThreeStats.map((stat, idx) => (
          <div key={stat.title} className="flex items-center gap-2">
            <StatsCard
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={idx === 0 ? "primary" : idx === 1 ? "warning" : "success"}
              isMasked={isStatsMasked}
            />
            {/* Show info icon only on mobile for first three stats */}
            <div className="block sm:hidden">
              <MobileTooltip
                placement="top"
                className="max-w-xs text-xs p-1 bg-content1 border border-divider"
                content={<div>{stat.tooltip}</div>}
              >
                <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
              </MobileTooltip>
            </div>
          </div>
        ))}

        {/* Realized P/L with Enhanced Tooltip */}
        <div className="flex items-center gap-2">
          <StatsCard
            title="Realized P/L"
            value={formatCurrency(totalRealizedPL)}
            icon="lucide:indian-rupee"
            color={totalRealizedPL >= 0 ? "success" : "danger"}
            isMasked={isStatsMasked}
          />
          <MobileTooltip
            placement="top"
            className="max-w-xs text-xs p-1 bg-content1 border border-divider"
            content={
              <RealizedPLTooltip
                processedTrades={processedTrades}
                useCashBasis={useCashBasis}
                getAccountingAwareValues={getAccountingAwareValues}
              />
            }
          >
            <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
          </MobileTooltip>
        </div>

        {/* Unrealized P/L with Enhanced Tooltip */}
        <div className="flex items-center gap-2">
          <StatsCard
            title="Unrealized P/L"
            value={formatCurrency(totalUnrealizedPL)}
            icon="lucide:indian-rupee"
            color={totalUnrealizedPL >= 0 ? "success" : "danger"}
            isMasked={isStatsMasked}
          />
          <MobileTooltip
            placement="top"
            className="max-w-xs text-xs p-1 bg-content1 border border-divider"
            content={
              <UnrealizedPLTooltip
                processedTrades={processedTrades}
                useCashBasis={useCashBasis}
                getAccountingAwareValues={getAccountingAwareValues}
              />
            }
          >
            <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
          </MobileTooltip>
        </div>

        {/* Open Heat with Enhanced Tooltip - Match old implementation */}
        <div className="flex items-center gap-1">
          <StatsCard
            title="Open Heat"
            value={`${(isFinite(openHeat) ? openHeat : 0).toFixed(2)}%`}
            icon="lucide:flame"
            color="warning"
            isMasked={isStatsMasked}
          />
          <MobileTooltip
            placement="top"
            className="max-w-xs text-xs p-1 bg-content1 border border-divider"
            content={(() => {
              // Use filtered trades for open heat tooltip to respond to search
              let openTrades = trades.filter(t => (t.positionStatus === 'Open' || t.positionStatus === 'Partial'));

              // For cash basis, avoid double counting by using original trade IDs
              if (useCashBasis) {
                const seenTradeIds = new Set();
                openTrades = openTrades.filter(trade => {
                  const originalId = trade.id.split('_exit_')[0];
                  if (seenTradeIds.has(originalId)) {
                    return false;
                  }
                  seenTradeIds.add(originalId);
                  return true;
                });
              }

              const breakdown = openTrades
                .map(t => {
                  const tradeCalc = getTradeCalculation ? getTradeCalculation(t.id) : null;
                  const risk = tradeCalc ?
                    (tradeCalc.allocation * (tradeCalc.slPercent / 100)) :
                    (calcTradeOpenHeat ? calcTradeOpenHeat(t, portfolioSize || 0, getPortfolioSize) : 0);
                  return {
                    name: t.name || 'Unknown',
                    risk: risk
                  };
                })
                .filter(t => t.risk > 0)
                .sort((a, b) => b.risk - a.risk);

              return (
                <div>
                  <div className="mb-2 font-medium text-foreground-700">This is the % of your portfolio you will lose if all initial stops/TSLs are hit on your open/partial positions.</div>
                  {breakdown.length > 0 ? (
                    <ul className="space-y-1">
                      {breakdown.map((t, idx) => (
                        <li key={`${t.name}-risk-${idx}`} className="flex justify-between">
                          <span>{t.name}</span>
                          <span className="font-mono">{t.risk.toFixed(2)}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-foreground-400">No open risk</div>
                  )}
                </div>
              );
            })()}
          >
            <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
          </MobileTooltip>
        </div>

        {/* % Invested with Enhanced Tooltip */}
        <div className="flex items-center gap-2">
          <StatsCard
            title="% Invested"
            value={`${(isFinite(percentInvested) ? percentInvested : 0).toFixed(2)}%`}
            icon={(() => {
              const safePercentInvested = isFinite(percentInvested) ? percentInvested : 0;
              if (safePercentInvested > 150) return "lucide:alert-triangle";
              if (safePercentInvested > 100) return "lucide:trending-up";
              return "lucide:pie-chart";
            })()}
            color={(() => {
              const safePercentInvested = isFinite(percentInvested) ? percentInvested : 0;
              if (safePercentInvested > 150) return "danger";
              if (safePercentInvested > 100) return "warning";
              return "primary";
            })()}
            isMasked={isStatsMasked}
          />
          <MobileTooltip
            placement="top"
            className="max-w-xs text-xs p-1 bg-content1 border border-divider"
            content={(() => {
              const safePercentInvested = isFinite(percentInvested) ? percentInvested : 0;
              const baseText = `Percentage of your portfolio currently invested in open positions (${useCashBasis ? 'Cash Basis' : 'Accrual Basis'}).`;
              if (safePercentInvested > 100) {
                const leverageAmount = safePercentInvested - 100;
                return `${baseText} ⚠️ LEVERAGED: You're using ${leverageAmount.toFixed(2)}% leverage, deploying more capital than your portfolio size. 🚨 RISK MULTIPLIED: Your potential losses are amplified by ${(safePercentInvested / 100).toFixed(2)}x due to leverage.`;
              }
              return `${baseText} This shows how much of your capital is actively deployed in the market.`;
            })()}
          >
            <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
          </MobileTooltip>
        </div>

        {/* % PF (Current) */}
        <div className="flex items-center gap-2">
          <StatsCard
            title="% PF (Current)"
            value={`${(isFinite(percentPF) ? percentPF : 0).toFixed(2)}%`}
            icon="lucide:trending-up"
            color={(isFinite(percentPF) ? percentPF : 0) >= 0 ? "success" : "danger"}
            isMasked={isStatsMasked}
          />
          <MobileTooltip
            placement="top"
            className="max-w-xs text-xs p-1 bg-content1 border border-divider"
            content={`Current cumulative portfolio performance calculated as the sum of all monthly P/L percentages (${useCashBasis ? 'Cash Basis' : 'Accrual Basis'}). Each month's return is calculated as (Monthly P/L ÷ Starting Capital) × 100, then all monthly returns are summed to show your total portfolio growth/decline. This matches the monthly performance table calculations.`}
          >
            <Icon icon="lucide:info" className="text-base text-foreground-400 cursor-pointer inline-block align-middle" />
          </MobileTooltip>
        </div>


      </div>

      {/* Remove flickering loading indicator - stats should update smoothly */}
    </div>
  );
});
