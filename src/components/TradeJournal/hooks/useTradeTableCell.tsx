import React, { useCallback } from 'react';
import { Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Trade } from "../../../types/trade";

// Import all existing cell components
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
} from '../cells';

interface UseTradeTableCellProps {
  trade: Trade;
  onInlineEditSave: (tradeId: string, field: keyof Trade, value: any) => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (trade: Trade) => void;
  onViewChart?: (chartImage: any, title: string) => void;
  onUploadCharts?: (trade: Trade) => void;
  getAccountingAwareValues: (trade: Trade) => any;
  formatCurrency: (value: number) => string;
  formatCellValue: (value: any, key: string) => string;
  getValueColor: (value: any, key: string) => string;
  isNotesWrapEnabled: boolean;
  precomputedTooltips: Map<string, any>;
}

export const useTradeTableCell = ({
  trade,
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
  precomputedTooltips
}: UseTradeTableCellProps) => {

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
          <NotesCell
            key={`${trade.id}-notes`}
            value={trade.notes || ''}
            onSave={(value) => onInlineEditSave(trade.id, 'notes', value)}
            isWrapEnabled={isNotesWrapEnabled}
          />
        );

      case 'cmp':
        return (
          <CMPCell
            key={`${trade.id}-cmp`}
            value={trade.cmp}
            onSave={(value) => onInlineEditSave(trade.id, 'cmp', value)}
          />
        );

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
    precomputedTooltips
  ]);

  return { renderCell };
};
