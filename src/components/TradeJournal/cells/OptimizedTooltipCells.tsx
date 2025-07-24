import React, { useMemo, useCallback, useState } from 'react';
import { Tooltip } from "@heroui/react";
import { Trade } from "../../../types/trade";
import { 
  calcSLPercent,
  calcHoldingDays,
  calcIndividualMoves,
  formatCurrency as libFormatCurrency,
  formatPercentage,
  formatStockMove,
  formatHoldingDays,
  formatPrice
} from "../../../lib/calculations";

interface OptimizedTooltipCellProps {
  trade: Trade;
  value: any;
  columnKey: string;
  formatCellValue: (value: any, key: string) => string;
}

/**
 * RewardRiskCell - On-demand R:R calculation with tooltip
 * 
 * PERFORMANCE BENEFITS:
 * - Lazy calculation: Only calculates when tooltip is shown
 * - Memoized content: Caches calculation result
 * - No pre-computation: Eliminates massive precomputedTooltips map
 * - Memory efficient: Only stores data for visible/hovered cells
 */
export const RewardRiskCell = React.memo<{ trade: Trade; formatCellValue: (value: any, key: string) => string }>(({ 
  trade, 
  formatCellValue 
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  
  // Calculate R:R breakdown only when tooltip is opened
  const tooltipContent = useMemo(() => {
    if (!isTooltipOpen) return null; // Don't calculate if tooltip is closed
    
    const buySell = trade.buySell;
    const positionStatus = trade.positionStatus;
    const sl = Number(trade.sl) || 0;
    const tsl = Number(trade.tsl) || 0;
    const cmp = Number(trade.cmp) || 0;
    const avgExit = Number(trade.avgExitPrice) || 0;

    const entryExitAllocations = [
      { label: 'Initial Entry', price: Number(trade.entry), qty: Number(trade.initialQty) },
      { label: 'Pyramid 1', price: Number(trade.pyramid1Price), qty: Number(trade.pyramid1Qty) },
      { label: 'Pyramid 2', price: Number(trade.pyramid2Price), qty: Number(trade.pyramid2Qty) }
    ].filter(e => e.price > 0 && e.qty > 0);

    const entryBreakdown = entryExitAllocations.map(e => {
      let stop;
      if (e.label === 'Initial Entry') {
        stop = sl;
      } else {
        stop = tsl > 0 ? tsl : sl;
      }
      const rawRisk = buySell === 'Buy' ? e.price - stop : stop - e.price;
      const risk = Math.abs(rawRisk);
      let reward = 0;
      let rewardFormula = '';

      if (positionStatus === 'Open') {
        reward = buySell === 'Buy' ? cmp - e.price : e.price - cmp;
        rewardFormula = buySell === 'Buy'
          ? `CMP - Entry = ${cmp} - ${e.price} = ${(cmp - e.price).toFixed(2)} (Unrealized)`
          : `Entry - CMP = ${e.price} - ${cmp} = ${(e.price - cmp).toFixed(2)} (Unrealized)`;
      } else if (positionStatus === 'Closed') {
        reward = buySell === 'Buy' ? avgExit - e.price : e.price - avgExit;
        rewardFormula = buySell === 'Buy'
          ? `Avg. Exit - Entry = ${avgExit} - ${e.price} = ${(avgExit - e.price).toFixed(2)} (Realized)`
          : `Entry - Avg. Exit = ${e.price} - ${avgExit} = ${(e.price - avgExit).toFixed(2)} (Realized)`;
      }

      const rrValue = risk !== 0 ? (reward / risk) : Infinity;
      const isRiskFree = risk === 0;
      
      return {
        label: e.label,
        price: e.price,
        risk,
        rawRisk,
        reward,
        rewardFormula,
        rrValue,
        qty: e.qty,
        stop,
        isRiskFree
      };
    });

    // Calculate weighted R:R
    const riskyEntries = entryBreakdown.filter(e => !e.isRiskFree);
    const riskyQty = riskyEntries.reduce((sum, e) => sum + (e.qty || 0), 0);
    const weightedRR = riskyQty > 0
      ? riskyEntries.reduce((sum, e) => sum + (e.rrValue * (e.qty || 0)), 0) / riskyQty
      : 0;

    return (
      <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[180px]">
        <div className="font-semibold">Reward:Risk Breakdown</div>
        {entryBreakdown.map((e, idx) => (
          <div key={idx} className="flex flex-col gap-0.5 border-b border-divider pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
            <div className="font-medium">{e.label} (Entry: {e.price})</div>
            <div><b>Risk:</b> |{buySell === 'Buy' ? 'Entry - ' : ''}{(e.label === 'Initial Entry' ? 'SL' : (e.stop === tsl && tsl > 0 ? 'TSL' : 'SL'))}{buySell === 'Sell' ? ' - Entry' : ''}| = {buySell === 'Buy' ? `${e.price} - ${e.stop}` : `${e.stop} - ${e.price}`} = {e.rawRisk.toFixed(2)}</div>
            <div><b>Reward:</b> {e.rewardFormula}</div>
            <div><b>R:R:</b> <span className={`${e.isRiskFree ? 'text-success font-bold' : 'text-primary'}`}>
              {e.isRiskFree ? '∞ (Risk-Free)' : `${e.rrValue % 1 === 0 ? e.rrValue.toFixed(0) : e.rrValue.toFixed(2)}R`}
            </span></div>
          </div>
        ))}
        <div className="font-semibold mt-1 border-t border-divider pt-1">
          <div><b>Weighted R:R:</b> <span className='text-primary'>{weightedRR % 1 === 0 ? weightedRR.toFixed(0) : weightedRR.toFixed(2)}R</span></div>
        </div>
      </div>
    );
  }, [isTooltipOpen, trade]);

  return (
    <Tooltip
      content={tooltipContent}
      placement="top"
      delay={100}
      closeDelay={50}
      radius="sm"
      shadow="md"
      isOpen={isTooltipOpen}
      onOpenChange={setIsTooltipOpen}
      classNames={{ content: "bg-content1 border border-divider z-50 max-w-xs" }}
    >
      <div className="py-1 px-2 text-right cursor-help flex items-center gap-1">
        {trade.rewardRisk !== undefined && trade.rewardRisk !== null ? formatCellValue(trade.rewardRisk, 'rewardRisk') : '-'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle text-warning cursor-help" style={{marginLeft: 2}}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </Tooltip>
  );
});

/**
 * HoldingDaysCell - On-demand holding days calculation with tooltip
 */
export const HoldingDaysCell = React.memo<{ trade: Trade; formatCellValue: (value: any, key: string) => string }>(({ 
  trade, 
  formatCellValue 
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  
  // Calculate holding days breakdown only when tooltip is opened
  const { displayDays, tooltipContent } = useMemo(() => {
    const isOpenPosition = trade.positionStatus === 'Open';
    const isPartialPosition = trade.positionStatus === 'Partial';
    
    const entryLots = [
      { label: 'Initial Entry', date: trade.date, qty: Number(trade.initialQty) },
      { label: 'Pyramid 1', date: trade.pyramid1Date, qty: Number(trade.pyramid1Qty) },
      { label: 'Pyramid 2', date: trade.pyramid2Date, qty: Number(trade.pyramid2Qty) }
    ].filter(e => e.date && e.qty > 0);

    const exitLots = [
      { date: trade.exit1Date, qty: Number(trade.exit1Qty) },
      { date: trade.exit2Date, qty: Number(trade.exit2Qty) },
      { date: trade.exit3Date, qty: Number(trade.exit3Qty) }
    ].filter(e => e.date && e.qty > 0);

    let remainingExits = exitLots.map(e => ({ ...e }));
    const today = new Date();
    today.setHours(0,0,0,0);
    const lotBreakdown: { label: string, qty: number, days: number, exited: boolean, exitDate?: string }[] = [];

    for (const lot of entryLots) {
      let qtyLeft = lot.qty;
      const entryDate = new Date(lot.date);
      entryDate.setHours(0,0,0,0);

      while (qtyLeft > 0 && remainingExits.length > 0) {
        const exit = remainingExits[0];
        const exitDate = new Date(exit.date);
        exitDate.setHours(0,0,0,0);
        const usedQty = Math.min(qtyLeft, exit.qty);
        const days = Math.max(1, Math.ceil((exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));
        lotBreakdown.push({ label: lot.label, qty: usedQty, days, exited: true, exitDate: exit.date });
        qtyLeft -= usedQty;
        exit.qty -= usedQty;
        if (exit.qty === 0) remainingExits.shift();
      }

      if (qtyLeft > 0) {
        const days = Math.max(1, Math.ceil((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)));
        lotBreakdown.push({ label: lot.label, qty: qtyLeft, days, exited: false });
      }
    }

    let displayDays = 0;
    if (isOpenPosition) {
      const openLots = lotBreakdown.filter(l => !l.exited);
      const totalQty = openLots.reduce((sum, l) => sum + l.qty, 0);
      displayDays = totalQty > 0 ? Math.round(openLots.reduce((sum, l) => sum + l.days * l.qty, 0) / totalQty) : 0;
    } else if (isPartialPosition) {
      const openLots = lotBreakdown.filter(l => !l.exited);
      const openQty = openLots.reduce((sum, l) => sum + l.qty, 0);
      if (openQty > 0) {
        displayDays = Math.round(openLots.reduce((sum, l) => sum + l.days * l.qty, 0) / openQty);
      }
    } else {
      const exitedLots = lotBreakdown.filter(l => l.exited);
      const exitedQty = exitedLots.reduce((sum, l) => sum + l.qty, 0);
      displayDays = exitedQty > 0 ? Math.round(exitedLots.reduce((sum, l) => sum + l.days * l.qty, 0) / exitedQty) : 0;
    }

    const tooltipContent = isTooltipOpen ? (
      <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
        <div className="font-semibold">Holding Days</div>
        {lotBreakdown.map((l, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{l.label} {l.exited ? '(sold)' : '(open)'}</span>
            <span className="font-mono">{l.days} day{l.days !== 1 ? 's' : ''}</span>
          </div>
        ))}
        <div className="text-foreground-500 mt-1 text-[10px]">
          {isOpenPosition 
            ? 'Days since entry for each open lot.'
            : isPartialPosition
              ? 'Days since entry for open lots, entry to exit for sold lots (FIFO).'
              : 'Entry to exit for each lot (FIFO).'}
        </div>
      </div>
    ) : null;

    return { displayDays, tooltipContent };
  }, [trade, isTooltipOpen]);

  return (
    <Tooltip
      content={tooltipContent}
      placement="top"
      delay={100}
      closeDelay={50}
      radius="sm"
      shadow="md"
      isOpen={isTooltipOpen}
      onOpenChange={setIsTooltipOpen}
      classNames={{ content: "bg-content1 border border-divider z-50 max-w-xs" }}
    >
      <div className="py-1 px-2 text-right cursor-help flex items-center gap-1">
        {displayDays > 0 ? `${displayDays} day${displayDays !== 1 ? 's' : ''}` : '-'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle text-warning cursor-help" style={{marginLeft: 2}}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </Tooltip>
  );
});

/**
 * StockMoveCell - On-demand stock move calculation with tooltip
 */
export const StockMoveCell = React.memo<{ trade: Trade; formatCellValue: (value: any, key: string) => string }>(({ 
  trade, 
  formatCellValue 
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  
  // Calculate stock move breakdown only when tooltip is opened
  const tooltipContent = useMemo(() => {
    if (!isTooltipOpen) return null;
    
    const stockMoveEntries = [
      { description: 'Initial Entry', price: Number(trade.entry), qty: Number(trade.initialQty) },
      { description: 'Pyramid 1', price: Number(trade.pyramid1Price), qty: Number(trade.pyramid1Qty) },
      { description: 'Pyramid 2', price: Number(trade.pyramid2Price), qty: Number(trade.pyramid2Qty) }
    ].filter(e => e.price > 0 && e.qty > 0);

    const individualMoves = calcIndividualMoves(
      stockMoveEntries,
      trade.cmp,
      trade.avgExitPrice,
      trade.positionStatus,
      trade.buySell
    );

    const formatPercentage = (value: number | null | undefined): string => {
      if (value === null || value === undefined) return "-";
      return `${value.toFixed(2)}%`;
    };

    return (
      <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[180px]">
        <div className="font-semibold">Individual Stock Moves:</div>
        {individualMoves.map((move: any, index: number) => (
          <div key={index} className="flex justify-between">
            <span>{move.description} <span className="text-foreground-400">({move.qty} qty)</span></span>
            <span className="font-mono">{formatPercentage(move.movePercent)}</span>
          </div>
        ))}
        <div className="text-foreground-500 mt-1 text-[10px]">
          {trade.positionStatus === 'Open'
            ? '* Unrealized moves based on CMP vs. entry prices.'
            : trade.positionStatus === 'Partial'
              ? '* Mixed moves: Realized (Avg. Exit) for exited qty, Unrealized (CMP) for open qty.'
              : '* Realized moves based on Avg. Exit vs. entry prices.'}
        </div>
      </div>
    );
  }, [isTooltipOpen, trade]);

  return (
    <Tooltip
      content={tooltipContent}
      placement="top"
      delay={100}
      closeDelay={50}
      radius="sm"
      shadow="md"
      isOpen={isTooltipOpen}
      onOpenChange={setIsTooltipOpen}
      classNames={{ content: "bg-content1 border border-divider z-50 max-w-xs" }}
    >
      <div className="py-1 px-2 flex items-center gap-1 relative">
        {trade.stockMove !== undefined && trade.stockMove !== null ? `${Number(trade.stockMove).toFixed(2)}%` : '-'}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle text-warning cursor-help" style={{marginLeft: 2}}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
    </Tooltip>
  );
});

RewardRiskCell.displayName = 'RewardRiskCell';
HoldingDaysCell.displayName = 'HoldingDaysCell';
StockMoveCell.displayName = 'StockMoveCell';
