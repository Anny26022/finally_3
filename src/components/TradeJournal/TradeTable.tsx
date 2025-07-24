import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Pagination,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Switch,
  Tooltip,
  SortDescriptor as HeroSortDescriptor
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { Trade } from "../../types/trade";
import { SortDescriptor } from "../../hooks/use-trades";
import MobileTooltip from "../ui/MobileTooltip";
import {
  NameCell,
  BuySellCell,
  PositionStatusCell,
  SetupCell,
  NotesCell,
  EditableCell,
  CMPCell,
  ExitTriggerCell,
  ProficiencyGrowthAreasCell,
  PlanFollowedCell
} from "./cells";

// ✅ SOLUTION 4: Import Virtual Scrolling for large datasets
import { FixedSizeList as List } from 'react-window';



interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  editable?: boolean;
  calculated?: boolean;
  description?: string;
}

interface TradeTableProps {
  // Data
  trades: Trade[];
  columns: Column[];
  
  // Pagination
  page: number;
  pages: number;
  rowsPerPage: number;
  rowsPerPageOptions: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  
  // Sorting
  sortDescriptor: SortDescriptor;
  onSortChange: (sort: SortDescriptor) => void;
  
  // UI State
  isNotesWrapEnabled: boolean;
  onNotesWrapChange: (enabled: boolean) => void;
  
  // Cell rendering (legacy - will be replaced by TradeTableRow)
  renderCell?: (trade: Trade, columnKey: string) => React.ReactNode;

  // Row-level actions
  onInlineEditSave: (tradeId: string, field: keyof Trade, value: any) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (trade: Trade) => void;

  // Chart actions (optional)
  onViewChart?: (chartImage: any, title: string) => void;
  onUploadCharts?: (trade: Trade) => void;

  // Calculations for rows
  getAccountingAwareValues: (trade: Trade) => any;
  formatCurrency: (value: number) => string;
  formatCellValue: (value: any, key: string) => string;
  getValueColor: (value: any, key: string) => string;

  // Tooltip data
  precomputedTooltips?: Map<string, any>;

  // Actions
  onAddTrade: () => void;
  onAutoNumberTrades: () => void;
  onImportCSV?: () => void;
  
  // Loading state
  isLoading?: boolean;

  // Empty state
  emptyContent?: React.ReactNode;

  // ✅ SOLUTION 4: Virtual scrolling options
  enableVirtualization?: boolean;
  estimateSize?: number;
}

/**
 * TradeTable - Extracted table component with pagination and sorting
 * 
 * ARCHITECTURAL BENEFITS:
 * - Single responsibility: Only handles table display and interactions
 * - Isolated state: Table-specific state doesn't affect other components
 * - Reusable: Can be used in different contexts (reports, analysis, etc.)
 * - Performance: Memoized to prevent unnecessary re-renders
 * - Maintainable: Clear separation of table logic from business logic
 */
export const TradeTable: React.FC<TradeTableProps> = React.memo(function TradeTable({
  trades,
  columns,
  page,
  pages,
  rowsPerPage,
  rowsPerPageOptions,
  onPageChange,
  onRowsPerPageChange,
  sortDescriptor,
  onSortChange,
  isNotesWrapEnabled,
  onNotesWrapChange,
  renderCell,
  onInlineEditSave,
  onEditTrade,
  onDeleteTrade,
  onViewChart,
  onUploadCharts,
  getAccountingAwareValues,
  formatCurrency,
  formatCellValue,
  getValueColor,
  precomputedTooltips,
  onAddTrade,
  onAutoNumberTrades,
  onImportCSV,
  isLoading = false,
  emptyContent,
  enableVirtualization = false,
  estimateSize = 60
}) {
  // Memoize table rows for performance - ensure proper structure for HeroUI
  const memoizedTableRows = useMemo(() => {
    if (!trades || !Array.isArray(trades)) {
      console.log('TradeTable: trades is not a valid array:', trades);
      return [];
    }

    return trades.map((trade, index) => {
      if (!trade || typeof trade !== 'object' || !trade.id) {
        console.log('TradeTable: Invalid trade object at index', index, ':', trade);
        return null;
      }

      // Return the trade object directly with a key property for HeroUI
      return {
        ...trade,
        key: `${trade.id}-${index}` // HeroUI requires a key property
      };
    }).filter(Boolean);
  }, [trades]);

  // Enhanced cell rendering function
  const renderCellContent = useCallback((trade: Trade, columnKey: string) => {
    const cellValue = trade[columnKey as keyof Trade];

    // Handle special cell types
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

        const { fields = [], tradeName = '', accountingMethod = '' } = tradeDetailsTooltip || {};
        const tooltipContent = (
          <div className="p-3 text-xs max-w-2xl break-words">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold text-sm">Trade Details: {tradeName}</h4>
              <div className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                {accountingMethod}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {fields && Array.isArray(fields) && fields.map((field: any) => (
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

      case 'notes':
        return (
          <NotesCell
            key={`${trade.id}-notes`}
            value={trade.notes || ''}
            onSave={(value) => onInlineEditSave(trade.id, 'notes', value)}
            isWrapEnabled={isNotesWrapEnabled}
          />
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

      case 'cmp':
        return (
          <CMPCell
            key={`${trade.id}-cmp`}
            value={trade.cmp}
            isAutoFetched={trade._cmpAutoFetched}
            onSave={(value) => onInlineEditSave(trade.id, 'cmp', value)}
          />
        );

      // Trade number with upload button
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
            <Tooltip content="Upload Charts">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => onUploadCharts && onUploadCharts(trade)}
                className="w-3 h-3 min-w-3 rounded p-0 hover:bg-primary/10 transition opacity-60 hover:opacity-90"
              >
                <Icon icon="lucide:upload" className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        );

      // Date fields - editable
      case "date":
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

      // Price fields - editable
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

      // Quantity fields - editable
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

      case "rewardRisk":
        // Reward:Risk with complex tooltip
        const rrTooltipData = precomputedTooltips.get(trade.id)?.rewardRisk;
        if (!rrTooltipData) {
          return (
            <div className="py-1 px-2 text-right whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
              {formatCellValue(cellValue, columnKey)}
            </div>
          );
        }

        const {
          entryBreakdown = [],
          traditionalWeightedRR = 0,
          effectiveRR = 0,
          hasRiskFreePositions = false,
          totalRiskAmount = 0,
          totalRewardAmount = 0
        } = rrTooltipData || {};

        const rrTooltipContent = (
          <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[180px]">
            <div className="font-semibold">Reward:Risk Breakdown</div>
            {entryBreakdown && Array.isArray(entryBreakdown) && entryBreakdown.map((e: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-0.5 border-b border-divider pb-1 mb-1 last:border-0 last:pb-0 last:mb-0">
                <div className="font-medium">{e.label} (Entry: {e.price})</div>
                <div><b>Risk:</b> {e.rawRisk.toFixed(2)}</div>
                <div><b>Reward:</b> {e.rewardFormula}</div>
                <div><b>R:R:</b> <span className={`${e.isRiskFree ? 'text-success font-bold' : 'text-primary'}`}>
                  {e.isRiskFree ? '∞ (Risk-Free)' : `${e.rrValue % 1 === 0 ? e.rrValue.toFixed(0) : e.rrValue.toFixed(2)}R`}
                </span></div>
              </div>
            ))}
            <div className="font-semibold mt-1 border-t border-divider pt-1">Overall Analysis</div>
            <div>
              <b>Traditional R:R:</b> <span className='text-primary'>{traditionalWeightedRR % 1 === 0 ? traditionalWeightedRR.toFixed(0) : traditionalWeightedRR.toFixed(2)}R</span>
            </div>
            <div>
              <b>Effective R:R:</b> <span className={`${effectiveRR === Infinity ? 'text-success font-bold' : 'text-primary'}`}>
                {effectiveRR === Infinity ? '∞ (Risk-Free)' : `${effectiveRR % 1 === 0 ? effectiveRR.toFixed(0) : effectiveRR.toFixed(2)}R`}
              </span>
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

        const { displayDays = 0, lotBreakdown = [], isOpenPosition = false, isPartialPosition = false } = holdingDaysTooltip || {};
        let holdingTooltipContent;
        if (isOpenPosition) {
          holdingTooltipContent = (
            <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
              <div className="font-semibold">Holding Days</div>
              {lotBreakdown && Array.isArray(lotBreakdown) && lotBreakdown.filter((l: any) => !l.exited).map((l: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{l.label}</span>
                  <span className="font-mono">{l.days} day{l.days !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <div className="text-foreground-500 mt-1 text-[10px]">
                Days since entry for each open lot.
              </div>
            </div>
          );
        } else if (isPartialPosition) {
          holdingTooltipContent = (
            <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
              <div className="font-semibold">Holding Days</div>
              {lotBreakdown && Array.isArray(lotBreakdown) && lotBreakdown.map((l: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{l.label} {l.exited ? '(sold)' : '(open)'}</span>
                  <span className="font-mono">{l.days} day{l.days !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <div className="text-foreground-500 mt-1 text-[10px]">
                Days since entry for open lots, entry to exit for sold lots (FIFO).
              </div>
            </div>
          );
        } else {
          holdingTooltipContent = (
            <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
              <div className="font-semibold">Holding Days</div>
              {lotBreakdown && Array.isArray(lotBreakdown) && lotBreakdown.map((l: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{l.label}</span>
                  <span className="font-mono">{l.days} day{l.days !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <div className="text-foreground-500 mt-1 text-[10px]">
                Entry to exit for each lot (FIFO).
              </div>
            </div>
          );
        }

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
            <div className="py-1 px-2 flex items-center gap-0.5 relative">
              {displayDays}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-circle text-warning cursor-help" style={{marginLeft: 2}}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </Tooltip>
        );

      // Stock Move with complex tooltip
      case "stockMove":
        const stockMoveTooltip = precomputedTooltips.get(trade.id)?.stockMove;
        if (!stockMoveTooltip) {
          return (
            <div className="py-1 px-2 text-right whitespace-nowrap">
              {formatCellValue(cellValue, columnKey)}
            </div>
          );
        }

        const { individualMoves = [], positionStatus } = stockMoveTooltip || {};
        const formatPercentage = (value: number | null | undefined): string => {
          if (value === null || value === undefined) return "-";
          return `${value.toFixed(2)}%`;
        };

        const stockMoveTooltipContent = (
          <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[180px]">
            <div className="font-semibold">Individual Stock Moves:</div>
            {individualMoves && Array.isArray(individualMoves) && individualMoves.map((move: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{move.description} <span className="text-foreground-400">({move.qty} qty)</span></span>
                <span className="font-mono">{formatPercentage(move.movePercent)}</span>
              </div>
            ))}
            <div className="text-foreground-500 mt-1 text-[10px]">
              {positionStatus === 'Open'
                ? '* Unrealized moves based on CMP vs. entry prices.'
                : positionStatus === 'Partial'
                  ? '* Mixed moves: Realized (Avg. Exit) for exited qty, Unrealized (CMP) for open qty.'
                  : '* Realized moves based on Avg. Exit vs. entry prices.'}
            </div>
          </div>
        );

        return (
          <Tooltip
            content={stockMoveTooltipContent}
            placement="top"
            delay={100}
            closeDelay={50}
            radius="sm"
            shadow="md"
            classNames={{ content: "bg-content1 border border-divider z-50" }}
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

      // Chart Attachments - Complex chart viewing functionality
      case "chartAttachments":
        const hasBeforeEntry = trade.chartAttachments?.beforeEntry;
        const hasAfterExit = trade.chartAttachments?.afterExit;
        const chartKey = `${trade.id}-${hasBeforeEntry?.id || 'no-before'}-${hasAfterExit?.id || 'no-after'}`;

        if (!hasBeforeEntry && !hasAfterExit) {
          return (
            <div key={chartKey} className="flex items-center justify-center gap-2 py-2 px-3">
              <Tooltip content="No chart images uploaded for this trade. Click to upload charts.">
                <div className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-md px-2 py-1 hover:bg-gray-50"
                     onClick={() => onUploadCharts && onUploadCharts(trade)}>
                  <Icon icon="lucide:image-off" className="w-4 h-4" />
                  <span className="text-xs font-medium">No charts</span>
                </div>
              </Tooltip>
            </div>
          );
        }

        return (
          <div key={chartKey} className="flex items-center justify-center gap-1 py-1 px-2">
            {hasBeforeEntry && (
              <Tooltip content="View Before Entry Chart">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => onViewChart && onViewChart(
                    hasBeforeEntry,
                    `${trade.name} - Before Entry Chart`
                  )}
                  className="text-blue-500 hover:text-blue-600"
                >
                  <Icon icon="lucide:trending-up" className="w-4 h-4" />
                </Button>
              </Tooltip>
            )}
            {hasAfterExit && (
              <Tooltip content="View After Exit Chart">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => onViewChart && onViewChart(
                    hasAfterExit,
                    `${trade.name} - After Exit Chart`
                  )}
                  className="text-green-500 hover:text-green-600"
                >
                  <Icon icon="lucide:trending-down" className="w-4 h-4" />
                </Button>
              </Tooltip>
            )}
            {(hasBeforeEntry || hasAfterExit) && (
              <div className="text-xs text-gray-500 ml-1">
                {hasBeforeEntry && hasAfterExit ? '2' : '1'}
              </div>
            )}
          </div>
        );

      // Special handling for accounting-aware fields
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
        const pfImpactValues = getAccountingAwareValues(trade);
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(pfImpactValues.pfImpact, columnKey)}
          </div>
        );

      case "cummPf":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      // Non-editable calculated price fields
      case "avgEntry":
      case "avgExitPrice":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      // Non-editable calculated quantity fields
      case "positionSize":
      case "openQty":
      case "exitedQty":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap rounded-sm bg-default-50/50 dark:bg-gray-800/30 border-l-2 border-default-200 dark:border-gray-700">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      // Percentage fields
      case "allocation":
        return (
          <div className="py-1 px-2 text-right whitespace-nowrap">
            {formatCellValue(cellValue, columnKey)}
          </div>
        );

      case "slPercent":
        // Use calculated SL percent if available, otherwise calculate it
        const slPercent = cellValue || ((trade.sl && trade.entry) ?
          Math.abs((trade.sl - trade.entry) / trade.entry * 100) : 0);
        return (
          <div className="text-right font-medium text-small whitespace-nowrap">
            {slPercent > 0 ? `${slPercent.toFixed(2)}%` : "-"}
          </div>
        );

      case "unrealizedPL":
        if (trade.positionStatus === 'Open' || trade.positionStatus === 'Partial') {
          return (
            <div className={`py-1 px-2 text-right whitespace-nowrap ${getValueColor(cellValue, columnKey)}`}>
              {formatCellValue(cellValue, columnKey)}
            </div>
          );
        } else {
          return <div className="py-1 px-2 text-right whitespace-nowrap">-</div>;
        }

      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content="Edit trade (modal)">
              <Button
                isIconOnly
                variant="light"
                onPress={() => onEditTrade(trade)}
                className="w-5 h-5 min-w-5 rounded p-0.5 hover:bg-primary/10 transition"
              >
                <Icon icon="lucide:edit-3" className="w-3 h-3" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete trade">
              <Button
                isIconOnly
                variant="light"
                color="danger"
                onPress={() => onDeleteTrade(trade)}
                className="w-5 h-5 min-w-5 rounded p-0.5 hover:bg-danger/10 transition"
              >
                <Icon icon="lucide:trash-2" className="w-3 h-3" />
              </Button>
            </Tooltip>
          </div>
        );

      // Default case for other fields
      default:
        return (
          <div className="py-1 px-2 text-sm">
            {cellValue !== undefined && cellValue !== null ? String(cellValue) : '-'}
          </div>
        );
    }
  }, [onInlineEditSave]);

  // Get column class names with indicators - FIXED: Add proper widths for virtual table
  const getColumnClassName = useCallback((key: string) => {
    if (key === "name") return "sticky-name-header min-w-[200px] max-w-[200px]";
    if (key === "notes") return "min-w-[250px] max-w-[400px]";
    if (key === "date") return "min-w-[110px] max-w-[110px]";
    if (key === "setup") return "min-w-[140px] max-w-[140px]";
    if (key === "buySell") return "min-w-[90px] max-w-[90px]";
    if (key === "entry" || key === "avgEntry") return "min-w-[100px] max-w-[100px]";
    if (key === "sl" || key === "tsl" || key === "cmp") return "min-w-[80px] max-w-[80px]";
    if (key === "slPercent") return "min-w-[80px] max-w-[80px]";
    if (key === "initialQty") return "min-w-[100px] max-w-[100px]";
    if (key === "positionStatus") return "min-w-[100px] max-w-[100px]";
    if (key === "planFollowed") return "min-w-[90px] max-w-[90px]";
    if (key === "exitTrigger") return "min-w-[140px] max-w-[140px]";
    if (key === "proficiencyGrowthAreas") return "min-w-[180px] max-w-[180px]";
    return "min-w-[100px] max-w-[100px]";
  }, []);

  // Get column indicator icon
  const getColumnIndicator = useCallback((column: Column) => {
    if (column.calculated) {
      return (
        <Tooltip content="Calculated field - automatically computed" placement="top" size="sm">
          <Icon icon="lucide:calculator" className="w-3 h-3 text-primary opacity-60 ml-1" />
        </Tooltip>
      );
    }
    if (column.editable) {
      return (
        <Tooltip content="Editable field - click to edit" placement="top" size="sm">
          <Icon icon="lucide:edit-3" className="w-3 h-3 text-success opacity-60 ml-1" />
        </Tooltip>
      );
    }
    return null;
  }, []);

  // FIXED: Virtual Row Component using same logic as regular table
  const VirtualRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const trade = memoizedTableRows[index] as Trade & { key: string };
    if (!trade) return null;

    return (
      <div style={style} className="flex border-b border-default-200 dark:border-gray-800 hover:bg-default-50 dark:hover:bg-gray-800 dark:bg-gray-900 group">
        {columns.map((column) => (
          <div
            key={`${trade.id}-${column.key}`}
            className={`${getColumnClassName(column.key)} py-1.5 px-2 text-xs border-b border-default-200 dark:border-gray-800 text-foreground-800 dark:text-gray-200 transition-colors duration-150 ${column.key === "name" ? "sticky-name-cell" : ""} ${
              column.key === "actions" ? "text-right" : "text-left"
            }`}
          >
            {renderCellContent(trade, column.key)}
          </div>
        ))}
      </div>
    );
  }, [memoizedTableRows, columns, renderCellContent]);

  // Handle rows per page change
  const handleRowsPerPageChange = useCallback((keys: any) => {
    const selected = Array.from(keys)[0] as string;
    const newRowsPerPage = Number(selected);
    onRowsPerPageChange(newRowsPerPage);
  }, [onRowsPerPageChange]);

  // Empty state component - Match original exactly - Memoized to prevent flickering
  const EmptyState = React.memo(() => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center min-h-[400px]">
      <div className="mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
          <Icon
            icon="lucide:inbox"
            className="w-6 h-6 text-slate-400 dark:text-slate-500"
          />
        </div>
      </div>
      <div className="text-slate-700 dark:text-slate-300 text-2xl font-semibold mb-3">
        No trades found
      </div>
      <div className="text-slate-500 dark:text-slate-400 text-base mb-8 max-w-md">
        Add your first trade to get started with your trading journal
      </div>
      <div className="flex flex-col gap-4 items-center">
        <Button
          variant="solid"
          size="md"
          onPress={onAddTrade}
          startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
          className="font-semibold px-6 py-2.5 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-md hover:shadow-lg rounded-lg"
        >
          Add Your First Trade
        </Button>
        <div className="text-default-400 text-sm font-medium">or</div>
        <Button
          variant="bordered"
          size="md"
          onPress={onImportCSV}
          startContent={<Icon icon="lucide:upload" className="w-4 h-4" />}
          className="font-medium px-6 py-2.5 border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300 transition-all duration-200 rounded-lg"
        >
          Import from CSV
        </Button>
      </div>
    </div>
  ));

  // Show empty state when no trades - Simplified condition to prevent flickering
  // Don't depend on isLoading state which can change frequently
  if (trades.length === 0) {
    return emptyContent || <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Custom CSS for sticky name column and virtual scrolling */}
      <style dangerouslySetInnerHTML={{__html: `
        .sticky-name-header {
          position: sticky !important;
          left: 0 !important;
          z-index: 30 !important;
          background: rgb(244 244 245) !important; /* bg-default-100 */
          min-width: 200px !important;
          max-width: 200px !important;
        }
        .sticky-name-cell {
          position: sticky !important;
          left: 0 !important;
          z-index: 20 !important;
          background: white !important;
          min-width: 200px !important;
          max-width: 200px !important;
        }
        .dark .sticky-name-header {
          background: rgb(17 24 39) !important; /* dark:bg-gray-950 */
        }
        .dark .sticky-name-cell {
          background: rgb(17 24 39) !important; /* dark:bg-gray-900 */
        }

        /* FIXED: Virtual table styling to match regular table exactly */
        .virtual-table-container {
          /* Match regular table wrapper styling */
          overflow-x: auto;
          min-width: 100%;
        }
        .virtual-trade-list {
          scrollbar-width: thin;
          scrollbar-color: rgb(156 163 175) transparent;
          overflow-x: auto !important;
        }
        .virtual-trade-list::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .virtual-trade-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .virtual-trade-list::-webkit-scrollbar-thumb {
          background-color: rgb(156 163 175);
          border-radius: 4px;
        }
        .virtual-trade-list::-webkit-scrollbar-thumb:hover {
          background-color: rgb(107 114 128);
        }
      `}} />

      {/* Container with scrollbar at bottom - Match original exactly */}
      <div
        className="relative overflow-x-auto overflow-y-auto max-h-[70vh] scrollbar-ultra-thin smooth-scroll"
        style={{
          /* Always show horizontal scrollbar and make it sticky */
          overflowX: 'scroll',
          position: 'sticky',
          bottom: 0
        }}
      >


        <motion.div
          key={`page-${page}-${isNotesWrapEnabled}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{
            duration: 0.15,
            ease: [0.4, 0.0, 0.2, 1],
            opacity: { duration: 0.1 },
            y: { duration: 0.15 }
          }}
          className="will-change-transform transform-gpu"
        >
          {/* FIXED: Virtual Scrolling for pages with 100+ rows with proper sticky headers */}
          {enableVirtualization ? (
            <div className="virtual-table-container">
              {/* FIXED: Match regular table header colors exactly */}
              <div className="flex sticky top-0 z-20">
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={`${getColumnClassName(column.key)} text-foreground-600 dark:text-white text-xs font-medium uppercase border-b border-default-200 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm transition-colors duration-150 py-1.5 px-2 ${
                      column.editable === false ? 'bg-default-50 dark:bg-gray-800/50' : 'bg-primary-50/30 dark:bg-primary-900/10'
                    }`}
                  >
                    {/* FIXED: Add same special header content as regular table */}
                    {column.key === "notes" ? (
                      <div className="flex items-center justify-start gap-3 h-6">
                        <div className="flex items-center justify-start gap-1.5">
                          <span className="font-semibold text-sm text-foreground-700 leading-none">{column.label}</span>
                          <Icon
                            icon="lucide:edit-3"
                            className="w-2 h-2 text-gray-300 flex-shrink-0"
                            title="Editable column"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 h-6">
                          {/* Notes wrap toggle */}
                          <motion.div
                            className="relative flex items-center"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                          >
                            <Switch
                              size="sm"
                              isSelected={isNotesWrapEnabled}
                              onValueChange={onNotesWrapChange}
                              aria-label="Toggle notes text wrapping"
                              classNames={{
                                wrapper: clsx(
                                  "h-5 w-9 transition-all duration-300 ease-out",
                                  "bg-gradient-to-r from-default-200 to-default-300",
                                  "dark:from-gray-700 dark:to-gray-800",
                                  "group-data-[selected=true]:from-gray-800 group-data-[selected=true]:to-black",
                                  "dark:group-data-[selected=true]:from-gray-900 dark:group-data-[selected=true]:to-black",
                                  "shadow-sm hover:shadow-md",
                                  "border border-default-300 dark:border-gray-600",
                                  "group-data-[selected=true]:border-gray-700 dark:group-data-[selected=true]:border-gray-500"
                                ),
                                thumb: clsx(
                                  "w-3.5 h-3.5 transition-all duration-300 ease-out",
                                  "bg-white shadow-lg",
                                  "group-data-[selected=true]:bg-white",
                                  "group-data-[selected=true]:shadow-xl",
                                  "border border-default-400 dark:border-gray-500"
                                ),
                                base: "transition-all duration-300"
                              }}
                            />
                          </motion.div>

                          {/* Info tooltip */}
                          <Tooltip
                            content={
                              <div className="max-w-xs p-2">
                                <div className="font-semibold text-sm mb-1">Notes Text Wrapping</div>
                                <div className="text-xs text-foreground-600 leading-relaxed">
                                  {isNotesWrapEnabled
                                    ? "Notes will wrap to multiple lines for better readability. This may increase row height."
                                    : "Notes will be truncated on a single line to maintain compact table layout."
                                  }
                                </div>
                              </div>
                            }
                            placement="bottom"
                            className="animate-fade-in"
                            classNames={{
                              content: "bg-content1/95 backdrop-blur-md border border-divider/50 shadow-xl"
                            }}
                          >
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              whileTap={{ scale: 0.9 }}
                              transition={{ duration: 0.15 }}
                              className={clsx(
                                "flex items-center justify-center",
                                "w-4 h-4 rounded-full cursor-help",
                                "bg-gradient-to-br from-default-100 to-default-200",
                                "dark:from-gray-700 dark:to-gray-800",
                                "border border-default-300 dark:border-gray-600",
                                "hover:from-primary-100 hover:to-primary-200",
                                "dark:hover:from-primary-900/50 dark:hover:to-primary-800/50",
                                "hover:border-primary-400 dark:hover:border-primary-500",
                                "transition-all duration-200 ease-out",
                                "shadow-sm hover:shadow-md"
                              )}
                            >
                              <Icon
                                icon="lucide:info"
                                className={clsx(
                                  "w-2.5 h-2.5 transition-colors duration-200",
                                  "text-default-600 dark:text-gray-400",
                                  "hover:text-primary-600 dark:hover:text-primary-400"
                                )}
                              />
                            </motion.div>
                          </Tooltip>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-start gap-1.5 h-6">
                        <span className="font-semibold text-sm text-foreground-700 leading-none">{column.label}</span>
                        {column.editable === true ? (
                          <Icon
                            icon="lucide:edit-3"
                            className="w-2 h-2 text-gray-300 flex-shrink-0"
                            title="Editable column - Click cells to edit"
                          />
                        ) : column.editable === false ? (
                          <Icon
                            icon="lucide:calculator"
                            className="w-2 h-2 text-default-400 dark:text-gray-500 flex-shrink-0"
                            title="Calculated column - Auto-computed values"
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* FIXED: Virtual Scrolling List with increased height for unlimited scrolling */}
              <List
                height={Math.min(600, window.innerHeight * 0.6)} // Dynamic height based on viewport
                itemCount={memoizedTableRows.length}
                itemSize={estimateSize}
                width="100%"
                className="virtual-trade-list"
              >
                {VirtualRow}
              </List>
            </div>
          ) : (
            // Standard Table for smaller datasets
            <Table
              key={`table-${isNotesWrapEnabled}`}
              aria-label="Trade journal table"
              className="trade-table gpu-accelerated"
              classNames={{
                base: "min-w-full",
                wrapper: "shadow-none p-0 rounded-none overflow-x-auto",
                table: "table-auto min-w-max",
                thead: "[&>tr]:first:shadow-none",
                th: "bg-default-100 dark:bg-gray-950 text-foreground-600 dark:text-white text-xs font-medium uppercase border-b border-default-200 dark:border-gray-800 sticky top-0 z-20 backdrop-blur-sm transition-colors duration-150 py-1.5 px-2",
                td: "py-1.5 px-2 text-xs border-b border-default-200 dark:border-gray-800 text-foreground-800 dark:text-gray-200 transition-colors duration-150"
              }}
              sortDescriptor={sortDescriptor as HeroSortDescriptor}
              onSortChange={onSortChange as (descriptor: HeroSortDescriptor) => void}
            >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn
                  key={column.key}
                  align={column.key === "actions" ? "end" : "start"}
                  allowsSorting={column.sortable}
                  className={`${getColumnClassName(column.key)} ${
                    column.editable === false ? 'bg-default-50 dark:bg-gray-800/50' : 'bg-primary-50/30 dark:bg-primary-900/10'
                  }`}
                >
                  {column.key === "notes" ? (
                    <div className="flex items-center justify-start gap-3 h-6">
                      <div className="flex items-center justify-start gap-1.5">
                        <span className="font-semibold text-sm text-foreground-700 leading-none">{column.label}</span>
                        <Icon
                          icon="lucide:edit-3"
                          className="w-2 h-2 text-gray-300 flex-shrink-0"
                          title="Editable column"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 h-6">
                        {/* Notes wrap toggle */}
                        <motion.div
                          className="relative flex items-center"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        >
                          <Switch
                            size="sm"
                            isSelected={isNotesWrapEnabled}
                            onValueChange={onNotesWrapChange}
                            aria-label="Toggle notes text wrapping"
                            classNames={{
                              wrapper: clsx(
                                "h-5 w-9 transition-all duration-300 ease-out",
                                "bg-gradient-to-r from-default-200 to-default-300",
                                "dark:from-gray-700 dark:to-gray-800",
                                "group-data-[selected=true]:from-gray-800 group-data-[selected=true]:to-black",
                                "dark:group-data-[selected=true]:from-gray-900 dark:group-data-[selected=true]:to-black",
                                "shadow-sm hover:shadow-md",
                                "border border-default-300 dark:border-gray-600",
                                "group-data-[selected=true]:border-gray-700 dark:group-data-[selected=true]:border-gray-500"
                              ),
                              thumb: clsx(
                                "w-3.5 h-3.5 transition-all duration-300 ease-out",
                                "bg-white shadow-lg",
                                "group-data-[selected=true]:bg-white",
                                "group-data-[selected=true]:shadow-xl",
                                "border border-default-400 dark:border-gray-500"
                              ),
                              base: "transition-all duration-300"
                            }}
                          />
                        </motion.div>

                        {/* Info tooltip */}
                        <Tooltip
                          content={
                            <div className="max-w-xs p-2">
                              <div className="font-semibold text-sm mb-1">Notes Text Wrapping</div>
                              <div className="text-xs text-foreground-600 leading-relaxed">
                                {isNotesWrapEnabled
                                  ? "Notes will wrap to multiple lines for better readability. This may increase row height."
                                  : "Notes will be truncated on a single line to maintain compact table layout."
                                }
                              </div>
                            </div>
                          }
                          placement="bottom"
                          className="animate-fade-in"
                          classNames={{
                            content: "bg-content1/95 backdrop-blur-md border border-divider/50 shadow-xl"
                          }}
                        >
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className={clsx(
                              "flex items-center justify-center",
                              "w-4 h-4 rounded-full cursor-help",
                              "bg-gradient-to-br from-default-100 to-default-200",
                              "dark:from-gray-700 dark:to-gray-800",
                              "border border-default-300 dark:border-gray-600",
                              "hover:from-primary-100 hover:to-primary-200",
                              "dark:hover:from-primary-900/50 dark:hover:to-primary-800/50",
                              "hover:border-primary-400 dark:hover:border-primary-500",
                              "transition-all duration-200 ease-out",
                              "shadow-sm hover:shadow-md"
                            )}
                          >
                            <Icon
                              icon="lucide:info"
                              className={clsx(
                                "w-2.5 h-2.5 transition-colors duration-200",
                                "text-default-600 dark:text-gray-400",
                                "hover:text-primary-600 dark:hover:text-primary-400"
                              )}
                            />
                          </motion.div>
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-start gap-1.5 h-6">
                      <span className="font-semibold text-sm text-foreground-700 leading-none">{column.label}</span>
                      {column.editable === true ? (
                        <Icon
                          icon="lucide:edit-3"
                          className="w-2 h-2 text-gray-300 flex-shrink-0"
                          title="Editable column - Click cells to edit"
                        />
                      ) : column.editable === false ? (
                        <Icon
                          icon="lucide:calculator"
                          className="w-2 h-2 text-default-400 dark:text-gray-500 flex-shrink-0"
                          title="Calculated column - Auto-computed values"
                        />
                      ) : null}
                    </div>
                  )}
                </TableColumn>
              )}
            </TableHeader>
            
            <TableBody
              items={memoizedTableRows}
              isLoading={isLoading}
              emptyContent={isLoading ? " " : ""}
            >
              {(trade) => {
                const tradeData = trade as Trade & { key: string };

                return (
                  <TableRow
                    key={tradeData.key}
                    className="trade-table-row hover:bg-default-50 dark:hover:bg-gray-800 dark:bg-gray-900 group gpu-accelerated"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={`${tradeData.id}-${column.key}`}
                        className={`trade-table-cell ${column.key === "name" ? "sticky-name-cell sticky-header" : ""}`}
                      >
                        {renderCellContent(tradeData, column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              }}
            </TableBody>
          </Table>
          )}
        </motion.div>

        {/* Pagination Controls - Inside scrollable container so scrollbar appears at bottom */}
        {pages > 0 && (
        <div className="sticky bottom-0 left-0 right-0 z-10 flex justify-between items-center px-6 py-1.5 border-t border-divider/50 bg-background/95 backdrop-blur-sm">
          {/* Rows per page and action buttons */}
          <div className="flex items-center gap-2">
            <span className="text-base text-default-800 font-medium">
              Rows per page:
            </span>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="light"
                  size="sm"
                  className="min-w-14 h-7 text-base px-3 text-default-800 hover:text-default-900 hover:bg-default-100 font-medium"
                  endContent={<Icon icon="lucide:chevron-down" className="w-3.5 h-3.5" />}
                >
                  {rowsPerPage}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Rows per page"
                selectionMode="single"
                selectedKeys={[String(rowsPerPage)]}
                onSelectionChange={handleRowsPerPageChange}
                classNames={{
                  content: "bg-content1/95 backdrop-blur-md border border-divider/50 shadow-xl rounded-lg",
                  item: "hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors duration-150"
                }}
              >
                {rowsPerPageOptions.map(option => (
                  <DropdownItem key={String(option)} className="font-medium">
                    {option}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>

            {/* Action buttons */}
            {trades.length > 0 && (
              <>
                <MobileTooltip content="Add new trade (inline)" placement="top">
                  <Button
                    isIconOnly
                    color="primary"
                    variant="light"
                    onPress={onAddTrade}
                    size="sm"
                    className="w-8 h-8 min-w-8 ml-2"
                  >
                    <Icon icon="lucide:list-plus" className="text-base" />
                  </Button>
                </MobileTooltip>

                <MobileTooltip content="Auto-number all trades as 1, 2, 3..." placement="top">
                  <Button
                    isIconOnly
                    color="secondary"
                    variant="light"
                    onPress={onAutoNumberTrades}
                    size="sm"
                    className="w-6 h-6 min-w-6 ml-1"
                  >
                    <Icon icon="lucide:hash" className="text-xs" />
                  </Button>
                </MobileTooltip>
              </>
            )}
          </div>

          {/* Pagination */}
          <div>
            <Pagination
              isCompact
              showControls
              showShadow={false}
              color="default"
              size="sm"
              variant="light"
              page={page}
              total={pages}
              onChange={onPageChange}
              classNames={{
                wrapper: "gap-1",
                item: "w-6 h-6 text-xs font-light text-default-600 hover:text-default-800 hover:bg-default-100",
                cursor: "w-6 h-6 text-xs font-normal bg-gray-600 text-white rounded-md",
                prev: "w-6 h-6 text-xs font-light text-default-600 hover:text-default-800 hover:bg-default-100",
                next: "w-6 h-6 text-xs font-light text-default-600 hover:text-default-800 hover:bg-default-100",
                ellipsis: "text-xs font-light text-default-500"
              }}
            />
          </div>

          {/* Compact trade count - Match original exactly */}
          <div className="flex flex-col items-end gap-0.5">
            <div className="text-xs">
              <span className="text-default-600">
                {`${((page - 1) * rowsPerPage) + 1}-${Math.min(page * rowsPerPage, trades.length)} of `}
              </span>
              <span className="text-primary-600 font-medium">
                {trades.length}
              </span>
            </div>
            {pages > 1 && (
              <div className="text-xs">
                <span className="text-default-600">Page </span>
                <span className="text-primary-600 font-medium">{page}</span>
                <span className="text-default-600"> of </span>
                <span className="text-primary-600 font-medium">{pages}</span>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
});
