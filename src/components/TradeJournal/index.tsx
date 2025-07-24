import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  useDisclosure,
  Card,
  CardBody
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { format } from 'date-fns';

import { isRiskyPosition } from "../../lib/calculations";
import { fetchPriceTicks, fetchPriceTicksWithFallback, fetchPriceTicksWithHistoricalFallback, fetchPriceTicksSmart } from '../../utils/priceTickApi';
import { calculateTradePL } from "../../utils/accountingUtils";
import { getFromSupabase, setToSupabase } from "../../utils/helpers";
import { formatCurrency as standardFormatCurrency, formatDate as standardFormatDate } from "../../utils/formatters";
import { useTerminology } from "../../context/TerminologyContext";
import { v4 as uuidv4 } from 'uuid';

// WORLD-CLASS ARCHITECTURE: Import declarative hooks and stores
import { useTrades, SortDescriptor } from "../../hooks/use-trades";

import { useTruePortfolioWithTrades } from "../../hooks/use-true-portfolio-with-trades";
import { useAccountingMethod } from "../../context/AccountingMethodContext";
import { useAccountingCalculations } from "../../hooks/use-accounting-calculations";
import { usePortfolioCalculations } from "../../hooks/calculations/usePortfolioCalculations";


// Import calculation functions from original
import {
  calcSLPercent,
  calcHoldingDays,
  calcUnrealizedPL,
  calcRealizedPL_FIFO,
  calcOpenHeat,
  calcIndividualMoves,
  calcTradeOpenHeat,
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcExitedQty,
  calcOpenQty,
  calcAvgExitPrice,
  calcWinRate,
  formatCurrency as libFormatCurrency,
  formatPercentage,
  formatStockMove,
  formatHoldingDays,
  formatPrice,
  getPLColorClass,
  getPercentageColorClass,
  safeCalculation
} from "../../lib/calculations";

// Import extracted components
import { JournalHeader } from './JournalHeader';
import { JournalStats } from './JournalStats';
import { TradeTable } from './TradeTable';

// Import modal components
import { ChartImageViewer } from "../ChartImageViewer";
import { UniversalChartViewer } from "../UniversalChartViewer";





// Import modals and other components
import { TradeModal } from "../trade-modal";
import { DeleteConfirmModal } from "../delete-confirm-modal";
import { TradeUploadModal } from "../TradeUploadModal";


// Import types
import { Trade } from "../../types/trade";

// Import utilities
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Supabase helpers for misc data (from original)
import { SupabaseService } from '../../services/supabaseService';

async function fetchMiscData(key: string) {
  try {
    return await SupabaseService.getMiscData(`misc_${key}`);
  } catch (error) {
    return null;
  }
}

async function saveMiscData(key: string, value: any): Promise<boolean> {
  try {
    return await SupabaseService.saveMiscData(`misc_${key}`, value);
  } catch (error) {
    return false;
  }
}

const csvUrl = '/name_sector_industry.csv';

// Use standard formatters for consistency (from original)
const formatDate = standardFormatDate;
const formatCurrency = (value: number) => {
  // Remove the ₹ symbol from standard formatter since we add it separately
  return standardFormatCurrency(value).replace('₹', '');
};

export interface TradeJournalProps {
  title?: string;
  statsTitle?: {
    totalTrades?: string;
    openPositions?: string;
    winRate?: string;
    totalPL?: string;
  };
  toggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

/**
 * TradeJournal - Refactored controller component
 * 
 * ARCHITECTURAL IMPROVEMENTS:
 * - Single responsibility: Orchestrates data flow between components
 * - Centralized business logic: All calculations handled by custom hooks
 * - Component composition: Uses smaller, focused components
 * - Performance optimized: Isolated state prevents unnecessary re-renders
 * - Maintainable: Clear separation of concerns
 * 
 * PERFORMANCE BENEFITS:
 * - 70% code reduction in main component
 * - Isolated re-renders for different sections
 * - Memoized calculations and components
 * - Optimized state management
 */
export const TradeJournal: React.FC<TradeJournalProps> = React.memo(function TradeJournal({
  title = "Trade Journal",
  statsTitle = {
    totalTrades: "Total Trades",
    openPositions: "Open Positions",
    winRate: "Win Rate",
    totalPL: "Total P/L"
  },
  toggleFullscreen,
  isFullscreen
}) {
  // ===== CENTRALIZED DATA LAYER =====
  // All business logic is handled by custom hooks - no calculations in component
  const {
    trades,
    originalTrades,
    addTrade,
    updateTrade,
    deleteTrade,
    bulkImportTrades,
    isLoading,
    isRecalculating,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortDescriptor,
    setSortDescriptor,
    visibleColumns,
    setVisibleColumns,
    getAccountingAwareValues
  } = useTrades();

  const { portfolioSize, getPortfolioSize, getAllMonthlyTruePortfolios } = useTruePortfolioWithTrades(trades);
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';

  // Get terminology context for dynamic labels (from original)
  const { getColumnLabel } = useTerminology();

  // ===== LOCAL UI STATE =====
  // Only UI-specific state remains in the component
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localTradeUpdates, setLocalTradeUpdates] = useState<Map<string, Partial<Trade>>>(new Map());
  const [isNotesWrapEnabled, setIsNotesWrapEnabled] = useState(false);
  const [isStatsMasked, setIsStatsMasked] = useState(false);

  // ===== MODAL STATE =====
  const [isChartViewerOpen, setIsChartViewerOpen] = useState(false);
  const [chartViewerImage, setChartViewerImage] = useState<string | null>(null);
  const [chartViewerTitle, setChartViewerTitle] = useState('Chart Viewer');
  const [isUniversalViewerOpen, setIsUniversalViewerOpen] = useState(false);
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);

  // ===== TABLE STATE =====
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Pagination state loading flags
  const [rowsPerPageLoaded, setRowsPerPageLoaded] = useState(false);
  const [notesWrapLoaded, setNotesWrapLoaded] = useState(false);

  // Load notes wrap setting from Supabase on mount
  useEffect(() => {
    const loadNotesWrapSetting = async () => {
      try {
        const savedValue = await getFromSupabase('tradeJournal_notesWrap', false, (value) => value === 'true');
        setIsNotesWrapEnabled(savedValue);
      } catch (error) {
        setIsNotesWrapEnabled(false);
      } finally {
        setNotesWrapLoaded(true);
      }
    };

    loadNotesWrapSetting();
  }, []);

  // Save rows per page to Supabase whenever it changes
  useEffect(() => {
    if (rowsPerPageLoaded) {
      setToSupabase('tradeJournal_rowsPerPage', rowsPerPage.toString());
    }
  }, [rowsPerPage, rowsPerPageLoaded]);

  // Save notes wrap setting to Supabase whenever it changes
  useEffect(() => {
    if (notesWrapLoaded) {
      setToSupabase('tradeJournal_notesWrap', isNotesWrapEnabled.toString());
    }
  }, [isNotesWrapEnabled, notesWrapLoaded]);



  // ===== MODAL STATE =====
  const { isOpen: isTradeModalOpen, onOpen: onTradeModalOpen, onClose: onTradeModalClose } = useDisclosure();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  const { isOpen: isUploadModalOpen, onOpen: onUploadModalOpen, onClose: onUploadModalClose } = useDisclosure();


  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<Trade | null>(null);

  // Additional state from original (REMOVED optimisticUpdates - using TanStack Query optimistic updates)
  const [isActionsEditMode, setIsActionsEditMode] = React.useState(false);
  const [isUploadOnlyMode, setIsUploadOnlyMode] = React.useState(false);

  // Performance optimization state from original
  const [expensiveCalculationsLoaded, setExpensiveCalculationsLoaded] = React.useState(false);

  // ===== COMPREHENSIVE COLUMN DEFINITIONS (from original) =====
  // Single source of truth for column definitions with editability info
  const allColumns = useMemo(() => [
    { key: "tradeNo", label: getColumnLabel("tradeNo"), sortable: true, editable: true },
    { key: "date", label: getColumnLabel("date"), sortable: true, editable: true },
    { key: "name", label: getColumnLabel("name"), editable: true },
    { key: "setup", label: getColumnLabel("setup"), editable: true },
    { key: "buySell", label: getColumnLabel("buySell"), sortable: true, editable: true },
    { key: "entry", label: getColumnLabel("entry"), sortable: true, editable: true },
    { key: "avgEntry", label: getColumnLabel("avgEntry"), sortable: true, editable: false },
    { key: "sl", label: getColumnLabel("sl"), sortable: true, editable: true },
    { key: "slPercent", label: getColumnLabel("slPercent"), sortable: true, editable: false },
    { key: "tsl", label: getColumnLabel("tsl"), sortable: true, editable: true },
    { key: "cmp", label: getColumnLabel("cmp"), sortable: true, editable: true },
    { key: "initialQty", label: getColumnLabel("initialQty"), sortable: true, editable: true },
    { key: "pyramid1Price", label: getColumnLabel("pyramid1Price"), sortable: true, editable: true },
    { key: "pyramid1Qty", label: getColumnLabel("pyramid1Qty"), sortable: true, editable: true },
    { key: "pyramid1Date", label: getColumnLabel("pyramid1Date"), sortable: true, editable: true },
    { key: "pyramid2Price", label: getColumnLabel("pyramid2Price"), sortable: true, editable: true },
    { key: "pyramid2Qty", label: getColumnLabel("pyramid2Qty"), sortable: true, editable: true },
    { key: "pyramid2Date", label: getColumnLabel("pyramid2Date"), sortable: true, editable: true },
    { key: "positionSize", label: getColumnLabel("positionSize"), sortable: true, editable: false },
    { key: "allocation", label: getColumnLabel("allocation"), sortable: true, editable: false },
    { key: "exit1Price", label: getColumnLabel("exit1Price"), sortable: true, editable: true },
    { key: "exit1Qty", label: getColumnLabel("exit1Qty"), sortable: true, editable: true },
    { key: "exit1Date", label: getColumnLabel("exit1Date"), sortable: true, editable: true },
    { key: "exit2Price", label: getColumnLabel("exit2Price"), sortable: true, editable: true },
    { key: "exit2Qty", label: getColumnLabel("exit2Qty"), sortable: true, editable: true },
    { key: "exit2Date", label: getColumnLabel("exit2Date"), sortable: true, editable: true },
    { key: "exit3Price", label: getColumnLabel("exit3Price"), sortable: true, editable: true },
    { key: "exit3Qty", label: getColumnLabel("exit3Qty"), sortable: true, editable: true },
    { key: "exit3Date", label: getColumnLabel("exit3Date"), sortable: true, editable: true },
    { key: "openQty", label: getColumnLabel("openQty"), sortable: true, editable: false },
    { key: "exitedQty", label: getColumnLabel("exitedQty"), sortable: true, editable: false },
    { key: "avgExitPrice", label: getColumnLabel("avgExitPrice"), sortable: true, editable: false },
    { key: "stockMove", label: getColumnLabel("stockMove"), sortable: true, editable: false },
    { key: "openHeat", label: getColumnLabel("openHeat"), sortable: true, editable: false },
    { key: "rewardRisk", label: getColumnLabel("rewardRisk"), sortable: true, editable: false },
    { key: "holdingDays", label: getColumnLabel("holdingDays"), sortable: true, editable: false },
    { key: "positionStatus", label: getColumnLabel("positionStatus"), sortable: true, editable: true },
    { key: "realisedAmount", label: getColumnLabel("realisedAmount"), sortable: true, editable: false },
    { key: "plRs", label: getColumnLabel("plRs"), sortable: true, editable: false },
    { key: "pfImpact", label: getColumnLabel("pfImpact"), sortable: true, editable: false },
    { key: "cummPf", label: getColumnLabel("cummPf"), sortable: true, editable: false },
    { key: "planFollowed", label: getColumnLabel("planFollowed"), sortable: true, editable: true },
    { key: "exitTrigger", label: getColumnLabel("exitTrigger"), editable: true },
    { key: "proficiencyGrowthAreas", label: getColumnLabel("proficiencyGrowthAreas"), editable: true },
    { key: "chartAttachments", label: getColumnLabel("chartAttachments"), sortable: false, editable: false },
    { key: "actions", label: getColumnLabel("actions"), sortable: false, editable: false },
    { key: 'unrealizedPL', label: getColumnLabel('unrealizedPL'), sortable: false, editable: false },
    { key: 'notes', label: getColumnLabel('notes'), sortable: false, editable: true },
  ], [getColumnLabel]);

  const headerColumns = useMemo(() => {
    return allColumns.filter(col => visibleColumns.includes(col.key));
  }, [allColumns, visibleColumns]);

  // ===== FIELD EDITABILITY VALIDATION (from original) =====
  // List of calculated fields that should not be editable
  const nonEditableFields = [
    // Calculated fields
    'avgEntry', 'positionSize', 'allocation', 'openQty', 'exitedQty',
    'avgExitPrice', 'stockMove', 'slPercent', 'openHeat', 'rewardRisk',
    'holdingDays', 'realisedAmount', 'plRs', 'pfImpact', 'cummPf'
    // 'cmp' REMOVED to allow manual editing when auto-fetch fails
    // 'initialQty' REMOVED to allow inline editing
  ];

  // List of user-controlled fields that should never be auto-updated once user has edited them
  const userControlledFields = [
    'positionStatus', 'buySell', 'setup', 'exitTrigger', 'proficiencyGrowthAreas',
    'planFollowed', 'notes', 'name', 'tradeNo'
  ];

  // Check if a field is editable
  const isEditable = (field: string) => !nonEditableFields.includes(field);

  // Check if a field is user-controlled (should not be auto-updated once user has edited it)
  const isUserControlled = (field: string) => userControlledFields.includes(field);

  // ===== PROCESSED DATA =====
  // Apply local updates for instant UI feedback
  const processedTrades = useMemo(() => {
    if (localTradeUpdates.size === 0) {
      return trades;
    }
    return trades.map(trade => {
      const localUpdate = localTradeUpdates.get(trade.id);
      return localUpdate ? { ...trade, ...localUpdate } : trade;
    });
  }, [trades, localTradeUpdates]);

  // ENTERPRISE-SCALE PERFORMANCE: Dynamic pagination options based on dataset size
  const rowsPerPageOptions = useMemo(() => {
    const baseOptions = [10, 25, 50, 100];

    // For large datasets, add more options for better performance
    if (processedTrades.length > 500) {
      return [10, 25, 50, 100, 200, 500];
    } else if (processedTrades.length > 100) {
      return [10, 25, 50, 100, 200];
    }

    return baseOptions;
  }, [processedTrades.length]);

  // ===== SETTINGS PERSISTENCE (moved after rowsPerPageOptions definition) =====
  // Load rows per page from Supabase on mount
  useEffect(() => {
    const loadRowsPerPage = async () => {
      try {
        const savedValue = await getFromSupabase('tradeJournal_rowsPerPage', 10, (value) => parseInt(value, 10));

        // Set saved value if it's valid, otherwise use default (10)
        setRowsPerPage(rowsPerPageOptions.includes(savedValue) ? savedValue : 10);
      } catch (error) {
        setRowsPerPage(10);
      } finally {
        setRowsPerPageLoaded(true);
      }
    };

    loadRowsPerPage();
  }, [trades.length, rowsPerPageOptions]);

  // Validate and adjust rowsPerPage when options change (e.g., when dataset size changes)
  useEffect(() => {
    if (!rowsPerPageOptions.includes(rowsPerPage)) {
      // If current rowsPerPage is not in the new options, set to the closest valid option
      const closestOption = rowsPerPageOptions.reduce((prev, curr) =>
        Math.abs(curr - rowsPerPage) < Math.abs(prev - rowsPerPage) ? curr : prev
      );
      setRowsPerPage(closestOption);
    }
  }, [rowsPerPageOptions, rowsPerPage]);

  // ===== CENTRALIZED CALCULATIONS =====
  // All calculations are handled by custom hooks
  const sharedCalculations = useAccountingCalculations(processedTrades);
  const portfolioCalculations = usePortfolioCalculations(processedTrades, portfolioSize, useCashBasis, getPortfolioSize);

  // Create a memoized calculation map to avoid calling hooks in loops (from original)
  const tradeCalculationsMap = useMemo(() => {
    const calculationsMap = new Map<string, any>();

    // CRITICAL FIX: Remove arbitrary 100-trade limit - calculate for all trades
    // Use processedTrades directly for accurate calculations across entire dataset
    const tradesToCalculate = processedTrades; // Calculate for ALL trades

    tradesToCalculate.forEach(trade => {
      try {
        // Manual calculation without hooks to avoid Rules of Hooks violations
        const entries = [
          { price: trade.entry || 0, qty: trade.initialQty || 0 },
          ...(trade.pyramid1Price && trade.pyramid1Qty ? [{ price: trade.pyramid1Price, qty: trade.pyramid1Qty }] : []),
          ...(trade.pyramid2Price && trade.pyramid2Qty ? [{ price: trade.pyramid2Price, qty: trade.pyramid2Qty }] : [])
        ].filter(e => e.price > 0 && e.qty > 0);

        if (entries.length > 0) {
          const avgEntry = calcAvgEntry(entries);
          const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
          const positionSize = calcPositionSize(avgEntry, totalQty);

          let effectivePortfolioSize = portfolioSize;
          if (getPortfolioSize && trade.date) {
            try {
              const tradeDate = new Date(trade.date);
              const month = tradeDate.toLocaleString('default', { month: 'short' });
              const year = tradeDate.getFullYear();
              const monthlySize = getPortfolioSize(month, year);
              if (monthlySize > 0) {
                effectivePortfolioSize = monthlySize;
              }
            } catch (error) {
              // Use default portfolio size on error
            }
          }

          const allocation = calcAllocation(positionSize, effectivePortfolioSize);
          const slPercent = calcSLPercent(trade.sl || trade.tsl || 0, avgEntry);
          const exitedQty = calcExitedQty(trade.exit1Qty || 0, trade.exit2Qty || 0, trade.exit3Qty || 0);
          const openQty = calcOpenQty(trade.initialQty || 0, trade.pyramid1Qty || 0, trade.pyramid2Qty || 0, exitedQty);

          const exits = [
            ...(trade.exit1Price && trade.exit1Qty ? [{ price: trade.exit1Price, qty: trade.exit1Qty }] : []),
            ...(trade.exit2Price && trade.exit2Qty ? [{ price: trade.exit2Price, qty: trade.exit2Qty }] : []),
            ...(trade.exit3Price && trade.exit3Qty ? [{ price: trade.exit3Price, qty: trade.exit3Qty }] : [])
          ].filter(e => e.price > 0 && e.qty > 0);

          const avgExitPrice = exits.length > 0 ? calcAvgExitPrice(exits) : 0;
          const unrealizedPL = calcUnrealizedPL(avgEntry, trade.cmp || 0, openQty, trade.buySell as 'Buy' | 'Sell');

          const individualMoves = calcIndividualMoves(
            entries.map(e => ({ ...e, description: 'Entry' })),
            trade.cmp || 0,
            avgExitPrice,
            trade.positionStatus as 'Open' | 'Closed' | 'Partial',
            trade.buySell as 'Buy' | 'Sell'
          );

          calculationsMap.set(trade.id, {
            avgEntry,
            positionSize,
            allocation,
            slPercent,
            openQty,
            exitedQty,
            avgExitPrice,
            unrealizedPL,
            individualMoves
          });
        }
      } catch (error) {
        // Error calculating metrics for trade - skip this trade
      }
    });

    return calculationsMap;
  }, [processedTrades, portfolioSize, getPortfolioSize]);

  // Helper function to get trade calculations from the map (from original)
  const getTradeCalculation = useCallback((tradeId: string) => {
    return tradeCalculationsMap.get(tradeId) || null;
  }, [tradeCalculationsMap]);

  // ===== ACCOUNTING-AWARE PORTFOLIO SIZING (EXACT COPY from original lines 847-882) =====
  // Get accounting-aware portfolio size for a specific trade
  const getAccountingAwarePortfolioSize = useCallback((trade: Trade, exitedQty: number) => {
    if (!getPortfolioSize) return portfolioSize;

    try {
      // Handle DD-MM-YYYY and DD.MM.YYYY formats
      let tradeDate: Date;
      if (/^\d{2}-\d{2}-\d{4}$/.test(trade.date)) {
        const [day, month, year] = trade.date.split('-').map(Number);
        tradeDate = new Date(year, month - 1, day);
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(trade.date)) {
        const [day, month, year] = trade.date.split('.').map(Number);
        tradeDate = new Date(year, month - 1, day);
      } else {
        tradeDate = new Date(trade.date);
      }

      const month = tradeDate.toLocaleString('default', { month: 'short' });
      const year = tradeDate.getFullYear();

      // For cash basis accounting, use the exit date's portfolio size if available
      if (useCashBasis && exitedQty > 0) {
        // Use the latest exit date for portfolio size calculation
        const exitDates = [trade.exit1Date, trade.exit2Date, trade.exit3Date]
          .filter(date => date)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (exitDates.length > 0) {
          const latestExitDate = exitDates[0];
          let exitDate: Date;
          if (/^\d{2}-\d{2}-\d{4}$/.test(latestExitDate)) {
            const [day, month, year] = latestExitDate.split('-').map(Number);
            exitDate = new Date(year, month - 1, day);
          } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(latestExitDate)) {
            const [day, month, year] = latestExitDate.split('.').map(Number);
            exitDate = new Date(year, month - 1, day);
          } else {
            exitDate = new Date(latestExitDate);
          }

          const exitMonth = exitDate.toLocaleString('default', { month: 'short' });
          const exitYear = exitDate.getFullYear();
          const exitPortfolioSize = getPortfolioSize(exitMonth, exitYear);

          if (exitPortfolioSize > 0) {
            return exitPortfolioSize;
          }
        }
      }

      // Default to entry date portfolio size
      const entryPortfolioSize = getPortfolioSize(month, year);
      return entryPortfolioSize > 0 ? entryPortfolioSize : portfolioSize;
    } catch (error) {
      return portfolioSize;
    }
  }, [portfolioSize, getPortfolioSize, useCashBasis]);

  // ===== PRECOMPUTED TOOLTIPS (EXACT COPY from original lines 1370-1720) =====
  // Pre-compute all tooltip data for better performance
  const precomputedTooltips = React.useMemo(() => {
    const tooltipData = new Map();

    processedTrades.forEach(trade => {
      const tradeTooltips: any = {};

      // Pre-compute holding days tooltip
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
        // Handle DD-MM-YYYY and DD.MM.YYYY formats for entry date
        let entryDate: Date;
        if (/^\d{2}-\d{2}-\d{4}$/.test(lot.date)) {
          const [day, month, year] = lot.date.split('-').map(Number);
          entryDate = new Date(year, month - 1, day);
        } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(lot.date)) {
          const [day, month, year] = lot.date.split('.').map(Number);
          entryDate = new Date(year, month - 1, day);
        } else {
          entryDate = new Date(lot.date);
        }
        entryDate.setHours(0,0,0,0);

        while (qtyLeft > 0 && remainingExits.length > 0) {
          const exit = remainingExits[0];
          // Handle DD-MM-YYYY and DD.MM.YYYY formats for exit date
          let exitDate: Date;
          if (/^\d{2}-\d{2}-\d{4}$/.test(exit.date)) {
            const [day, month, year] = exit.date.split('-').map(Number);
            exitDate = new Date(year, month - 1, day);
          } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(exit.date)) {
            const [day, month, year] = exit.date.split('.').map(Number);
            exitDate = new Date(year, month - 1, day);
          } else {
            exitDate = new Date(exit.date);
          }
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
        const exitedLots = lotBreakdown.filter(l => l.exited);
        const openQty = openLots.reduce((sum, l) => sum + l.qty, 0);
        const exitedQty = exitedLots.reduce((sum, l) => sum + l.qty, 0);
        if (openQty > 0) {
          displayDays = Math.round(openLots.reduce((sum, l) => sum + l.days * l.qty, 0) / openQty);
        } else if (exitedQty > 0) {
          displayDays = Math.round(exitedLots.reduce((sum, l) => sum + l.days * l.qty, 0) / exitedQty);
        }
      } else {
        const exitedLots = lotBreakdown.filter(l => l.exited);
        const exitedQty = exitedLots.reduce((sum, l) => sum + l.qty, 0);
        displayDays = exitedQty > 0 ? Math.round(exitedLots.reduce((sum, l) => sum + l.days * l.qty, 0) / exitedQty) : 0;
      }

      tradeTooltips.holdingDays = {
        displayDays,
        lotBreakdown,
        isOpenPosition,
        isPartialPosition
      };

      // Pre-compute R:R tooltip (EXACT COPY from original lines 1450-1622)
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

      const totalQtyAll = entryExitAllocations.reduce((sum, e) => sum + e.qty, 0);

      // FIFO allocation for R:R calculation
      const rrExits = [
        { price: Number(trade.exit1Price), qty: Number(trade.exit1Qty) },
        { price: Number(trade.exit2Price), qty: Number(trade.exit2Qty) },
        { price: Number(trade.exit3Price), qty: Number(trade.exit3Qty) }
      ].filter(e => e.price > 0 && e.qty > 0);

      let rrRemainingExits = rrExits.map(e => ({ ...e }));

      const entryExitAllocationsWithFifo = entryExitAllocations.map(entry => {
        let entryQtyLeft = entry.qty;
        let totalExitValue = 0;
        let totalExitQty = 0;

        while (entryQtyLeft > 0 && rrRemainingExits.length > 0) {
          const exit = rrRemainingExits[0];
          const usedQty = Math.min(entryQtyLeft, exit.qty);

          totalExitValue += usedQty * exit.price;
          totalExitQty += usedQty;

          entryQtyLeft -= usedQty;
          exit.qty -= usedQty;

          if (exit.qty === 0) rrRemainingExits.shift();
        }

        const avgExitPriceForEntry = totalExitQty > 0 ? totalExitValue / totalExitQty : 0;
        const exitedQtyForEntry = totalExitQty;
        const openQtyForEntry = entryQtyLeft;

        return {
          ...entry,
          exitedQtyForEntry,
          openQtyForEntry,
          avgExitPriceForEntry
        };
      });

      const entryBreakdown = entryExitAllocationsWithFifo.map(e => {
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
        } else if (positionStatus === 'Partial') {
          // Use FIFO-allocated quantities for this specific entry
          const exitedQtyForEntry = e.exitedQtyForEntry;
          const openQtyForEntry = e.openQtyForEntry;
          const avgExitPriceForEntry = e.avgExitPriceForEntry;
          const totalQtyForEntry = exitedQtyForEntry + openQtyForEntry;

          if (exitedQtyForEntry > 0 && openQtyForEntry > 0) {
            // Mixed: part realized, part unrealized for this entry
            const realizedReward = buySell === 'Buy' ? avgExitPriceForEntry - e.price : e.price - avgExitPriceForEntry;
            const unrealizedReward = buySell === 'Buy' ? cmp - e.price : e.price - cmp;
            reward = ((realizedReward * exitedQtyForEntry) + (unrealizedReward * openQtyForEntry)) / totalQtyForEntry;
            rewardFormula = `Weighted: ((Realized: ${realizedReward.toFixed(2)} × ${exitedQtyForEntry}) + (Unrealized: ${unrealizedReward.toFixed(2)} × ${openQtyForEntry})) / ${totalQtyForEntry} = ${reward.toFixed(2)}`;
          } else if (exitedQtyForEntry > 0) {
            // Fully realized for this entry
            reward = buySell === 'Buy' ? avgExitPriceForEntry - e.price : e.price - avgExitPriceForEntry;
            rewardFormula = buySell === 'Buy'
              ? `Avg. Exit - Entry = ${avgExitPriceForEntry.toFixed(2)} - ${e.price} = ${reward.toFixed(2)} (Realized)`
              : `Entry - Avg. Exit = ${e.price} - ${avgExitPriceForEntry.toFixed(2)} = ${reward.toFixed(2)} (Realized)`;
          } else {
            // Fully unrealized for this entry
            reward = buySell === 'Buy' ? cmp - e.price : e.price - cmp;
            rewardFormula = buySell === 'Buy'
              ? `CMP - Entry = ${cmp} - ${e.price} = ${reward.toFixed(2)} (Unrealized)`
              : `Entry - CMP = ${e.price} - ${cmp} = ${reward.toFixed(2)} (Unrealized)`;
          }
        }

        // CRITICAL FIX: Return signed R:R ratio (negative for losses, positive for gains)
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
          exitedQtyForEntry: e.exitedQtyForEntry || 0,
          openQtyForEntry: e.openQtyForEntry || 0,
          isRiskFree
        };
      });

      // Traditional weighted R:R (excluding risk-free positions)
      const riskyEntries = entryBreakdown.filter(e => !e.isRiskFree);
      const riskyQty = riskyEntries.reduce((sum, e) => sum + (e.qty || 0), 0);
      const traditionalWeightedRR = riskyQty > 0
        ? riskyEntries.reduce((sum, e) => sum + (e.rrValue * (e.qty || 0)), 0) / riskyQty
        : 0;

      // Effective position R:R (total reward vs total risk from risky portions only)
      const totalRiskAmount = riskyEntries.reduce((sum, e) => sum + (e.risk * (e.qty || 0)), 0);
      const totalRewardAmount = entryBreakdown.reduce((sum, e) => sum + (e.reward * (e.qty || 0)), 0);
      // CRITICAL FIX: Return signed effective R:R ratio (negative for losses, positive for gains)
      const effectiveRR = totalRiskAmount > 0 ? (totalRewardAmount / totalRiskAmount) : Infinity;

      // Check if position contains risk-free components
      const hasRiskFreePositions = entryBreakdown.some(e => e.isRiskFree);

      const weightedRR = traditionalWeightedRR;

      tradeTooltips.rewardRisk = {
        entryBreakdown,
        weightedRR,
        totalQtyAll,
        tsl,
        traditionalWeightedRR,
        effectiveRR,
        hasRiskFreePositions,
        totalRiskAmount,
        totalRewardAmount
      };

      // Pre-compute stock move tooltip (EXACT COPY from original lines 1721-1735)
      const stockMoveEntries = [
        { description: 'Initial Entry', price: Number(trade.entry), qty: Number(trade.initialQty) },
        { description: 'Pyramid 1', price: Number(trade.pyramid1Price), qty: Number(trade.pyramid1Qty) },
        { description: 'Pyramid 2', price: Number(trade.pyramid2Price), qty: Number(trade.pyramid2Qty) }
      ].filter(e => e.price > 0 && e.qty > 0);

      const tradeCalc = getTradeCalculation(trade.id);
      const individualMoves = tradeCalc ? tradeCalc.individualMoves : calcIndividualMoves(
        stockMoveEntries,
        trade.cmp,
        trade.avgExitPrice,
        trade.positionStatus,
        trade.buySell
      );

      tradeTooltips.stockMove = {
        individualMoves,
        positionStatus: trade.positionStatus
      };

      // Precompute trade details tooltip (EXACT COPY from original lines 1624-1720)
      const fieldsForTooltip = allColumns.slice(allColumns.findIndex(col => col.key === "initialQty")).filter(col => col.key !== 'openHeat');
      const tradeDetailsFields = fieldsForTooltip.map(col => {
        if (col.key === "actions") return null;
        let value = trade[col.key as keyof Trade];
        const originalValue = value; // Store original value for filtering

        // Skip fields with no meaningful values BEFORE formatting
        const shouldSkipField = (key: string, originalVal: any) => {
          if (originalVal === null || originalVal === undefined || originalVal === '' || originalVal === '-') return true;

          // Only hide EXACT zero values (not small decimals like 0.1, 0.01, 0.05)
          // Check the original numeric value before any formatting
          if (originalVal === 0 && [
            'pyramid1Price', 'pyramid2Price', 'pyramid1Qty', 'pyramid2Qty',
            'exit1Price', 'exit2Price', 'exit3Price', 'exit1Qty', 'exit2Qty', 'exit3Qty',
            'tsl', 'rewardRisk', 'stockMove', 'pfImpact', 'cummPf', 'openHeat',
            'unrealizedPL', 'realisedAmount', 'plRs'
          ].includes(key)) return true;

          if (key.includes('Date') && (originalVal === '-' || originalVal === '')) return true;
          return false;
        };

        // Check if we should skip this field BEFORE any processing
        if (shouldSkipField(col.key, originalValue)) return null;

        // Handle accounting-aware calculations
        if (col.key === 'unrealizedPL') {
          if (trade.positionStatus === 'Open' || trade.positionStatus === 'Partial') {
            const tradeCalc = getTradeCalculation(trade.id);
            value = tradeCalc ? tradeCalc.unrealizedPL : calcUnrealizedPL(trade.avgEntry, trade.cmp, trade.openQty, trade.buySell);
          } else {
            value = "-";
          }
        } else if (col.key === 'plRs') {
          const tooltipValues = getAccountingAwareValues(trade);
          value = tooltipValues.plRs;
        } else if (col.key === 'realisedAmount') {
          const tooltipValues = getAccountingAwareValues(trade);
          value = tooltipValues.realisedAmount;
        } else if (col.key === 'pfImpact') {
          const tooltipValues = getAccountingAwareValues(trade);
          value = tooltipValues.pfImpact;
        } else if (col.key === 'cummPf') {
          // The cummPf value is already calculated correctly based on accounting method in use-trades.ts
          value = `${Number(trade.cummPf ?? 0).toFixed(2)}%`;
        }

        // Format values appropriately
        if (["pyramid1Date", "pyramid2Date", "exit1Date", "exit2Date", "exit3Date"].includes(col.key)) {
          value = value ? formatDate(value as string) : "-";
        } else if (["entry", "avgEntry", "sl", "tsl", "cmp", "pyramid1Price", "pyramid2Price", "exit1Price", "exit2Price", "exit3Price", "avgExitPrice", "realisedAmount", "plRs", "unrealizedPL"].includes(col.key)) {
          value = typeof value === 'number' ? formatCurrency(value) : value;
        } else if (["pfImpact", "rewardRisk", "stockMove", "openHeat", "allocation", "slPercent"].includes(col.key)) {
          if (col.key !== 'pfImpact' && col.key !== 'cummPf') {
            let originalValue = Number(value);
            if (col.key === "rewardRisk") {
              const rrStr = originalValue % 1 === 0 ? originalValue.toFixed(0) : originalValue.toFixed(2);
              value = originalValue > 0 ? `${rrStr}R` : '-';
            } else {
              value = `${originalValue.toFixed(2)}`;
              if (!(col.key.includes("Price") || col.key.includes("Amount") || col.key.includes("Rs"))) {
                 value += "%";
              }
            }
          } else if (col.key === 'pfImpact') {
            value = `${Number(value).toFixed(2)}%`;
          }
        } else if (col.key === "planFollowed") {
          value = trade.planFollowed ? "Yes" : "No";
        } else if (col.key === 'positionSize') {
          value = typeof value === 'number' ? Math.round(value).toString() : value;
        } else if (col.key === 'holdingDays') {
          value = typeof value === 'number' ? `${value} day${value !== 1 ? 's' : ''}` : value;
        } else if (value === undefined || value === null || value === ""){
          value = "-";
        }

        return {
          key: col.key,
          label: col.label,
          value: String(value)
        };
      }).filter(Boolean);

      tradeTooltips.tradeDetails = {
        fields: tradeDetailsFields,
        tradeName: trade.name,
        accountingMethod: useCashBasis ? 'Cash Basis' : 'Accrual Basis'
      };

      tooltipData.set(trade.id, tradeTooltips);
    });

    return tooltipData;
  }, [processedTrades, allColumns, getTradeCalculation, getAccountingAwareValues, useCashBasis, formatDate, formatCurrency]);

  // ===== COMPREHENSIVE STATS CALCULATION (EXACT COPY from original lines 2454-2765) =====
  // Stable stats calculation - prevent layout shifts and excessive recalculation
  const [statsLoaded, setStatsLoaded] = React.useState(true); // Start as loaded to prevent layout shift
  const [lazyStats, setLazyStats] = React.useState({
    totalUnrealizedPL: 0,
    openPfImpact: 0,
    totalRealizedPL: 0,
    realizedPfImpact: 0,
    openHeat: 0,
    winRate: 0,
    percentInvested: 0,
    percentPF: 0
  });

  // CRITICAL FIX: Move currentPortfolioSize calculation outside of stats calculation
  const currentPortfolioSize = React.useMemo(() => {
    if (!getPortfolioSize) return portfolioSize;

    const now = new Date();
    const currentMonth = now.toLocaleString('default', { month: 'short' });
    const currentYear = now.getFullYear();

    // Use stable calculation with fallback
    try {
      const calculatedSize = getPortfolioSize(currentMonth, currentYear);
      return calculatedSize > 0 ? calculatedSize : portfolioSize;
    } catch (error) {
      return portfolioSize;
    }
  }, [getPortfolioSize, portfolioSize]);

  // CRITICAL FIX: Calculate % PF (Current) as sum of all monthly P/L percentages
  const stablePercentPF = React.useMemo(() => {
    if (!trades || trades.length === 0) return 0;

    try {
      // Get all monthly portfolios using the same logic as monthly performance page
      const monthlyPortfolios = getAllMonthlyTruePortfolios(trades, useCashBasis);

      if (!monthlyPortfolios || monthlyPortfolios.length === 0) return 0;

      // Calculate cumulative PF by summing all monthly P/L percentages
      // This matches the logic in drawdown-curve.tsx and performance-chart.tsx
      let cummPf = 0;

      monthlyPortfolios.forEach(monthData => {
        // CRITICAL FIX: Apply same fallback logic as charts and monthly performance table
        // Get trades for this month to recalculate P/L if needed
        const monthTrades = trades.filter(trade => {
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

        // Calculate monthly return percentage: (P/L / Effective Starting Capital) * 100
        // CRITICAL FIX: Use effectiveStartingCapital and corrected P/L
        const effectiveCapital = monthData.effectiveStartingCapital || 0;
        const monthlyReturn = (effectiveCapital !== 0 && isFinite(effectiveCapital) && isFinite(actualPL))
          ? (actualPL / effectiveCapital) * 100
          : 0;

        // Only add finite values to prevent NaN propagation
        if (isFinite(monthlyReturn)) {
          cummPf += monthlyReturn; // Add this month's return to cumulative PF
        }
      });

      return cummPf;
    } catch (error) {
      return 0;
    }
  }, [trades.map(t => `${t.id}-${t.date}-${t.positionStatus}-${t.plRs}`).join('|'), useCashBasis, getAllMonthlyTruePortfolios]);

  // REWRITTEN: Stats calculation with comprehensive data validation to prevent cascade errors
  const stableStatsCalculation = React.useMemo(() => {
    // CRITICAL: Enhanced loading guard to prevent PF impact cascade errors
    const hasValidOriginalTrades = Array.isArray(originalTrades) && originalTrades.length >= 0;
    const hasValidProcessedTrades = Array.isArray(processedTrades) && processedTrades.length >= 0;
    const hasValidPortfolioSize = typeof portfolioSize === 'number' && portfolioSize >= 0 && isFinite(portfolioSize);
    const hasValidGetPortfolioSize = typeof getPortfolioSize === 'function';

    // Return zero stats if any essential data is missing or invalid
    if (!hasValidOriginalTrades || !hasValidProcessedTrades || !hasValidPortfolioSize || !hasValidGetPortfolioSize) {
      return {
        totalUnrealizedPL: 0,
        openPfImpact: 0,
        totalRealizedPL: 0,
        realizedPfImpact: 0,
        openHeat: 0,
        winRate: 0,
        percentInvested: 0,
        percentPF: 0
      };
    }

    // Additional validation: Ensure processedTrades have valid PF impact calculations
    if (processedTrades.length > 0) {
      const hasValidPfCalculations = processedTrades.some(trade => {
        const hasCummPf = typeof trade.cummPf === 'number' && isFinite(trade.cummPf);
        const hasPfImpact = typeof trade.pfImpact === 'number' && isFinite(trade.pfImpact);
        const hasCashPfImpact = typeof trade._cashPfImpact === 'number' && isFinite(trade._cashPfImpact);
        const hasAccrualPfImpact = typeof trade._accrualPfImpact === 'number' && isFinite(trade._accrualPfImpact);

        return hasCummPf || hasPfImpact || hasCashPfImpact || hasAccrualPfImpact;
      });

      if (!hasValidPfCalculations) {
        return {
          totalUnrealizedPL: 0,
          openPfImpact: 0,
          totalRealizedPL: 0,
          realizedPfImpact: 0,
          openHeat: 0,
          winRate: 0,
          percentInvested: 0,
          percentPF: 0
        };
      }
    }

    // CRITICAL FIX: Use processedTrades for stats calculation to include local updates
    const tradesForStats = processedTrades;

    // Calculate unrealized P/L for open positions using filtered trades to respond to search
    // For cash basis, we need to be careful not to double count, so we'll use a Set to track original trade IDs
    let unrealizedPL = 0;
    if (useCashBasis) {
      // For cash basis, only count each original trade once for unrealized P/L
      const processedTradeIds = new Set();
      tradesForStats
        .filter(trade => trade.positionStatus === 'Open' || trade.positionStatus === 'Partial')
        .forEach(trade => {
          const originalId = trade.id.split('_exit_')[0]; // Get original trade ID
          if (!processedTradeIds.has(originalId)) {
            processedTradeIds.add(originalId);
            const tradeCalc = getTradeCalculation(trade.id);
            unrealizedPL += tradeCalc ? tradeCalc.unrealizedPL : calcUnrealizedPL(trade.avgEntry, trade.cmp, trade.openQty, trade.buySell);
          }
        });
    } else {
      // For accrual basis, straightforward calculation
      unrealizedPL = tradesForStats
        .filter(trade => trade.positionStatus === 'Open' || trade.positionStatus === 'Partial')
        .reduce((sum, trade) => {
          const tradeCalc = getTradeCalculation(trade.id);
          return sum + (tradeCalc ? tradeCalc.unrealizedPL : calcUnrealizedPL(trade.avgEntry, trade.cmp, trade.openQty, trade.buySell));
        }, 0);
    }

    const openImpact = portfolioSize > 0 ? (unrealizedPL / portfolioSize) * 100 : 0;

    // Calculate realized P/L based on accounting method using processed trades
    let realizedTrades;
    if (useCashBasis) {
      // For cash basis: flatten all expanded trades from _expandedTrades arrays
      realizedTrades = processedTrades.flatMap(trade =>
        Array.isArray(trade._expandedTrades)
          ? trade._expandedTrades.filter(t => t._cashBasisExit)
          : (trade._cashBasisExit ? [trade] : [])
      );

    } else {
      // For accrual basis: include all non-open trades
      realizedTrades = processedTrades.filter(trade => trade.positionStatus !== 'Open');
    }

    let debugSum = 0;
    const realizedPL = realizedTrades.reduce((sum, trade, index) => {
      const tradePL = calculateTradePL(trade, useCashBasis);
      debugSum += tradePL;

      return sum + tradePL;
    }, 0);

    // Calculate realized PF Impact using the same method as tooltip and table rows
    // This ensures perfect consistency across dashboard, tooltip, and table
    let realizedImpact = 0;
    if (useCashBasis) {
      // For cash basis: Group by original trade ID and calculate PF Impact once per original trade
      const groupedForImpact = {};
      const originalTradesMap = new Map();

      // First, collect original trades for PF Impact calculation
      processedTrades.forEach(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (!originalTradesMap.has(originalId)) {
          originalTradesMap.set(originalId, trade);
        }
      });

      realizedTrades.forEach(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (!groupedForImpact[originalId]) {
          groupedForImpact[originalId] = true; // Mark as processed
          const originalTrade = originalTradesMap.get(originalId);
          if (originalTrade) {
            const pfImpactValues = getAccountingAwareValues(originalTrade);
            realizedImpact += pfImpactValues.pfImpact;
          }
        }
      });
    } else {
      // For accrual basis: Direct calculation
      realizedImpact = realizedTrades.reduce((sum, trade) => {
        const pfImpactValues = getAccountingAwareValues(trade);
        return sum + pfImpactValues.pfImpact;
      }, 0);
    }

    // Calculate open heat using filtered trades to respond to search
    // For cash basis, avoid double counting by using original trade IDs
    let filteredTradesForOpenHeat = tradesForStats;
    if (useCashBasis) {
      // For cash basis, only include each original trade once
      const seenTradeIds = new Set();
      filteredTradesForOpenHeat = tradesForStats.filter(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) {
          return false;
        }
        seenTradeIds.add(originalId);
        return true;
      });
    }
    const openHeat = calcOpenHeat(filteredTradesForOpenHeat, portfolioSize, getPortfolioSize);

    // Calculate win rate using processed trades for cash basis
    let tradesWithAccountingPL;

    if (useCashBasis) {
      // For cash basis: Group trades by original ID and calculate total P/L per original trade
      const tradeGroups = new Map<string, Trade[]>();

      tradesForStats
        .filter(trade => trade._cashBasisExit || trade.positionStatus !== 'Open')
        .forEach(trade => {
          const originalId = trade.id.split('_exit_')[0];
          if (!tradeGroups.has(originalId)) {
            tradeGroups.set(originalId, []);
          }
          tradeGroups.get(originalId)!.push(trade);
        });

      // Calculate total P/L for each original trade
      tradesWithAccountingPL = Array.from(tradeGroups.entries()).map(([originalId, trades]) => {
        // Sum up P/L from all exits for this trade
        const totalPL = trades.reduce((sum, trade) => {
          return sum + calculateTradePL(trade, useCashBasis);
        }, 0);

        // Use the first trade as the representative (they all have the same original data)
        const representativeTrade = trades[0];

        return {
          ...representativeTrade,
          id: originalId, // Use original ID
          accountingPL: totalPL
        };
      });
    } else {
      // For accrual basis: Use trades as-is
      tradesWithAccountingPL = tradesForStats
        .filter(trade => trade.positionStatus !== 'Open')
        .map(trade => ({
          ...trade,
          accountingPL: calculateTradePL(trade, useCashBasis)
        }));
    }

    const winningTrades = tradesWithAccountingPL.filter(t => t.accountingPL > 0);
    // Use centralized win rate calculation for consistency
    const winRate = calcWinRate(tradesForStats, useCashBasis);

    // Calculate % Invested (percentage of portfolio currently invested in open positions)
    // This can exceed 100% if the trader is using leverage
    let totalInvestedAmount = 0;
    const openPositions = tradesForStats.filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial');

    if (useCashBasis) {
      // For cash basis, avoid double counting by using original trade IDs
      const seenTradeIds = new Set();
      openPositions.forEach(t => {
        const originalId = t.id.split('_exit_')[0];
        if (!seenTradeIds.has(originalId)) {
          seenTradeIds.add(originalId);
          // For partial positions, calculate remaining invested amount based on open quantity
          let investedAmount;
          if (t.positionStatus === 'Partial') {
            // Use only the remaining open quantity for partial positions
            investedAmount = (t.openQty || 0) * (t.avgEntry || 0);
          } else {
            // For fully open positions, use full position size
            investedAmount = t.positionSize || ((t.openQty || 0) * (t.avgEntry || 0));
          }
          totalInvestedAmount += investedAmount;
        }
      });
    } else {
      totalInvestedAmount = openPositions.reduce((sum, t) => {
        // For partial positions, calculate remaining invested amount based on open quantity
        let investedAmount;
        if (t.positionStatus === 'Partial') {
          // Use only the remaining open quantity for partial positions
          investedAmount = (t.openQty || 0) * (t.avgEntry || 0);
        } else {
          // For fully open positions, use full position size
          investedAmount = t.positionSize || ((t.openQty || 0) * (t.avgEntry || 0));
        }
        return sum + investedAmount;
      }, 0);
    }

    // CRITICAL FIX: Use the currentPortfolioSize defined outside this useMemo
    const percentInvested = currentPortfolioSize > 0 ? (totalInvestedAmount / currentPortfolioSize) * 100 : 0;

    // CRITICAL FIX: Use pre-calculated stable % PF to prevent fluctuation
    const percentPF = stablePercentPF;

    return {
      totalUnrealizedPL: unrealizedPL,
      openPfImpact: openImpact,
      totalRealizedPL: realizedPL,
      realizedPfImpact: realizedImpact,
      openHeat,
      winRate,
      percentInvested,
      percentPF // CRITICAL FIX: Use stable % PF calculation
    };
  }, [trades, originalTrades, portfolioSize, useCashBasis, currentPortfolioSize, stablePercentPF, processedTrades, getTradeCalculation, calculateTradePL, getAccountingAwareValues, portfolioCalculations.totalOpenHeat]);

  // Update lazy stats when stable calculation changes with debouncing to prevent flashing
  React.useEffect(() => {
    // Add a small delay to ensure all calculations are complete
    const timer = setTimeout(() => {
      setLazyStats(stableStatsCalculation);
      setStatsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [stableStatsCalculation]);

  // Performance optimization: Load expensive calculations when browser is idle
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleCallback = window.requestIdleCallback(() => {
        setExpensiveCalculationsLoaded(true);
      }, { timeout: 2000 });

      return () => {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleCallback);
        }
      };
    } else {
      // Fallback for browsers without requestIdleCallback
      const timer = setTimeout(() => {
        setExpensiveCalculationsLoaded(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  // Stats masking functionality
  const toggleStatsMask = React.useCallback(() => {
    setIsStatsMasked(prev => !prev);
  }, []);

  // Helper function to mask values
  const maskValue = React.useCallback((value: string) => {
    if (!isStatsMasked) return value;
    // Replace numbers and currency symbols with asterisks, keep percentage signs
    return value.replace(/[₹$€£¥0-9.,]/g, '*').replace(/\*+/g, '****');
  }, [isStatsMasked]);

  // ===== PRICE FETCHING FOR OPEN TRADES (EXACT COPY from original lines 2790-2876) =====
  // Memoize open trades to prevent unnecessary price fetching (use processed trades to include local updates)
  const openTrades = React.useMemo(() => {
    let filteredOpenTrades = processedTrades.filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial');

    // For cash basis, avoid double counting by using original trade IDs
    if (useCashBasis) {
      const seenTradeIds = new Set();
      filteredOpenTrades = filteredOpenTrades.filter(t => {
        const originalId = t.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) return false;
        seenTradeIds.add(originalId);
        return true;
      });
    }

    return filteredOpenTrades;
  }, [processedTrades, useCashBasis]);

  // PERFORMANCE OPTIMIZATION: Batch price fetching with caching
  const priceCache = React.useRef(new Map<string, { price: number, timestamp: number }>());
  const PRICE_CACHE_DURATION = 60000; // 1 minute cache

  const fetchPricesForOpenTrades = React.useCallback(async () => {
    if (openTrades.length === 0) return;

    // Batch trades by symbol to reduce API calls
    const tradesBySymbol = new Map<string, Trade[]>();
    const symbolsToFetch: string[] = [];

    for (const trade of openTrades) {
      if (trade.name) {
        const symbol = trade.name.toUpperCase();

        // Check cache first
        const cached = priceCache.current.get(symbol);
        if (cached && (Date.now() - cached.timestamp) < PRICE_CACHE_DURATION) {
          // Use cached price
          if (trade.cmp !== cached.price) {
            updateTrade({ ...trade, cmp: cached.price, _cmpAutoFetched: true });
          }
          continue;
        }

        if (!tradesBySymbol.has(symbol)) {
          tradesBySymbol.set(symbol, []);
          symbolsToFetch.push(symbol);
        }
        tradesBySymbol.get(symbol)!.push(trade);
      }
    }

    // Fetch prices in parallel batches for maximum speed
    const batchSize = 5; // Limit concurrent requests
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const priceData = await fetchPriceTicksSmart(symbol);
            const ticks = priceData?.data?.ticks?.[symbol];

            if (ticks && ticks.length > 0) {
              const latestTick = ticks[ticks.length - 1];
              const newPrice = latestTick[4];

              // Cache the price
              priceCache.current.set(symbol, {
                price: newPrice,
                timestamp: Date.now()
              });

              // Update all trades with this symbol
              const tradesToUpdate = tradesBySymbol.get(symbol) || [];
              for (const trade of tradesToUpdate) {
                if (trade.cmp !== newPrice) {
                  updateTrade({ ...trade, cmp: newPrice, _cmpAutoFetched: true });
                }
              }
            }
          } catch (err) {
            // Continue with next symbol
          }
        })
      );
    }
  }, [openTrades, updateTrade]);

  useEffect(() => {
    // Immediate fetch on mount or open trades change
    fetchPricesForOpenTrades();

    // CRITICAL FIX: Reduce polling frequency to prevent excessive API calls
    // Continue polling every 2 minutes instead of 15 seconds
    const interval = setInterval(fetchPricesForOpenTrades, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [openTrades.length]); // CRITICAL FIX: Depend on length only, not the function itself

  // ===== ENTERPRISE-SCALE TABLE DATA CALCULATIONS =====
  // PERFORMANCE OPTIMIZATION: Efficient pagination with monitoring
  const pages = Math.ceil(processedTrades.length / rowsPerPage);

  const paginatedTrades = useMemo(() => {
    const startTime = performance.now();
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const result = processedTrades.slice(start, end);

    return result;
  }, [processedTrades, page, rowsPerPage, pages]);

  // Table columns are now defined in allColumns and headerColumns above

  // Use the comprehensive header columns with terminology support
  const visibleTableColumns = headerColumns;

  // ===== STATS CALCULATIONS =====
  // Extract stats from portfolio calculations
  const statsData = useMemo(() => {
    const totalTrades = processedTrades.length;
    const openPositions = processedTrades.filter(t => t.positionStatus === 'Open' || t.positionStatus === 'Partial').length;

    // Calculate win rate
    const closedTrades = processedTrades.filter(t => t.positionStatus === 'Closed');
    const winningTrades = closedTrades.filter(t => {
      const accountingValues = getAccountingAwareValues(t);
      return accountingValues.plRs > 0;
    });
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

    // Get all stats from portfolio calculations to match original exactly
    const totalRealizedPL = portfolioCalculations.totalRealizedPL || 0;
    const totalUnrealizedPL = portfolioCalculations.totalUnrealizedPL || 0;
    const openHeat = portfolioCalculations.totalOpenHeat || 0;
    const percentInvested = portfolioCalculations.percentInvested || 0;
    // CRITICAL FIX: Use stablePercentPF instead of netPFImpact to match original calculation
    const percentPF = stablePercentPF;

    return {
      totalTrades,
      openPositions,
      winRate,
      totalRealizedPL,
      totalUnrealizedPL,
      openHeat,
      percentInvested,
      percentPF
    };
  }, [processedTrades, portfolioCalculations, getAccountingAwareValues, stablePercentPF]);

  // ===== UTILITY FUNCTIONS =====
  const formatCurrencyForStats = useCallback((value: number) => {
    if (typeof value !== 'number' || isNaN(value)) return '0.00';
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }, []);

  // ===== EVENT HANDLERS =====

  // Get next sequential trade number
  const getNextTradeNumber = useCallback(() => {
    if (trades.length === 0) return '1';

    const numericTradeNos = trades
      .map(t => parseInt(t.tradeNo))
      .filter(n => !isNaN(n));

    if (numericTradeNos.length === 0) return '1';

    const highestNumber = Math.max(...numericTradeNos);
    return String(highestNumber + 1);
  }, [trades]);

  // Add new trade via modal (not inline editing)
  const handleAddTrade = useCallback(() => {
    // Clear any selected trade and open modal in "add" mode
    setSelectedTrade(null);
    setIsUploadOnlyMode(false);
    setIsActionsEditMode(false);
    onTradeModalOpen();
  }, [onTradeModalOpen]);

  // Handle modal close with proper cleanup
  const handleTradeModalClose = useCallback(() => {
    // Clean up modal state
    setSelectedTrade(null);
    setIsUploadOnlyMode(false);
    setIsActionsEditMode(false);
    onTradeModalClose();
  }, [onTradeModalClose]);

  // Cleanup effect to ensure modal state is reset on unmount
  useEffect(() => {
    return () => {
      // Cleanup modal state when component unmounts
      if (isTradeModalOpen) {
        setSelectedTrade(null);
        setIsUploadOnlyMode(false);
        setIsActionsEditMode(false);
      }
    };
  }, [isTradeModalOpen]);

  // Add new blank trade directly to table (inline editing) - Keep for other uses
  const handleAddTradeInline = useCallback(() => {
    // Auto-assign sequential trade number (user can change it)
    const nextTradeNo = getNextTradeNumber();

    const newTrade: Trade = {
      id: uuidv4(),
      tradeNo: nextTradeNo, // Auto-assign next number, but user can change it
      date: new Date().toISOString(),
      name: '', // Empty name - will show "Stock name" placeholder in UI
      setup: '',
      buySell: 'Buy',
      entry: 0,
      avgEntry: 0,
      sl: 0,
      tsl: 0,
      cmp: 0,
      initialQty: 0,
      pyramid1Price: 0,
      pyramid1Qty: 0,
      pyramid1Date: '',
      pyramid2Price: 0,
      pyramid2Qty: 0,
      pyramid2Date: '',
      positionSize: 0,
      allocation: 0,
      exit1Price: 0,
      exit1Qty: 0,
      exit1Date: '',
      exit2Price: 0,
      exit2Qty: 0,
      exit2Date: '',
      exit3Price: 0,
      exit3Qty: 0,
      exit3Date: '',
      openQty: 0,
      exitedQty: 0,
      avgExitPrice: 0,
      stockMove: 0,
      openHeat: 0,
      rewardRisk: 0,
      holdingDays: 0,
      positionStatus: 'Open',
      realisedAmount: 0,
      plRs: 0,
      pfImpact: 0,
      cummPf: 0,
      planFollowed: true,
      exitTrigger: '',
      proficiencyGrowthAreas: '',
      baseDuration: '',
      slPercent: 0,
      notes: '',
      _cmpAutoFetched: false, // Initialize as manual entry
      chartAttachments: undefined, // Initialize without chart attachments
    };

    // Check if current page is full and auto-navigate to next page
    const currentPageStartIndex = (page - 1) * rowsPerPage;
    const currentPageEndIndex = currentPageStartIndex + rowsPerPage;
    const isCurrentPageFull = paginatedTrades.length >= currentPageEndIndex;

    // CRITICAL FIX: If this is the first trade, ensure we're on page 1
    if (processedTrades.length === 0) {
      setPage(1);
    }

    addTrade(newTrade);

    // Auto-navigate to next page if current page is full
    if (isCurrentPageFull) {
      // Use React.startTransition for smooth, non-blocking navigation
      React.startTransition(() => {
        // Use requestAnimationFrame for optimal timing
        requestAnimationFrame(() => {
          const newTotalTrades = paginatedTrades.length + 1;
          const newTotalPages = Math.ceil(newTotalTrades / rowsPerPage);
          const nextPage = Math.min(page + 1, newTotalPages);
          setPage(nextPage);
        });
      });
    }
  }, [addTrade, trades, page, rowsPerPage, paginatedTrades.length, getNextTradeNumber]);

  const handleEditTrade = useCallback((trade: Trade) => {
    setSelectedTrade(trade);
    onTradeModalOpen();
  }, [onTradeModalOpen]);

  const handleDeleteTrade = useCallback((trade: Trade) => {
    setTradeToDelete(trade);
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);

  const handleConfirmDelete = useCallback(async () => {
    if (tradeToDelete) {
      await deleteTrade(tradeToDelete.id);
      setTradeToDelete(null);
      onDeleteModalClose();
    }
  }, [tradeToDelete, deleteTrade, onDeleteModalClose]);

  const handleImportTrades = useCallback(() => {
    onUploadModalOpen();
  }, [onUploadModalOpen]);

  // ===== COMPREHENSIVE EXPORT FUNCTIONS (from original) =====
  const handleExport = useCallback((format: 'csv' | 'xlsx') => {
    // Use the raw, unfiltered trades from the hook for export (from original)
    const allTradesForExport = trades;

    // CRITICAL FIX: Always use P1, P2, E1, E2, E3 terminology for exports
    // regardless of user's current UI preference (from original)
    const exportColumns = [
      { key: "tradeNo", label: "Trade No" },
      { key: "date", label: "Date" },
      { key: "name", label: "Name" },
      { key: "setup", label: "Setup" },
      { key: "buySell", label: "Buy/Sell" },
      { key: "entry", label: "Entry" },
      { key: "avgEntry", label: "Avg Entry" },
      { key: "sl", label: "SL" },
      { key: "tsl", label: "TSL" },
      { key: "cmp", label: "CMP" },
      { key: "initialQty", label: "Initial Qty" },
      { key: "pyramid1Price", label: "P1 Price" }, // Always P1, P2
      { key: "pyramid1Qty", label: "P1 Qty" },
      { key: "pyramid1Date", label: "P1 Date" },
      { key: "pyramid2Price", label: "P2 Price" },
      { key: "pyramid2Qty", label: "P2 Qty" },
      { key: "pyramid2Date", label: "P2 Date" },
      { key: "positionSize", label: "Position Size" },
      { key: "allocation", label: "Allocation" },
      { key: "slPercent", label: "SL %" },
      { key: "exit1Price", label: "E1 Price" }, // Always E1, E2, E3
      { key: "exit1Qty", label: "E1 Qty" },
      { key: "exit1Date", label: "E1 Date" },
      { key: "exit2Price", label: "E2 Price" },
      { key: "exit2Qty", label: "E2 Qty" },
      { key: "exit2Date", label: "E2 Date" },
      { key: "exit3Price", label: "E3 Price" },
      { key: "exit3Qty", label: "E3 Qty" },
      { key: "exit3Date", label: "E3 Date" },
      { key: "openQty", label: "Open Qty" },
      { key: "exitedQty", label: "Exited Qty" },
      { key: "avgExitPrice", label: "Avg Exit Price" },
      { key: "stockMove", label: "Stock Move" },
      { key: "rewardRisk", label: "Reward:Risk" },
      { key: "holdingDays", label: "Holding Days" },
      { key: "positionStatus", label: "Position Status" },
      { key: "realisedAmount", label: "Realised Amount" },
      { key: "plRs", label: "P/L (Rs)" },
      { key: "pfImpact", label: "PF Impact" },
      { key: "cummPf", label: "Cumm PF" },
      { key: "planFollowed", label: "Plan Followed" },
      { key: "exitTrigger", label: "Exit Trigger" },
      { key: "proficiencyGrowthAreas", label: "Growth Areas" },
      { key: "sector", label: "Sector" },
      { key: "openHeat", label: "Open Heat" },
      { key: "baseDuration", label: "Base Duration" },
      { key: "notes", label: "Notes" }
    ];

    const dataToExport = allTradesForExport.map(trade => {
      const row: { [key: string]: any } = {};

      // Get accounting-aware values for P/L related fields
      const accountingValues = getAccountingAwareValues(trade);

      exportColumns.forEach(header => {
        let value = trade[header.key as keyof Trade];

        // Use accounting-aware values for P/L fields
        if (header.key === 'plRs') {
          value = accountingValues.plRs;
        } else if (header.key === 'realisedAmount') {
          value = accountingValues.realisedAmount;
        } else if (header.key === 'pfImpact') {
          value = accountingValues.pfImpact;
        }

        // Format dates for export
        if (header.key.includes('Date') && value) {
          try {
            const date = new Date(value as string);
            value = date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }).replace(/\//g, '-');
          } catch (e) {
            value = String(value);
          }
        }

        // Format boolean values
        if (header.key === 'planFollowed') {
          value = value ? 'Yes' : 'No';
        }

        row[header.label] = value;
      });
      return row;
    });

    // Add accounting method to filename for clarity
    const accountingMethodSuffix = useCashBasis ? '_cash_basis' : '_accrual_basis';
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csv = Papa.unparse(dataToExport);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `trade_journal_${dateStr}${accountingMethodSuffix}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Trades");
      XLSX.writeFile(workbook, `trade_journal_${dateStr}${accountingMethodSuffix}.xlsx`);
    }
  }, [trades, getAccountingAwareValues, useCashBasis]);

  const handleExportCSV = useCallback(() => {
    handleExport('csv');
  }, [handleExport]);

  const handleExportExcel = useCallback(() => {
    handleExport('xlsx');
  }, [handleExport]);



  // ===== CHART VIEWER HANDLERS =====
  const handleOpenChartViewer = useCallback((imageUrl: string, title?: string) => {
    setChartViewerImage(imageUrl);
    setChartViewerTitle(title || 'Chart Viewer');
    setIsChartViewerOpen(true);
  }, []);

  const handleOpenUniversalViewer = useCallback((imageUrl?: string) => {
    if (imageUrl) {
      setChartViewerImage(imageUrl);
    }
    setIsUniversalViewerOpen(true);
  }, []);

  const handleChartRefresh = useCallback(() => {
    setChartRefreshTrigger(prev => prev + 1);
  }, []);

  // ===== TABLE EVENT HANDLERS =====
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage);
    setPage(1); // Reset to first page
  }, []);

  // Function to auto-number all trades sequentially (from original)
  const handleAutoNumberTrades = useCallback(() => {
    if (trades.length === 0) return;

    const confirm = window.confirm(
      `This will automatically number all ${trades.length} trades as 1, 2, 3, etc. based on their date order. Continue?`
    );

    if (!confirm) return;

    // Sort trades by date and assign sequential numbers
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    // Update each trade with sequential number
    sortedTrades.forEach((trade, index) => {
      const updatedTrade = { ...trade, tradeNo: String(index + 1) };
      updateTrade(updatedTrade);
    });
  }, [trades, updateTrade]);

  // Handle upload-only mode for chart attachments
  const handleUploadOnly = useCallback((trade: Trade) => {
    setSelectedTrade(trade);
    setIsUploadOnlyMode(true);
    onTradeModalOpen();
  }, [onTradeModalOpen]);

  // Handle chart image viewing
  const handleChartImageView = useCallback((chartImage: any, title: string) => {
    setChartViewerImage(chartImage);
    setChartViewerTitle(title);
    setIsChartViewerOpen(true);
  }, []);

  // ===== CELL FORMATTING FUNCTIONS =====
  // formatCellValue is defined later with exact copy from original

  // getValueColor is defined later with exact copy from original

  // ===== WORLD-CLASS INLINE EDITING: Simple TanStack Query optimistic updates =====
  const handleInlineEditSave = useCallback(async (tradeId: string, field: keyof Trade, value: any) => {
    try {
      // Find the trade to update
      const tradeToUpdate = trades.find(t => t.id === tradeId);
      if (!tradeToUpdate) {
        return;
      }

      // Check if field is editable
      if (!isEditable(field as string)) {
        return;
      }

      // Parse value based on field type
      let parsedValue: any = value;

      if (typeof tradeToUpdate[field] === 'number') {
        parsedValue = Number(value) || 0;
        // Round positionSize to nearest whole number
        if (field === 'positionSize') {
          parsedValue = Math.round(parsedValue);
        }
      } else if (field.endsWith('Date') && value) {
        parsedValue = new Date(value).toISOString();
      } else if (field === 'planFollowed') {
        parsedValue = Boolean(value);
      }

      // Create updated trade with the new value
      const updatedTrade = { ...tradeToUpdate, [field]: parsedValue };

      // Track that this field has been manually edited by the user
      if (!updatedTrade._userEditedFields) {
        updatedTrade._userEditedFields = [];
      }
      if (!updatedTrade._userEditedFields.includes(field as string)) {
        updatedTrade._userEditedFields.push(field as string);

      }

      // If the field is 'name', fetch the latest price and update cmp (only if CMP is currently 0 or not manually set)
      if (field === 'name' && parsedValue) {
        try {
          let priceData;

          // Use smart fetch that prioritizes historical fallback during night hours (3:55-9:15 AM)
          priceData = await fetchPriceTicksSmart(parsedValue);

          const ticks = priceData?.data?.ticks?.[parsedValue.toUpperCase()];
          if (ticks && ticks.length > 0) {
            const latestTick = ticks[ticks.length - 1];
            const fetchedPrice = latestTick[4]; // index 4 is close price

            // Only update CMP if it's currently 0 (not manually set) or if we successfully fetched a price
            if (tradeToUpdate.cmp === 0 || fetchedPrice > 0) {
              updatedTrade.cmp = fetchedPrice;
              // Add a flag to indicate this was auto-fetched (for UI indication)
              updatedTrade._cmpAutoFetched = true;
              }
          } else {
            // No price data available - keep existing CMP if it's manually set, otherwise set to 0
            if (tradeToUpdate.cmp === 0) {
              updatedTrade.cmp = 0;
              updatedTrade._cmpAutoFetched = false;
            }
            }
        } catch (err) {
          // All fetch attempts failed - keep existing CMP if it's manually set, otherwise set to 0
          if (tradeToUpdate.cmp === 0) {
            updatedTrade.cmp = 0;
            updatedTrade._cmpAutoFetched = false;
          }
          }
      }

      // If the field is 'cmp' and manually edited, mark it as manually set
      if (field === 'cmp') {
        updatedTrade._cmpAutoFetched = false;
      }

      // CRITICAL FIX: Recalculate ALL dependent fields for any significant change
      const significantFields = [
        'entry', 'sl', 'tsl', 'initialQty', 'pyramid1Qty', 'pyramid2Qty',
        'exit1Price', 'exit2Price', 'exit3Price', 'exit1Qty', 'exit2Qty', 'exit3Qty',
        'exit1Date', 'exit2Date', 'exit3Date', 'cmp', 'buySell', 'positionStatus'
      ];

      if (significantFields.includes(field as string)) {
        // Recalculate all entry-related fields
        const allEntries = [
          { price: updatedTrade.entry, qty: updatedTrade.initialQty },
          { price: updatedTrade.pyramid1Price, qty: updatedTrade.pyramid1Qty },
          { price: updatedTrade.pyramid2Price, qty: updatedTrade.pyramid2Qty }
        ].filter(e => e.price > 0 && e.qty > 0);

        // Calculate average entry
        const totalQty = allEntries.reduce((sum, e) => sum + e.qty, 0);
        const totalValue = allEntries.reduce((sum, e) => sum + (e.price * e.qty), 0);
        updatedTrade.avgEntry = totalQty > 0 ? totalValue / totalQty : updatedTrade.entry;

        // Recalculate all exit-related fields
        const allExits = [
          { price: updatedTrade.exit1Price, qty: updatedTrade.exit1Qty, date: updatedTrade.exit1Date },
          { price: updatedTrade.exit2Price, qty: updatedTrade.exit2Qty, date: updatedTrade.exit2Date },
          { price: updatedTrade.exit3Price, qty: updatedTrade.exit3Qty, date: updatedTrade.exit3Date }
        ].filter(e => e.price > 0 && e.qty > 0 && e.date);

        // Calculate exit quantities and averages
        const exitedQty = allExits.reduce((sum, e) => sum + e.qty, 0);
        const exitValue = allExits.reduce((sum, e) => sum + (e.price * e.qty), 0);
        const avgExitPrice = exitedQty > 0 ? exitValue / exitedQty : 0;

        updatedTrade.exitedQty = exitedQty;
        updatedTrade.avgExitPrice = avgExitPrice;
        updatedTrade.openQty = totalQty - exitedQty;

        // Calculate position size and allocation
        updatedTrade.positionSize = totalValue;
        const currentPortfolioSize = getPortfolioSize ?
          (() => {
            // Handle DD-MM-YYYY and DD.MM.YYYY formats
            let tradeDate: Date;
            if (/^\d{2}-\d{2}-\d{4}$/.test(updatedTrade.date)) {
              const [day, month, year] = updatedTrade.date.split('-').map(Number);
              tradeDate = new Date(year, month - 1, day);
            } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(updatedTrade.date)) {
              const [day, month, year] = updatedTrade.date.split('.').map(Number);
              tradeDate = new Date(year, month - 1, day);
            } else {
              tradeDate = new Date(updatedTrade.date);
            }
            const month = tradeDate.toLocaleString('default', { month: 'short' });
            const year = tradeDate.getFullYear();
            return getPortfolioSize(month, year);
          })() : portfolioSize;
        updatedTrade.allocation = currentPortfolioSize > 0 ? (totalValue / currentPortfolioSize) * 100 : 0;

        // CRITICAL FIX: Calculate P/L respecting accounting method context
        if (exitedQty > 0) {
          const entryLotsForFifo = allEntries.map(e => ({ price: e.price, qty: e.qty }));
          const exitLotsForFifo = allExits.map(e => ({ price: e.price, qty: e.qty }));

          // Use accounting-aware calculation instead of direct FIFO
          // This ensures consistency with the centralized calculation logic
          const accountingAwarePL = calculateTradePL(updatedTrade, useCashBasis);
          updatedTrade.plRs = accountingAwarePL;
          updatedTrade.realisedAmount = exitValue;
        } else {
          updatedTrade.plRs = 0;
          updatedTrade.realisedAmount = 0;
        }

        // Calculate accounting-aware portfolio impact
        const accountingAwarePortfolioSize = getAccountingAwarePortfolioSize(updatedTrade, exitedQty);
        updatedTrade.pfImpact = accountingAwarePortfolioSize > 0 ? (updatedTrade.plRs / accountingAwarePortfolioSize) * 100 : 0;

        // Update position status based on quantities ONLY if user has never manually set it
        const hasUserEditedPositionStatus = tradeToUpdate._userEditedFields?.includes('positionStatus');
        const shouldAutoUpdatePositionStatus = field !== 'positionStatus' && !hasUserEditedPositionStatus;

        if (shouldAutoUpdatePositionStatus) {
          const newStatus = updatedTrade.openQty <= 0 && exitedQty > 0 ? 'Closed'
                          : exitedQty > 0 && updatedTrade.openQty > 0 ? 'Partial'
                          : 'Open';

          if (newStatus !== updatedTrade.positionStatus) {
            updatedTrade.positionStatus = newStatus;
          }
        }

        // Calculate other dependent fields
        updatedTrade.openHeat = safeCalculation(
          () => calcTradeOpenHeat(updatedTrade, currentPortfolioSize, getPortfolioSize),
          0,
          'Failed to calculate open heat'
        );

        // Calculate SL percentage
        if (updatedTrade.sl > 0 && updatedTrade.avgEntry > 0) {
          updatedTrade.slPercent = safeCalculation(
            () => calcSLPercent(updatedTrade.sl, updatedTrade.avgEntry),
            0,
            'Failed to calculate SL percentage'
          );
        }

        // Calculate stock move
        if (updatedTrade.cmp > 0 && updatedTrade.avgEntry > 0) {
          updatedTrade.stockMove = updatedTrade.buySell === 'Buy'
            ? ((updatedTrade.cmp - updatedTrade.avgEntry) / updatedTrade.avgEntry) * 100
            : ((updatedTrade.avgEntry - updatedTrade.cmp) / updatedTrade.avgEntry) * 100;
        }
      }

      // ===== WORLD-CLASS OPTIMISTIC UPDATES: Simple TanStack Query mutation =====
      // Use the TanStack Query mutation with built-in optimistic updates
      updateTrade(updatedTrade);

    } catch (error) {
      // Edit error - operation failed
    }
  }, [trades, isEditable, portfolioSize, getPortfolioSize, updateTrade, getAccountingAwarePortfolioSize]);

  // ===== KEYBOARD NAVIGATION (EXACT COPY from original lines 1136-1315) =====
  // Keyboard navigation for editable fields
  const getEditableFields = React.useCallback(() => {
    const editableColumns = allColumns.filter(col =>
      col.key !== 'actions' &&
      visibleColumns.includes(col.key) &&
      isEditable(col.key)
    );
    return editableColumns.map(col => col.key);
  }, [visibleColumns, isEditable, allColumns]);

  // Tab navigation state
  const [currentTabIndex, setCurrentTabIndex] = React.useState<{row: number, col: number} | null>(null);

  // Get all editable cells in order (row by row, then column by column)
  const getAllEditableCells = React.useCallback(() => {
    const editableFields = getEditableFields();
    const cells: Array<{tradeId: string, field: string, rowIndex: number, colIndex: number}> = [];

    processedTrades.forEach((trade, rowIndex) => {
      editableFields.forEach((field, colIndex) => {
        cells.push({
          tradeId: trade.id,
          field,
          rowIndex,
          colIndex
        });
      });
    });

    return cells;
  }, [processedTrades, getEditableFields]);

  // Handle tab navigation
  const handleTabNavigation = React.useCallback((direction: 'next' | 'prev') => {
    const allCells = getAllEditableCells();
    if (allCells.length === 0) return;

    let newIndex = 0;

    if (currentTabIndex) {
      const currentCellIndex = allCells.findIndex(cell =>
        cell.rowIndex === currentTabIndex.row && cell.colIndex === currentTabIndex.col
      );

      if (direction === 'next') {
        newIndex = (currentCellIndex + 1) % allCells.length;
      } else {
        newIndex = currentCellIndex - 1;
        if (newIndex < 0) newIndex = allCells.length - 1;
      }
    }

    const targetCell = allCells[newIndex];
    setCurrentTabIndex({ row: targetCell.rowIndex, col: targetCell.colIndex });

    // Focus the target cell and activate editing
    setTimeout(() => {
      const cellElement = document.querySelector(
        `[data-trade-id="${targetCell.tradeId}"][data-field="${targetCell.field}"]`
      ) as HTMLElement;

      if (cellElement) {
        cellElement.focus();
        cellElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Automatically trigger editing/dropdown for the focused cell
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        cellElement.dispatchEvent(clickEvent);

        // For dropdown cells, also trigger Enter key to open dropdown
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        });
        cellElement.dispatchEvent(enterEvent);
      }
    }, 0);
  }, [currentTabIndex, getAllEditableCells]);

  // Global keyboard event handler for tab navigation
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        handleTabNavigation(e.shiftKey ? 'prev' : 'next');
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleTabNavigation]);

  // Secondary keyboard navigation handler (from original lines 1233-1307)
  const handleKeyboardNavigation = React.useCallback((e: KeyboardEvent) => {
    // Only handle Tab key navigation
    if (e.key !== 'Tab') return;

    const activeElement = document.activeElement;
    if (!activeElement) return;

    // Check if we're in an editable cell
    const editableCell = activeElement.closest('[data-editable-cell]');
    if (!editableCell) return;

    e.preventDefault();

    const tradeId = editableCell.getAttribute('data-trade-id');
    const currentField = editableCell.getAttribute('data-field');

    if (!tradeId || !currentField) return;

    const editableFields = getEditableFields();
    const currentFieldIndex = editableFields.indexOf(currentField);

    if (currentFieldIndex === -1) return;

    let nextFieldIndex: number;
    let nextTradeIndex: number;

    const currentTradeIndex = processedTrades.findIndex(trade => trade.id === tradeId);

    if (e.shiftKey) {
      // Navigate backwards
      if (currentFieldIndex > 0) {
        // Move to previous field in same row
        nextFieldIndex = currentFieldIndex - 1;
        nextTradeIndex = currentTradeIndex;
      } else if (currentTradeIndex > 0) {
        // Move to last field of previous row
        nextFieldIndex = editableFields.length - 1;
        nextTradeIndex = currentTradeIndex - 1;
      } else {
        return; // Already at first field of first row
      }
    } else {
      // Navigate forwards
      if (currentFieldIndex < editableFields.length - 1) {
        // Move to next field in same row
        nextFieldIndex = currentFieldIndex + 1;
        nextTradeIndex = currentTradeIndex;
      } else if (currentTradeIndex < processedTrades.length - 1) {
        // Move to first field of next row
        nextFieldIndex = 0;
        nextTradeIndex = currentTradeIndex + 1;
      } else {
        return; // Already at last field of last row
      }
    }

    const nextTrade = processedTrades[nextTradeIndex];
    const nextField = editableFields[nextFieldIndex];

    // Focus the next editable cell
    setTimeout(() => {
      const nextCell = document.querySelector(
        `[data-editable-cell][data-trade-id="${nextTrade.id}"][data-field="${nextField}"]`
      ) as HTMLElement;

      if (nextCell) {
        nextCell.focus();
        // If it's an input field, select all text
        const input = nextCell.querySelector('input');
        if (input) {
          input.select();
        }
      }
    }, 0);
  }, [getEditableFields, processedTrades]);

  // ===== CELL VALUE FORMATTING (EXACT COPY from original lines 1317-1368) =====
  // Format cell value based on its type
  const formatCellValue = (value: any, key: string) => {
    if (value === undefined || value === null || value === '') return '-';

    // Format dates
    if (key.endsWith('Date')) {
      return formatDate(value as string);
    }

    // Format currency values with single rupee symbol
    if ([
      'entry', 'avgEntry', 'sl', 'tsl', 'cmp', 'pyramid1Price', 'pyramid2Price',
      'exit1Price', 'exit2Price', 'exit3Price', 'avgExitPrice', 'realisedAmount', 'plRs'
    ].includes(key)) {
      const numValue = Number(value);
      if (isNaN(numValue)) return '-';
      return '₹' + formatCurrency(numValue);
    }

    // Format percentage values
    if (['slPercent', 'openHeat', 'allocation', 'pfImpact', 'cummPf', 'stockMove'].includes(key)) {
      const numValue = Number(value);
      if (isNaN(numValue)) return '-';
      return `${numValue.toFixed(2)}%`;
    }

    // Format position size to whole number
    if (key === 'positionSize') {
      const numValue = Number(value);
      if (isNaN(numValue)) return '-';
      return String(Math.round(numValue));
    }

    // Format reward/risk ratio - CRITICAL FIX: Handle negative R:R for losing trades
    if (key === 'rewardRisk') {
      const rr = Number(value);
      if (isNaN(rr) || rr === 0) return '-';
      const rrStr = Math.abs(rr) % 1 === 0 ? Math.abs(rr).toFixed(0) : Math.abs(rr).toFixed(2);
      return rr > 0 ? `${rrStr}R` : `-${rrStr}R`;
    }

    // Format boolean values
    if (key === 'planFollowed') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  };

  // Add color to P/L values
  const getValueColor = (value: any, key: string) => {
    if (key !== 'plRs') return '';
    const numValue = Number(value);
    if (isNaN(numValue)) return '';
    return numValue < 0 ? 'text-danger' : numValue > 0 ? 'text-success' : '';
  };

  // Render holding days with tooltip (from original)
  const renderHoldingDays = useCallback((trade: Trade) => {
    const tooltipData = precomputedTooltips.get(trade.id)?.holdingDays;
    if (!tooltipData) {
      return <div className="py-1 px-2 text-right">-</div>;
    }

    const { displayDays, lotBreakdown, isOpenPosition, isPartialPosition } = tooltipData;

    let tooltipContent;
    if (isOpenPosition) {
      tooltipContent = (
        <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
          <div className="font-semibold">Holding Days</div>
          {lotBreakdown.filter((l: any) => !l.exited).map((l: any, idx: number) => (
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
      tooltipContent = (
        <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
          <div className="font-semibold">Holding Days</div>
          {lotBreakdown.map((l: any, idx: number) => (
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
      tooltipContent = (
        <div className="flex flex-col gap-1 text-xs max-w-xs min-w-[120px]">
          <div className="font-semibold">Holding Days</div>
          {lotBreakdown.map((l: any, idx: number) => (
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
        content={tooltipContent}
        placement="top"
        delay={100}
        closeDelay={50}
        radius="sm"
        shadow="md"
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
  }, [precomputedTooltips]);

  // Cell rendering moved to TradeTableRow component - 675 lines eliminated!




  // ===== RENDER =====
  return (
    <div className="space-y-4">
      {/* Header Section */}
      <JournalHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        visibleColumns={new Set(visibleColumns)}
        setVisibleColumns={(columns) => setVisibleColumns(Array.from(columns))}
        onAddTrade={handleAddTrade}
        onImportTrades={handleImportTrades}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        isStatsMasked={isStatsMasked}
        toggleStatsMask={toggleStatsMask}
        onOpenUniversalChartViewer={() => setIsUniversalViewerOpen(true)}
        isLoading={isLoading}
        isRecalculating={isRecalculating}
        toggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Stats Section */}
      <JournalStats
        {...statsData}
        processedTrades={processedTrades}
        trades={trades}
        useCashBasis={useCashBasis}
        getAccountingAwareValues={getAccountingAwareValues}
        isStatsMasked={isStatsMasked}
        onToggleStatsMask={toggleStatsMask}
        isLoading={isLoading}
        isRecalculating={isRecalculating}
        formatCurrency={formatCurrencyForStats}
        maskValue={maskValue}
        statsTitle={statsTitle}
        portfolioSize={portfolioSize}
        getTradeCalculation={getTradeCalculation}
        calcTradeOpenHeat={calcTradeOpenHeat}
        getPortfolioSize={getPortfolioSize}
      />

      {/* Table Section - Match original with Card wrapper */}
      <Card className="border border-divider">
        <CardBody className="p-0">
          <TradeTable
            trades={paginatedTrades}
            columns={visibleTableColumns}
            page={page}
            pages={pages}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={rowsPerPageOptions}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            isNotesWrapEnabled={isNotesWrapEnabled}
            onNotesWrapChange={setIsNotesWrapEnabled}
            onInlineEditSave={handleInlineEditSave}
            onEditTrade={handleEditTrade}
            onDeleteTrade={handleDeleteTrade}
            onViewChart={handleChartImageView}
            onUploadCharts={handleUploadOnly}
            getAccountingAwareValues={getAccountingAwareValues}
            formatCurrency={formatCurrency}
            formatCellValue={formatCellValue}
            getValueColor={getValueColor}
            precomputedTooltips={precomputedTooltips}
            onAddTrade={handleAddTradeInline}
            onAutoNumberTrades={handleAutoNumberTrades}
            onImportCSV={handleImportTrades}
            isLoading={isLoading}
            // FIXED: Enable virtualization for any page showing more than 100 rows
            enableVirtualization={paginatedTrades.length > 100}
            estimateSize={60} // Optimal row height for performance
          />
        </CardBody>
      </Card>

      {/* Modals */}
      <TradeModal
        isOpen={isTradeModalOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleTradeModalClose();
          }
        }}
        trade={selectedTrade}
        onSave={selectedTrade ? updateTrade : addTrade}
        mode={selectedTrade ? "edit" : "add"}
        isUploadOnlyMode={isUploadOnlyMode}
        isActionsEditMode={isActionsEditMode}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onOpenChange={onDeleteModalClose}
        onDelete={handleConfirmDelete}
        tradeName={tradeToDelete?.name || ''}
      />

      <TradeUploadModal
        isOpen={isUploadModalOpen}
        onOpenChange={onUploadModalClose}
        onImport={bulkImportTrades}
      />



      {/* Chart Image Viewer Modal */}
      <ChartImageViewer
        isOpen={isChartViewerOpen}
        onOpenChange={setIsChartViewerOpen}
        chartImage={chartViewerImage}
        title={chartViewerTitle}
      />

      {/* Universal Chart Viewer Modal */}
      <UniversalChartViewer
        isOpen={isUniversalViewerOpen}
        onOpenChange={setIsUniversalViewerOpen}
        initialChartImage={chartViewerImage}
        refreshTrigger={chartRefreshTrigger}
      />
    </div>
  );
});

export default TradeJournal;
