import React, { useState, useCallback, useMemo } from 'react';
import { TableRow, TableCell, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Trade } from "../../types/trade";

// Import all existing cell components with exact names
import {
  EditableCell,
  BuySellCell,
  PositionStatusCell,
  NameCell,
  SetupCell,
  ExitTriggerCell,
  ProficiencyGrowthAreasCell,
  PlanFollowedCell,
  NotesCell,
  CMPCell
} from './cells';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  editable?: boolean;
}

interface TradeTableRowProps {
  trade: Trade;
  columns: Column[];
  
  // Inline editing
  onInlineEditSave: (tradeId: string, field: keyof Trade, value: any) => void;
  
  // Actions
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (trade: Trade) => void;

  // Chart actions (optional)
  onViewChart?: (chartImage: any, title: string) => void;
  onUploadCharts?: (trade: Trade) => void;
  
  // Calculations
  getAccountingAwareValues: (trade: Trade) => any;
  formatCurrency: (value: number) => string;
  formatCellValue: (value: any, key: string) => string;
  getValueColor: (value: any, key: string) => string;
  
  // UI state
  isNotesWrapEnabled: boolean;

  // Tooltip data (precomputed)
  tooltipData?: any;

  // Precomputed tooltips for complex fields
  precomputedTooltips: Map<string, any>;
  
  // Row index for keyboard navigation
  rowIndex?: number;
}

/**
 * TradeTableRow - Individual row component with inline editing capabilities
 * 
 * ARCHITECTURAL BENEFITS:
 * - Single responsibility: Only handles individual row rendering and editing
 * - React.memo optimization: Only re-renders when trade data changes
 * - Isolated editing state: Row-level editing doesn't affect other rows
 * - Reusable: Can be used in different table contexts
 * - Maintainable: Clear separation of row logic from table logic
 */
export const TradeTableRow: React.FC<TradeTableRowProps> = React.memo(function TradeTableRow({
  trade,
  columns,
  onInlineEditSave,
  onEditTrade,
  onDeleteTrade,
  onViewChart,
  onUploadCharts,
  getAccountingAwareValues,
  formatCurrency,
  formatCellValue,
  getValueColor,
  isNotesWrapEnabled,
  tooltipData,
  precomputedTooltips,
  rowIndex
}) {
  // ===== LOCAL EDITING STATE =====
  const [editingField, setEditingField] = useState<string | null>(null);

  // ===== CELL RENDERING LOGIC =====
  const renderCell = useCallback((columnKey: string) => {
    const cellValue = trade[columnKey as keyof Trade];

    // Handle special cell types with exact component names from original
    switch (columnKey) {
      case 'name':
        // Stock name with complex trade details tooltip
        const nameCell = (
          <div className="cursor-help" data-trade-id={trade.id} data-field="name" tabIndex={0}>
            <NameCell
              key={`${trade.id}-name`}
              value={trade.name}
              onSave={(value) => onInlineEditSave(trade.id, 'name', value)}
            />
          </div>
        );

        const tradeDetailsTooltip = precomputedTooltips.get(trade.id)?.tradeDetails;
        if (!tradeDetailsTooltip) {
          return nameCell;
        }

        const { fields, tradeName, accountingMethod } = tradeDetailsTooltip;
        const tooltipContent = (
          <div className="p-3 text-xs max-w-2xl break-words">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm">Trade Details: {tradeName}</h4>
              <div className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                {accountingMethod}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {fields.map((field: any) => (
                <div key={field.key} className="bg-content2/40 dark:bg-content2/30 p-1.5 rounded shadow-sm overflow-hidden text-ellipsis whitespace-nowrap">
                  <span className="font-medium text-default-700 dark:text-default-300">{field.label}: </span>
                  <span className="text-default-600 dark:text-default-400">{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

        return (
          <Tooltip
            content={tooltipContent}
            placement="right-start"
            delay={0}
            closeDelay={0}
            radius="sm"
            shadow="md"
            classNames={{ content: "bg-content1 border border-divider z-50 max-w-2xl" }}
          >
            {nameCell}
          </Tooltip>
        );

      case 'buySell':
        return (
          <div
            data-trade-id={trade.id}
            data-field="buySell"
            tabIndex={0}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
          >
            <BuySellCell
              key={`${trade.id}-buySell`}
              value={trade.buySell}
              onSave={(value) => onInlineEditSave(trade.id, 'buySell', value)}
            />
          </div>
        );

      case 'positionStatus':
        return (
          <div
            data-trade-id={trade.id}
            data-field="positionStatus"
            tabIndex={0}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
          >
            <PositionStatusCell
              key={`${trade.id}-positionStatus`}
              value={trade.positionStatus}
              onSave={(value) => onInlineEditSave(trade.id, 'positionStatus', value)}
            />
          </div>
        );

      case 'setup':
        return (
          <div
            data-trade-id={trade.id}
            data-field="setup"
            tabIndex={0}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
          >
            <SetupCell
              key={`${trade.id}-setup`}
              value={trade.setup || ''}
              onSave={(value) => onInlineEditSave(trade.id, 'setup', value)}
            />
          </div>
        );

      case 'exitTrigger':
        return (
          <div data-trade-id={trade.id} data-field="exitTrigger" tabIndex={0}>
            <ExitTriggerCell
              key={`${trade.id}-exitTrigger`}
              value={trade.exitTrigger || ''}
              onSave={(value) => onInlineEditSave(trade.id, 'exitTrigger', value)}
            />
          </div>
        );

      case 'proficiencyGrowthAreas':
        return (
          <div data-trade-id={trade.id} data-field="proficiencyGrowthAreas" tabIndex={0}>
            <ProficiencyGrowthAreasCell
              key={`${trade.id}-proficiencyGrowthAreas`}
              value={trade.proficiencyGrowthAreas || ''}
              onSave={(value) => onInlineEditSave(trade.id, 'proficiencyGrowthAreas', value)}
            />
          </div>
        );

      case 'planFollowed':
        return (
          <div data-trade-id={trade.id} data-field="planFollowed" tabIndex={0}>
            <PlanFollowedCell
              key={`${trade.id}-planFollowed`}
              value={trade.planFollowed}
              onSave={(value) => onInlineEditSave(trade.id, 'planFollowed', value)}
            />
          </div>
        );

      case 'notes':
        return (
          <div data-trade-id={trade.id} data-field="notes" tabIndex={0}>
            <NotesCell
              key={`${trade.id}-notes`}
              value={trade.notes || ''}
              onSave={(value) => onInlineEditSave(trade.id, 'notes', value)}
              isWrapEnabled={isNotesWrapEnabled}
            />
          </div>
        );

      case 'cmp':
        return (
          <CMPCell
            key={`${trade.id}-cmp`}
            value={trade.cmp}
            isAutoFetched={trade._cmpAutoFetched}
            onSave={(value) => onInlineEditSave(trade.id, 'cmp', value)}
          />
        );

      // Date fields - include all date fields from original
      case "date":
      case "entryDate":
      case "exitDate":
      case "pyramid1Date":
      case "pyramid2Date":
      case "exit1Date":
      case "exit2Date":
      case "exit3Date":
        return (
          <EditableCell
            key={`${trade.id}-${columnKey}`}
            value={cellValue as string}
            type="date"
            onSave={(value) => onInlineEditSave(trade.id, columnKey as keyof Trade, value)}
            tradeId={trade.id}
            field={columnKey}
          />
        );

      // Price fields - include all price fields from original
      case "entry":
      case "sl":
      case "tsl":
      case "pyramid1Price":
      case "pyramid2Price":
      case "exit1Price":
      case "exit2Price":
      case "exit3Price":
        return (
          <EditableCell
            key={`${trade.id}-${columnKey}`}
            value={cellValue as number}
            type="price"
            onSave={(value) => onInlineEditSave(trade.id, columnKey as keyof Trade, value)}
            tradeId={trade.id}
            field={columnKey}
          />
        );

      // Quantity fields
      case "initialQty":
      case "pyramid1Qty":
      case "pyramid2Qty":
      case "exit1Qty":
      case "exit2Qty":
      case "exit3Qty":
        return (
          <EditableCell
            key={`${trade.id}-${columnKey}`}
            value={cellValue as number}
            type="number"
            onSave={(value) => onInlineEditSave(trade.id, columnKey as keyof Trade, value)}
            tradeId={trade.id}
            field={columnKey}
          />
        );

      // Text fields
      case "tradeNo":
        return (
          <div className="flex items-center gap-0.5">
            <EditableCell
              key={`${trade.id}-${columnKey}`}
              value={cellValue as string}
              onSave={(value) => onInlineEditSave(trade.id, columnKey as keyof Trade, value)}
              tradeId={trade.id}
              field={columnKey}
            />
          </div>
        );

      // Calculated fields with accounting awareness
      case "plRs":
      case "realisedAmount":
        const accountingValues = getAccountingAwareValues(trade);
        const displayValue = columnKey === "realisedAmount" ? accountingValues.realisedAmount : accountingValues.plRs;
        return (
          <div className={`py-1 px-2 text-right whitespace-nowrap ${getValueColor(displayValue, columnKey)}`}>
            {formatCellValue(displayValue, columnKey)}
          </div>
        );

      case "pfImpact":
        const pfValues = getAccountingAwareValues(trade);
        return (
          <div className={`py-1 px-2 text-right whitespace-nowrap ${getValueColor(pfValues.pfImpact, columnKey)}`}>
            {formatCellValue(pfValues.pfImpact, columnKey)}
          </div>
        );

      // Special calculated fields with different styling
      case "allocation":
      case "stockMove":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      case "cummPf":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      // Non-editable calculated fields with special styling
      // Reward:Risk with complex tooltip
      case "rewardRisk":
        const rrTooltipData = precomputedTooltips.get(trade.id)?.rewardRisk;
        if (!rrTooltipData) {
          return (
            <div className="py-1 px-2 text-right whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
              {formatCellValue(cellValue, columnKey)}
            </div>
          );
        }

        const {
          entryBreakdown,
          weightedRR,
          totalQtyAll,
          tsl,
          traditionalWeightedRR,
          effectiveRR,
          hasRiskFreePositions,
          totalRiskAmount,
          totalRewardAmount
        } = rrTooltipData;

        const rrTooltipContent = (
          <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[180px]">
            <div className="font-semibold">Reward:Risk Breakdown</div>
            {entryBreakdown.map((e: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5 border-b border-divider pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                <div className="font-medium">{e.label} (Entry: {e.price})</div>
                {trade.positionStatus === 'Partial' && (e.exitedQtyForEntry > 0 || e.openQtyForEntry > 0) && (
                  <div className="text-[10px] text-foreground-600">
                    {e.exitedQtyForEntry > 0 && `Exited: ${e.exitedQtyForEntry} qty`}
                    {e.exitedQtyForEntry > 0 && e.openQtyForEntry > 0 && ' | '}
                    {e.openQtyForEntry > 0 && `Open: ${e.openQtyForEntry} qty`}
                  </div>
                )}
                <div><b>Risk:</b> |{trade.buySell === 'Buy' ? 'Entry - ' : ''}{(e.label === 'Initial Entry' ? 'SL' : (e.stop === tsl && tsl > 0 ? 'TSL' : 'SL'))}{trade.buySell === 'Sell' ? ' - Entry' : ''}| = {trade.buySell === 'Buy' ? `${e.price} - ${e.stop}` : `${e.stop} - ${e.price}`} = {e.rawRisk.toFixed(2)}</div>
                {e.rawRisk < 0 && e.label !== 'Initial Entry' && (
                  <div className="text-warning-600 text-[10px]">
                    Negative risk: This pyramid is financed from the cushion of earlier profits.
                  </div>
                )}
                <div><b>Reward:</b> {e.rewardFormula}</div>
                <div><b>R:R:</b> |{e.reward.toFixed(2)} / {e.risk.toFixed(2)}| = <span className={`${e.isRiskFree ? 'text-success font-bold' : 'text-primary'}`}>
                  {e.isRiskFree ? '∞ (Risk-Free)' : `${e.rrValue % 1 === 0 ? e.rrValue.toFixed(0) : e.rrValue.toFixed(2)}R`}
                </span></div>
              </div>
            ))}
            <div className="font-semibold mt-1 border-t border-divider pt-1">Overall R:R Analysis</div>

            {hasRiskFreePositions && (
              <div className="bg-success-50 dark:bg-success-900/20 p-2 rounded text-[10px] mb-2">
                <div className="font-semibold text-success-700 dark:text-success-300">🎯 Position Contains Risk-Free Components!</div>
                <div className="text-success-600 dark:text-success-400">Some entries have zero risk (TSL at entry price)</div>
              </div>
            )}

            <div className="space-y-1">
              <div>
                <b>Traditional Weighted R:R:</b> <span className='text-primary'>{traditionalWeightedRR % 1 === 0 ? traditionalWeightedRR.toFixed(0) : traditionalWeightedRR.toFixed(2)}R</span>
                <div className="text-[10px] text-foreground-500">
                  (Excludes risk-free positions from calculation)
                </div>
              </div>

              <div>
                <b>Effective Position R:R:</b> <span className={`${effectiveRR === Infinity ? 'text-success font-bold' : 'text-primary'}`}>
                  {effectiveRR === Infinity ? '∞ (Risk-Free Position)' : `${effectiveRR % 1 === 0 ? effectiveRR.toFixed(0) : effectiveRR.toFixed(2)}R`}
                </span>
                <div className="text-[10px] text-foreground-500">
                  Total Reward (₹{Math.abs(totalRewardAmount).toFixed(2)}) ÷ Total Risk (₹{totalRiskAmount.toFixed(2)})
                </div>
              </div>

              {hasRiskFreePositions && (
                <div className="text-[10px] text-warning-600 dark:text-warning-400 mt-1">
                  💡 Risk-free positions provide unlimited upside with zero additional downside risk
                </div>
              )}
            </div>
            <div className="text-foreground-500 mt-1 text-[10px] border-t border-divider pt-1">
              {trade.positionStatus === 'Open' && '* All rewards are unrealized (based on current CMP)'}
              {trade.positionStatus === 'Closed' && '* All rewards are realized (based on actual exit prices)'}
              {trade.positionStatus === 'Partial' && '* FIFO-based: Realized rewards for exited qty per entry, unrealized for remaining qty'}
            </div>
          </div>
        );

        return (
          <Tooltip
            content={rrTooltipContent}
            placement="top"
            delay={100}
            closeDelay={50}
            radius="sm"
            shadow="md"
            classNames={{ content: "bg-content1 border border-divider z-50 max-w-xs" }}
          >
            <div className="py-1 px-2 text-right cursor-help flex items-center gap-1 rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
              {formatCellValue(cellValue, columnKey)}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle text-warning cursor-help" style={{marginLeft: 2}}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </Tooltip>
        );

      // Holding Days with complex tooltip
      case "holdingDays":
        const holdingDaysTooltip = precomputedTooltips.get(trade.id)?.holdingDays;
        if (!holdingDaysTooltip) {
          return (
            <div className="py-1 px-2 text-right whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
              {formatCellValue(cellValue, columnKey)}
            </div>
          );
        }

        const { lots, totalDays, weightedAvgDays } = holdingDaysTooltip;
        const holdingTooltipContent = (
          <div className="p-2 text-xs max-w-md">
            <div className="font-semibold mb-2">Holding Days Breakdown (FIFO)</div>
            <div className="space-y-1">
              {lots.map((lot: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-1 px-2 bg-content2/30 rounded">
                  <span>Lot {idx + 1}: {lot.qty} qty</span>
                  <span className="font-medium">{lot.days} days</span>
                </div>
              ))}
            </div>
            <div className="border-t border-divider mt-2 pt-2">
              <div className="flex justify-between">
                <span>Total Days:</span>
                <span className="font-medium">{totalDays}</span>
              </div>
              <div className="flex justify-between">
                <span>Weighted Avg:</span>
                <span className="font-medium">{weightedAvgDays} days</span>
              </div>
            </div>
          </div>
        );

        return (
          <Tooltip
            content={holdingTooltipContent}
            placement="top"
            delay={100}
            closeDelay={50}
            radius="sm"
            shadow="md"
            classNames={{ content: "bg-content1 border border-divider z-50" }}
          >
            <div className="py-1 px-2 text-right cursor-help whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
              {formatCellValue(cellValue, columnKey)}
            </div>
          </Tooltip>
        );

      case "avgEntry":
      case "positionSize":
      case "openQty":
      case "exitedQty":
      case "avgExitPrice":
      case "openHeat":
      case "unrealizedPL":
      case "slPercent":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      // Chart attachments column - match original exactly
      case "chartAttachments":
        const hasBeforeEntry = trade.chartAttachments?.beforeEntry;
        const hasAfterExit = trade.chartAttachments?.afterExit;

        // Force re-render by using a key that includes chart attachment info
        const chartKey = `${trade.id}-${hasBeforeEntry?.id || 'no-before'}-${hasAfterExit?.id || 'no-after'}`;

        if (!hasBeforeEntry && !hasAfterExit) {
          return (
            <div key={chartKey} className="flex items-center justify-center gap-2 py-2 px-3">
              <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-md px-2 py-1 hover:bg-gray-50"
                   onClick={() => onUploadCharts && onUploadCharts(trade)}>
                <Icon icon="lucide:image-off" className="w-4 h-4" />
                <span className="text-xs font-medium">No charts</span>
              </div>
            </div>
          );
        }

        return (
          <div key={chartKey} className="flex items-center justify-center gap-1 py-1 px-2">
            {hasBeforeEntry && (
              <button
                onClick={() => onViewChart && onViewChart(hasBeforeEntry, `${trade.name} - Before Entry Chart`)}
                className="text-blue-500 hover:text-blue-600 p-1 rounded"
                title="View Before Entry Chart"
              >
                <Icon icon="lucide:trending-up" className="w-4 h-4" />
              </button>
            )}
            {hasAfterExit && (
              <button
                onClick={() => onViewChart && onViewChart(hasAfterExit, `${trade.name} - After Exit Chart`)}
                className="text-green-500 hover:text-green-600 p-1 rounded"
                title="View After Exit Chart"
              >
                <Icon icon="lucide:trending-down" className="w-4 h-4" />
              </button>
            )}
            {(hasBeforeEntry || hasAfterExit) && (
              <div className="text-xs text-gray-500 ml-1">
                {hasBeforeEntry && hasAfterExit ? '2' : '1'}
              </div>
            )}
          </div>
        );

      // Actions column
      case 'actions':
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onEditTrade(trade)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteTrade(trade)}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              Delete
            </button>
          </div>
        );

      // Default case for any other fields
      default:
        return (
          <div className="py-1 px-2 text-sm">
            {cellValue !== undefined && cellValue !== null ? String(cellValue) : '-'}
          </div>
        );
    }
  }, [
    trade,
    onInlineEditSave,
    onEditTrade,
    onDeleteTrade,
    onViewChart,
    onUploadCharts,
    getAccountingAwareValues,
    formatCellValue,
    getValueColor,
    isNotesWrapEnabled,
    tooltipData
  ]);

  // ===== RENDER =====
  return (
    <TableRow
      key={trade.id}
      className="trade-table-row hover:bg-default-50 dark:hover:bg-gray-800 dark:bg-gray-900 group gpu-accelerated"
    >
      {columns.map((column) => (
        <TableCell
          key={`${trade.id}-${column.key}`}
          className={`trade-table-cell ${column.key === "name" ? "sticky-name-cell sticky-header" : ""}`}
        >
          {renderCell(column.key)}
        </TableCell>
      ))}
    </TableRow>
  );
});
