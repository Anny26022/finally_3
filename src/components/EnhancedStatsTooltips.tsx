import React from 'react';
import { Trade } from '../types/trade';
import { calculateTradePL } from '../utils/accountingUtils';
import { formatCurrency } from '../utils/formatters';

interface TooltipProps {
  processedTrades: Trade[];
  useCashBasis: boolean;
  getAccountingAwareValues: (trade: Trade) => any;
}

/**
 * Enhanced Stats Tooltips - Complex tooltip calculations from original
 * 
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 * 
 * Features:
 * - Complex realized P/L breakdown calculations
 * - Cash basis vs Accrual basis handling
 * - Portfolio impact calculations
 * - Top trades breakdown display
 */

export const RealizedPLTooltip: React.FC<TooltipProps> = ({ 
  processedTrades, 
  useCashBasis, 
  getAccountingAwareValues 
}) => {
  // Use filtered trades for tooltip breakdown to respond to search
  // CRITICAL FIX: Use the same logic as main stats calculation for consistency
  // CRITICAL FIX: Use the EXACT same logic as dashboard calculation
  // This ensures tooltip PF impacts match dashboard totals
  let tooltipRealizedTrades;
  
  if (useCashBasis) {
    // For cash basis: flatten all expanded trades from _expandedTrades arrays
    tooltipRealizedTrades = processedTrades.flatMap(trade =>
      Array.isArray(trade._expandedTrades)
        ? trade._expandedTrades.filter(t => t._cashBasisExit)
        : (trade._cashBasisExit ? [trade] : [])
    );
    
    // Group by original trade ID and sum realizedPL and pfImpact
    const grouped = {};
    tooltipRealizedTrades.forEach(t => {
      const originalId = t.id.split('_exit_')[0];
      if (!grouped[originalId]) {
        grouped[originalId] = {
          name: t.name || 'N/A',
          realizedPL: 0,
          pfImpact: 0
        };
      }
      grouped[originalId].realizedPL += calculateTradePL(t, useCashBasis);
      // Don't accumulate pfImpact here - we'll calculate it once per original trade below
    });

    // CRITICAL FIX: Calculate PF Impact using original trades (same as table rows)
    // This ensures tooltip percentages match table display exactly
    const originalTradesMap = new Map();
    processedTrades.forEach(trade => {
      const originalId = trade.id.split('_exit_')[0];
      if (!originalTradesMap.has(originalId)) {
        originalTradesMap.set(originalId, trade);
      }
    });

    Object.keys(grouped).forEach(originalId => {
      const originalTrade = originalTradesMap.get(originalId);
      if (originalTrade) {
        const pfImpactValues = getAccountingAwareValues(originalTrade);
        grouped[originalId].pfImpact = pfImpactValues.pfImpact;
      }
    });

    tooltipRealizedTrades = Object.values(grouped);
  } else {
    // For accrual basis: include all non-open trades
    tooltipRealizedTrades = processedTrades.filter(trade => trade.positionStatus !== 'Open')
      .map(t => {
        // CRITICAL FIX: Use the same calculation method as table rows
        // Calculate PF Impact using getAccountingAwareValues for consistency with table display
        const pfImpactValues = getAccountingAwareValues(t);
        return {
          name: t.name || 'N/A',
          realizedPL: pfImpactValues.plRs,
          pfImpact: pfImpactValues.pfImpact
        };
      });
  }

  const breakdown = tooltipRealizedTrades
    .filter(t => Math.abs(t.realizedPL) > 0.01) // Filter out negligible amounts
    .sort((a, b) => Math.abs(b.realizedPL) - Math.abs(a.realizedPL)); // Sort by absolute value

  // CRITICAL FIX: Calculate tooltip PF Impact from the actual breakdown trades that are displayed
  // This ensures the tooltip percentage matches the sum of individual percentages shown
  const tooltipPfImpact = breakdown.reduce((sum, t) => sum + t.pfImpact, 0);

  return (
    <div className="max-w-sm">
      <div className="mb-2">
        <div className="font-medium text-foreground-700">
          <strong>PF Impact:</strong> {tooltipPfImpact.toFixed(2)}%
        </div>
        <div className="text-foreground-400 text-xs">
          This is the % of your portfolio that is realized as profit/loss.
        </div>
      </div>

      {breakdown.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-foreground-600 mb-2 border-b border-divider pb-1">
            Top Realized Trades:
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {breakdown.slice(0, 10).map((t, idx) => ( // Show top 10
              <div key={`${t.name}-${idx}`} className="flex justify-between items-center text-xs">
                <span className="truncate max-w-[100px]" title={t.name}>
                  {t.name}
                </span>
                <div className="flex flex-col items-end ml-2">
                  <span className={`font-mono font-medium whitespace-nowrap ${
                    t.realizedPL >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    ₹{formatCurrency(t.realizedPL)}
                  </span>
                  <span className={`font-mono text-xs ${
                    t.pfImpact >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    ({t.pfImpact >= 0 ? '+' : ''}{t.pfImpact.toFixed(2)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>

          {breakdown.length > 10 && (
            <div className="text-xs text-foreground-400 mt-2 pt-1 border-t border-divider">
              Showing top 10 of {breakdown.length} realized trades
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-foreground-400">
          No realized trades to display
        </div>
      )}
    </div>
  );
};

export const UnrealizedPLTooltip: React.FC<TooltipProps> = ({ 
  processedTrades, 
  useCashBasis, 
  getAccountingAwareValues 
}) => {
  // Similar complex calculation for unrealized P/L
  const openTrades = processedTrades.filter(trade => 
    trade.positionStatus === 'Open' || trade.positionStatus === 'Partial'
  );

  const breakdown = openTrades
    .map(t => {
      const values = getAccountingAwareValues(t);
      return {
        name: t.name || 'N/A',
        unrealizedPL: values.unrealizedPL || 0,
        pfImpact: values.pfImpact || 0
      };
    })
    .filter(t => Math.abs(t.unrealizedPL) > 0.01)
    .sort((a, b) => Math.abs(b.unrealizedPL) - Math.abs(a.unrealizedPL));

  const tooltipPfImpact = breakdown.reduce((sum, t) => sum + t.pfImpact, 0);

  return (
    <div className="max-w-sm">
      <div className="mb-2">
        <div className="font-medium text-foreground-700">
          <strong>Unrealized PF Impact:</strong> {tooltipPfImpact.toFixed(2)}%
        </div>
        <div className="text-foreground-400 text-xs">
          Portfolio impact from open positions.
        </div>
      </div>

      {breakdown.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-foreground-600 mb-2 border-b border-divider pb-1">
            Open Positions:
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {breakdown.slice(0, 10).map((t, idx) => (
              <div key={`${t.name}-${idx}`} className="flex justify-between items-center text-xs">
                <span className="truncate max-w-[100px]" title={t.name}>
                  {t.name}
                </span>
                <div className="flex flex-col items-end ml-2">
                  <span className={`font-mono font-medium whitespace-nowrap ${
                    t.unrealizedPL >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    ₹{formatCurrency(t.unrealizedPL)}
                  </span>
                  <span className={`font-mono text-xs ${
                    t.pfImpact >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                    ({t.pfImpact >= 0 ? '+' : ''}{t.pfImpact.toFixed(2)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-foreground-400">
          No open positions
        </div>
      )}
    </div>
  );
};

export const OpenHeatTooltip: React.FC<{
  trades: Trade[];
  portfolioSize: number;
  formatCurrency: (value: number) => string;
  useCashBasis?: boolean;
  getTradeCalculation?: (id: string) => any;
  calcTradeOpenHeat?: (trade: any, portfolioSize: number, getPortfolioSize?: any) => number;
  getPortfolioSize?: (month: string, year: number) => number;
}> = ({
  trades,
  portfolioSize,
  formatCurrency,
  useCashBasis = false,
  getTradeCalculation,
  calcTradeOpenHeat,
  getPortfolioSize
}) => {
  // Use filtered trades for open heat tooltip to respond to search
  let openTrades = trades.filter(t => (t.positionStatus === 'Open' || t.positionStatus === 'Partial'));

  // For cash basis, avoid double counting in tooltip
  if (useCashBasis) {
    const seenTradeIds = new Set();
    openTrades = openTrades.filter(t => {
      const originalId = t.id.split('_exit_')[0];
      if (seenTradeIds.has(originalId)) return false;
      seenTradeIds.add(originalId);
      return true;
    });
  }

  const breakdown = openTrades
    .map(t => {
      const tradeCalc = getTradeCalculation ? getTradeCalculation(t.id) : null;
      const risk = tradeCalc ?
        (tradeCalc.allocation * (tradeCalc.slPercent / 100)) :
        (calcTradeOpenHeat ? calcTradeOpenHeat(t, portfolioSize, getPortfolioSize) : 0);
      return {
        name: t.name || 'N/A',
        risk: risk
      };
    })
    .filter(t => t.risk > 0)
    .sort((a, b) => b.risk - a.risk);

  return (
    <div>
      <div className="mb-2 font-medium text-foreground-700">This is the % of your portfolio you will lose if all initial stops/TSLs are hit on your open/partial positions.</div>
      {breakdown.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {breakdown.slice(0, 10).map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span className="text-foreground-600">{item.name}:</span>
              <span className="text-danger font-medium">{item.risk.toFixed(2)}%</span>
            </li>
          ))}
          {breakdown.length > 10 && (
            <li className="text-foreground-400 text-[10px] italic">
              ...and {breakdown.length - 10} more positions
            </li>
          )}
        </ul>
      ) : (
        <div className="text-foreground-400">No open positions</div>
      )}
    </div>
  );
};

export const PercentInvestedTooltip: React.FC<{
  percentInvested: number;
  portfolioSize: number;
  totalInvested: number;
  formatCurrency: (value: number) => string;
}> = ({ percentInvested, portfolioSize, totalInvested, formatCurrency }) => {
  return (
    <div className="max-w-xs">
      <div className="font-medium text-foreground-700 mb-1">
        Portfolio Investment Breakdown
      </div>
      <div className="text-foreground-400 text-xs space-y-1">
        <div>• Portfolio Size: ₹{formatCurrency(portfolioSize)}</div>
        <div>• Total Invested: ₹{formatCurrency(totalInvested)}</div>
        <div>• Percentage Invested: {percentInvested.toFixed(2)}%</div>
        <div>• Available Cash: ₹{formatCurrency(portfolioSize - totalInvested)}</div>
      </div>
    </div>
  );
};

export const LeverageWarningTooltip: React.FC<{ leverageRatio?: number }> = ({ leverageRatio = 0 }) => {
  return (
    <div className="max-w-xs">
      <div className="font-medium text-warning mb-1">
        High Leverage Warning
      </div>
      <div className="text-foreground-400 text-xs space-y-1">
        <div>Current leverage: {leverageRatio.toFixed(2)}x</div>
        <div>• Leverage above 2x increases risk significantly</div>
        <div>• Consider reducing position sizes</div>
        <div>• Monitor margin requirements closely</div>
      </div>
    </div>
  );
};
