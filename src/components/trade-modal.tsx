import React, { useMemo, useState, useEffect, useCallback, useReducer, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Checkbox,
  Select,
  SelectItem,
  Textarea,
  Divider,
  Tabs,
  Tab,
  Chip
} from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Trade, ChartImage, TradeChartAttachments } from "../types/trade";
import { v4 as uuidv4 } from 'uuid';
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePriceTicks } from "../hooks/usePriceTicks";
import { fetchPriceTicksSmart } from '../utils/priceTickApi';
import { ChartImageUpload } from "./ChartImageUpload";
import { ChartImageViewer } from "./ChartImageViewer";
import { UniversalChartViewer } from "./UniversalChartViewer";
import { useTerminology } from "../context/TerminologyContext";
import {
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcSLPercent,
  calcExitedQty,
  calcAvgExitPrice,
  calcStockMove,
  calcRewardRisk,
  calcHoldingDays,
  calcRealisedAmount,
  calcPLRs,
  calcPFImpact,
  calcCummPf,
  calcRealizedPL_FIFO
} from "../lib/calculations";
import { useTruePortfolioWithTrades } from "../hooks/use-true-portfolio-with-trades";
import { useTrades } from "../hooks/use-trades";
import { validateTrade, TradeIssue } from "../utils/tradeValidations";
import * as Papa from "papaparse";

// ===================================================================================
// === DATA TYPES & DEFAULTS
// ===================================================================================

interface TradeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  trade?: Trade;
  onSave: (trade: Trade) => void;
  mode: "add" | "edit";
  symbol?: string;
  isUploadOnlyMode?: boolean;
  isActionsEditMode?: boolean;
  onChartRefresh?: () => void;
}

type TradeModalFormData = Trade & { slPercent: number };

const defaultTrade: TradeModalFormData = {
  id: "", tradeNo: "", date: new Date().toISOString().split("T")[0], name: "", entry: 0, avgEntry: 0, sl: 0, tsl: 0, buySell: "Buy", cmp: 0, setup: "", baseDuration: "", initialQty: 0, pyramid1Price: 0, pyramid1Qty: 0, pyramid1Date: "", pyramid2Price: 0, pyramid2Qty: 0, pyramid2Date: "", positionSize: 0, allocation: 0, exit1Price: 0, exit1Qty: 0, exit1Date: "", exit2Price: 0, exit2Qty: 0, exit2Date: "", exit3Price: 0, exit3Qty: 0, exit3Date: "", openQty: 0, exitedQty: 0, avgExitPrice: 0, stockMove: 0, rewardRisk: 0, holdingDays: 0, positionStatus: "Open", realisedAmount: 0, plRs: 0, pfImpact: 0, cummPf: 0, planFollowed: true, exitTrigger: "", proficiencyGrowthAreas: "", slPercent: 0, openHeat: 0
};

interface TradeEntry { price: number; qty: number; }

// ===================================================================================
// === CENTRALIZED CALCULATION LOGIC (PRESERVED EXACTLY)
// ===================================================================================

const recalculateTrade = (trade: Partial<TradeModalFormData>, defaultPortfolioSize: number, getPortfolioSize?: (month: string, year: number) => number): TradeModalFormData => {
  const entries: TradeEntry[] = [
    { price: Number(trade.entry || 0), qty: Number(trade.initialQty || 0) },
    { price: Number(trade.pyramid1Price || 0), qty: Number(trade.pyramid1Qty || 0) },
    { price: Number(trade.pyramid2Price || 0), qty: Number(trade.pyramid2Qty || 0) }
  ].filter(e => e.qty > 0 && e.price > 0);

  const avgEntry = entries.length > 0 ? calcAvgEntry(entries) : Number(trade.entry) || 0;
  const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
  const positionSize = totalQty > 0 ? calcPositionSize(avgEntry, totalQty) : 0;
  
  let tradePortfolioSize = defaultPortfolioSize;
  if (trade.date && getPortfolioSize) {
    const tradeDate = new Date(trade.date);
    const month = tradeDate.toLocaleString('default', { month: 'short' });
    const year = tradeDate.getFullYear();
    const monthlyPortfolioSize = getPortfolioSize(month, year);
    // Only use monthly portfolio size if it's a valid positive number
    if (monthlyPortfolioSize !== undefined && monthlyPortfolioSize > 0) {
      tradePortfolioSize = monthlyPortfolioSize;
    }
  }
  
  const allocation = positionSize > 0 && tradePortfolioSize > 0 ? calcAllocation(positionSize, tradePortfolioSize) : 0;

  // Chart uploads are pure file operations - no calculations needed
  
  const exit1Qty = Number(trade.exit1Qty || 0);
  const exit2Qty = Number(trade.exit2Qty || 0);
  const exit3Qty = Number(trade.exit3Qty || 0);
  
  const exitedQty = calcExitedQty(exit1Qty, exit2Qty, exit3Qty);
  const openQty = Math.max(0, totalQty - exitedQty);
  
  const exits: TradeEntry[] = [
    { price: Number(trade.exit1Price || 0), qty: exit1Qty },
    { price: Number(trade.exit2Price || 0), qty: exit2Qty },
    { price: Number(trade.exit3Price || 0), qty: exit3Qty }
  ].filter(e => e.qty > 0 && e.price > 0);
  
  const avgExitPrice = exits.length > 0 ? calcAvgExitPrice(exits) : 0;
  const stockMove = avgEntry > 0 ? calcStockMove(avgEntry, avgExitPrice, Number(trade.cmp || 0), openQty, exitedQty, trade.positionStatus || 'Open', trade.buySell || 'Buy') : 0;
  
  const entryPrice = Number(trade.entry) || 0;
  const slPrice = Number(trade.sl) || 0;
  const slPercent = entryPrice > 0 && slPrice > 0 ? calcSLPercent(slPrice, entryPrice) : 0;
  
  const cmp = Number(trade.cmp) || 0;
  const rewardRisk = entryPrice > 0 && slPrice > 0 ? calcRewardRisk(cmp, entryPrice, slPrice, trade.positionStatus || 'Open', avgExitPrice, openQty, exitedQty, trade.buySell || 'Buy') : 0;
  
  const entryDate = trade.date || '';
  const exitDate = trade.exit1Date || '';
  const holdingDays = entryDate && exitDate ? calcHoldingDays(entryDate, exitDate) : 0;
  
  const realisedAmount = exitedQty > 0 ? calcRealisedAmount(exitedQty, avgExitPrice) : 0;

  const entryLots = [
    { price: Number(trade.entry || 0), qty: Number(trade.initialQty || 0) },
    { price: Number(trade.pyramid1Price || 0), qty: Number(trade.pyramid1Qty || 0) },
    { price: Number(trade.pyramid2Price || 0), qty: Number(trade.pyramid2Qty || 0) }
  ].filter(e => e.qty > 0 && e.price > 0);
  const exitLots = [
    { price: Number(trade.exit1Price || 0), qty: exit1Qty },
    { price: Number(trade.exit2Price || 0), qty: exit2Qty },
    { price: Number(trade.exit3Price || 0), qty: exit3Qty }
  ].filter(e => e.qty > 0 && e.price > 0);
  const plRs = exitedQty > 0 ? calcRealizedPL_FIFO(entryLots, exitLots, trade.buySell as 'Buy' | 'Sell') : 0;
  
  const pfImpact = tradePortfolioSize > 0 ? calcPFImpact(plRs, tradePortfolioSize) : 0;
  
  return { ...(trade as TradeModalFormData), avgEntry, positionSize, allocation, exitedQty, openQty, avgExitPrice, stockMove, slPercent, rewardRisk, holdingDays, realisedAmount, plRs, pfImpact };
};


// ===================================================================================
// === STATE MANAGEMENT (useReducer) - The Performance Core
// ===================================================================================
interface ModalState { formData: TradeModalFormData; validationIssues: TradeIssue[]; cmpManuallySet: boolean; isDirty: boolean; activeTab: string; chartAttachments: TradeChartAttachments; chartUploadMethods: { [key: string]: 'file' | 'url' }; }
type ModalAction = | { type: 'RESET_FORM'; payload: { trade?: Trade; mode: string; isUploadOnlyMode: boolean; isActionsEditMode: boolean; } } | { type: 'SET_FIELD'; payload: { field: keyof TradeModalFormData; value: any; } } | { type: 'SET_CMP'; payload: { value: number; isAuto: boolean; } } | { type: 'RECALCULATE_AND_VALIDATE'; payload: { portfolioSize: number; getPortfolioSize: any; } } | { type: 'SET_ACTIVE_TAB'; payload: string } | { type: 'SET_CHART_ATTACHMENTS'; payload: TradeChartAttachments; } | { type: 'SET_CHART_UPLOAD_METHOD'; payload: { imageType: 'beforeEntry' | 'afterExit'; method: 'file' | 'url' } };

// Helper function to format date fields for HTML date inputs
const formatDateForInput = (dateValue: any): string => {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') {
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // If it's an ISO datetime string, extract the date part
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // Try to parse and format other date formats
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return '';
};

const tradeModalReducer = (state: ModalState, action: ModalAction): ModalState => {
  switch (action.type) {
    case 'RESET_FORM':
      const { trade, mode, isUploadOnlyMode, isActionsEditMode } = action.payload;
      let initialFormData = trade ? { ...defaultTrade, ...trade } : { ...defaultTrade, tradeNo: '' };

      // Format all date fields to ensure they work with HTML date inputs
      if (trade) {
        const dateFields = ['date', 'pyramid1Date', 'pyramid2Date', 'exit1Date', 'exit2Date', 'exit3Date'];
        dateFields.forEach(field => {
          if (initialFormData[field as keyof TradeModalFormData]) {
            initialFormData[field as keyof TradeModalFormData] = formatDateForInput(initialFormData[field as keyof TradeModalFormData]) as any;
          }
        });
      }

      const loadedChartAttachments = trade?.chartAttachments || {};
      return { ...state, formData: initialFormData, activeTab: isUploadOnlyMode ? 'charts' : (isActionsEditMode ? 'basic' : 'basic'), chartAttachments: loadedChartAttachments, isDirty: false, cmpManuallySet: !!trade?.cmp, validationIssues: validateTrade(initialFormData) };
    case 'SET_FIELD':
      const newFormData = { ...state.formData, [action.payload.field]: action.payload.value };
      return { ...state, isDirty: true, formData: newFormData, cmpManuallySet: action.payload.field === 'cmp' ? true : state.cmpManuallySet };
    case 'SET_CMP':
      return { ...state, isDirty: true, formData: { ...state.formData, cmp: action.payload.value, _cmpAutoFetched: action.payload.isAuto }, cmpManuallySet: !action.payload.isAuto };
    case 'RECALCULATE_AND_VALIDATE':
      const recalculated = recalculateTrade(state.formData, action.payload.portfolioSize, action.payload.getPortfolioSize);
      return { ...state, formData: recalculated, validationIssues: validateTrade(recalculated) };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_CHART_ATTACHMENTS':
      // COMPLETELY REMOVED: No recalculation, no validation, no formData update
      // Chart uploads are pure file attachments - they don't affect any trade data
      return { ...state, chartAttachments: action.payload };
    case 'SET_CHART_UPLOAD_METHOD':
      return { ...state, chartUploadMethods: { ...state.chartUploadMethods, [action.payload.imageType]: action.payload.method } };
    default:
      return state;
  }
};

const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
};


// ===================================================================================
// === MAIN COMPONENT
// ===================================================================================
export const TradeModal: React.FC<TradeModalProps> = React.memo(({ isOpen, onOpenChange, trade, onSave, mode, symbol: initialSymbol = "", isUploadOnlyMode = false, isActionsEditMode = false, onChartRefresh }) => {
  const { getColumnLabel } = useTerminology();
  const { trades } = useTrades();
  const { portfolioSize, getPortfolioSize } = useTruePortfolioWithTrades(trades);

  const [state, dispatch] = useReducer(tradeModalReducer, { formData: defaultTrade, validationIssues: [], cmpManuallySet: false, isDirty: false, activeTab: 'basic', chartAttachments: {}, chartUploadMethods: {} });
  const { formData, validationIssues, cmpManuallySet, isDirty, activeTab, chartAttachments, chartUploadMethods } = state;

  const debouncedFormData = useDebounce(formData, 300);
  useEffect(() => { if (isOpen) { dispatch({ type: 'RESET_FORM', payload: { trade, mode, isUploadOnlyMode, isActionsEditMode } }); } }, [isOpen, trade, mode, isUploadOnlyMode, isActionsEditMode]);
  useEffect(() => { if (isDirty) { dispatch({ type: 'RECALCULATE_AND_VALIDATE', payload: { portfolioSize, getPortfolioSize } }); } }, [debouncedFormData, portfolioSize, getPortfolioSize, isDirty]);

  const [isChartViewerOpen, setIsChartViewerOpen] = useState(false); const [chartViewerImage, setChartViewerImage] = useState<ChartImage | null>(null); const [isUniversalViewerOpen, setIsUniversalViewerOpen] = useState(false); const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);

  const handleChange = useCallback((field: keyof TradeModalFormData, value: any) => { const numericFields = ['entry', 'sl', 'tsl', 'cmp', 'initialQty', 'pyramid1Price', 'pyramid1Qty', 'pyramid2Price', 'pyramid2Qty', 'exit1Price', 'exit1Qty', 'exit2Price', 'exit2Qty', 'exit3Price', 'exit3Qty']; const processedValue = numericFields.includes(field as string) ? Number(value) || 0 : value; dispatch({ type: 'SET_FIELD', payload: { field, value: processedValue } }); }, []);
  const handleCmpFetch = useCallback(async (symbol: string) => { if (symbol && !cmpManuallySet) { try { const priceData = await fetchPriceTicksSmart(symbol); const ticks = priceData?.data?.ticks?.[symbol.toUpperCase()]; if (ticks && ticks.length > 0) { dispatch({ type: 'SET_CMP', payload: { value: ticks[ticks.length - 1][4], isAuto: true } }); } } catch (err) { console.warn(`Failed to fetch price for ${symbol}:`, err); } } }, [cmpManuallySet]);
  useEffect(() => { if (formData.name) handleCmpFetch(formData.name); }, [formData.name, handleCmpFetch]);

  // FIXED: Create wrapper functions that match ChartImageUpload's expected signature
  const handleBeforeEntryUploaded = useCallback((chartImage: ChartImage, uploadMethod?: 'file' | 'url') => {
    const newAttachments = { ...chartAttachments, beforeEntry: chartImage };
    newAttachments.metadata = { createdAt: chartAttachments.metadata?.createdAt || new Date(), updatedAt: new Date(), totalSize: (newAttachments.beforeEntry?.size || 0) + (newAttachments.afterExit?.size || 0) };
    dispatch({ type: 'SET_CHART_ATTACHMENTS', payload: newAttachments });
    if (uploadMethod) dispatch({ type: 'SET_CHART_UPLOAD_METHOD', payload: { imageType: 'beforeEntry', method: uploadMethod } });
    setChartRefreshTrigger(p => p + 1);
    onChartRefresh?.();
  }, [chartAttachments, onChartRefresh]);

  const handleAfterExitUploaded = useCallback((chartImage: ChartImage, uploadMethod?: 'file' | 'url') => {
    const newAttachments = { ...chartAttachments, afterExit: chartImage };
    newAttachments.metadata = { createdAt: chartAttachments.metadata?.createdAt || new Date(), updatedAt: new Date(), totalSize: (newAttachments.beforeEntry?.size || 0) + (newAttachments.afterExit?.size || 0) };
    dispatch({ type: 'SET_CHART_ATTACHMENTS', payload: newAttachments });
    if (uploadMethod) dispatch({ type: 'SET_CHART_UPLOAD_METHOD', payload: { imageType: 'afterExit', method: uploadMethod } });
    setChartRefreshTrigger(p => p + 1);
    onChartRefresh?.();
  }, [chartAttachments, onChartRefresh]);

  const handleBeforeEntryDeleted = useCallback(() => {
    const newAttachments = { ...chartAttachments };
    delete newAttachments.beforeEntry;
    const hasRemaining = !!newAttachments.beforeEntry || !!newAttachments.afterExit;
    const updatedPayload = hasRemaining ? { ...newAttachments, metadata: { createdAt: newAttachments.metadata?.createdAt || new Date(), updatedAt: new Date(), totalSize: (newAttachments.beforeEntry?.size || 0) + (newAttachments.afterExit?.size || 0) } } : {};
    dispatch({ type: 'SET_CHART_ATTACHMENTS', payload: updatedPayload });
    setChartRefreshTrigger(p => p + 1);
    onChartRefresh?.();
  }, [chartAttachments, onChartRefresh]);

  const handleAfterExitDeleted = useCallback(() => {
    const newAttachments = { ...chartAttachments };
    delete newAttachments.afterExit;
    const hasRemaining = !!newAttachments.beforeEntry || !!newAttachments.afterExit;
    const updatedPayload = hasRemaining ? { ...newAttachments, metadata: { createdAt: newAttachments.metadata?.createdAt || new Date(), updatedAt: new Date(), totalSize: (newAttachments.beforeEntry?.size || 0) + (newAttachments.afterExit?.size || 0) } } : {};
    dispatch({ type: 'SET_CHART_ATTACHMENTS', payload: updatedPayload });
    setChartRefreshTrigger(p => p + 1);
    onChartRefresh?.();
  }, [chartAttachments, onChartRefresh]);
  const handleSubmit = useCallback(async () => {
    if (validationIssues.some(i => i.type === 'error')) {
      alert(`Cannot save trade:\n${validationIssues.filter(i => i.type === 'error').map(i => i.message).join('\n')}`);
      return;
    }
    // FIXED: Include chart attachments when saving the trade
    const finalTrade = { ...formData, id: formData.id || uuidv4(), chartAttachments };
    onSave(finalTrade);
    onOpenChange(false);
  }, [formData, chartAttachments, validationIssues, onSave, onOpenChange]);
  
  const NameCell = useMemo(() => React.memo(function NameCell({ value, onSave }: { value: string; onSave: (value: string) => void; }) {
      const [isEditing, setIsEditing] = useState(false); const [editValue, setEditValue] = useState(value); const [showDropdown, setShowDropdown] = useState(false); const [filtered, setFiltered] = useState<string[]>([]); const [selectedIndex, setSelectedIndex] = useState(-1); const inputRef = useRef<HTMLInputElement>(null); const dropdownRef = useRef<HTMLDivElement>(null); const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 }); const [stockNames, setStockNames] = useState<string[]>([]);
      useEffect(() => { async function load() { const res = await fetch('/name_sector_industry.csv'); const text = await res.text(); const papa = (await import('papaparse')).default; papa.parse(text, { header: true, complete: (r) => { const n = (r.data as any[]).map(row => row['Stock Name']).filter(Boolean); setStockNames(n); } }); } load(); }, []);
      const findClosestMatch = (input: string): string | null => { if (!input || !stockNames.length) return null; const lower = input.toLowerCase(); const prefix = stockNames.find(n => n.toLowerCase().startsWith(lower)); if (prefix) return prefix; const includes = stockNames.find(n => n.toLowerCase().includes(lower)); if (includes) return includes; return null; };
      useEffect(() => { if (isEditing && editValue) { const m = stockNames.filter(n => n.toLowerCase().includes(editValue.toLowerCase())); setFiltered(m.slice(0, 10)); setShowDropdown(m.length > 0); setSelectedIndex(-1); if (inputRef.current) { const r = inputRef.current.getBoundingClientRect(); setPosition({ top: r.top, left: r.left, width: r.width, height: r.height }); } } else { setShowDropdown(false); } }, [editValue, isEditing, stockNames]);
      const handleSave = (val?: string) => { const final = val ?? editValue; if (!final.trim()) { onSave(''); setIsEditing(false); return; } const exact = stockNames.find(n => n.toLowerCase() === final.toLowerCase()); if (exact) { onSave(exact); } else { const closest = findClosestMatch(final); if (closest && window.confirm(`Did you mean "${closest}"?`)) { onSave(closest); } else if (!closest && window.confirm(`"${final}" is not a valid stock name. Add it?`)) { onSave(final.toUpperCase()); } else { setEditValue(value); } } setIsEditing(false); };
      const handleKeyDown = (e: React.KeyboardEvent) => { if (!showDropdown) return; switch (e.key) { case 'ArrowDown': e.preventDefault(); setSelectedIndex(p => (p + 1) % filtered.length); break; case 'ArrowUp': e.preventDefault(); setSelectedIndex(p => (p - 1 + filtered.length) % filtered.length); break; case 'Enter': e.preventDefault(); if (selectedIndex >= 0) handleSave(filtered[selectedIndex]); else handleSave(); break; case 'Escape': e.preventDefault(); setShowDropdown(false); break; } };
      if (isEditing) { return <div className="relative"><input ref={inputRef} type="text" className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => setTimeout(() => handleSave(), 150)} onKeyDown={handleKeyDown} autoFocus /><AnimatePresence>{showDropdown && <motion.div ref={dropdownRef} style={{ position: 'fixed', top: position.top + position.height, left: position.left, width: position.width }} className="z-50 bg-white dark:bg-gray-800 border rounded shadow max-h-48 overflow-y-auto" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>{filtered.map((n, i) => <div key={n} className={`px-3 py-1.5 text-sm cursor-pointer ${i === selectedIndex ? 'bg-blue-100' : 'hover:bg-blue-50'}`} onMouseDown={() => handleSave(n)}>{n}</div>)}</motion.div>}</AnimatePresence></div>; }
      return <div className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 cursor-text" onClick={() => setIsEditing(true)}>{value || <span className="text-gray-400">Stock name</span>}</div>;
  }), []);
  
  const calculatedFields = useMemo(() => [{ name: "avgEntry", label: "Avg. Entry (₹)", unit: "₹" }, { name: "positionSize", label: "Position (₹)", unit: "₹", format: v => `${(v/1000).toFixed(1)}K` }, { name: "allocation", label: "Alloc. (%)", unit: "%" }, { name: "openQty", label: "Open Qty (qty)", unit: "qty" }, { name: "exitedQty", label: "Exited Qty (qty)", unit: "qty" }, { name: "avgExitPrice", label: "Avg. Exit (₹)", unit: "₹" }, { name: "stockMove", label: "Stock Move (₹)", unit: "₹" }, { name: "slPercent", label: "SL (%)", unit: "%" }, { name: "rewardRisk", label: "Reward/Risk (x)", unit: "x" }, { name: "holdingDays", label: "Holding Days" }, { name: "realisedAmount", label: "Realised (₹)", unit: "₹" }, { name: "plRs", label: "P/L (₹)", unit: "₹" }, { name: "pfImpact", label: "PF Impact (%)", unit: "%" }, { name: "cummPf", label: "Cumulative PF (%)", unit: "%" }], []);

  const renderField = useCallback((field: any) => {
    if (field.name === "cmp") { return <div key={field.name} className="flex flex-col gap-1"><label className="text-sm font-medium text-foreground-600 flex items-center gap-2">{field.label}{formData._cmpAutoFetched === false && <Chip size="sm" color="warning" variant="flat" className="text-xs">Manual</Chip>}{formData._cmpAutoFetched === true && <Chip size="sm" color="success" variant="flat" className="text-xs">Auto</Chip>}</label><Input type="number" value={formData.cmp?.toString() ?? "0"} onValueChange={(v) => handleChange("cmp", v)} variant="bordered" startContent={<span className="text-default-400">₹</span>} isDisabled={formData._cmpAutoFetched === true} /></div>; }
    switch (field.type) {
      case "number": return <Input key={field.name} label={field.label} type="number" value={formData[field.name]?.toString() ?? "0"} onValueChange={(v) => handleChange(field.name, v)} variant="bordered" startContent={field.unit === '₹' && <span className="text-default-400">₹</span>} endContent={field.unit && field.unit !== '₹' && <span className="text-default-400">{field.unit}</span>} />;
      case "date": return <Input key={field.name} label={field.label} type="date" value={formData[field.name] || ""} onValueChange={(v) => handleChange(field.name, v)} variant="bordered" />;
      case "select": return <Select key={field.name} label={field.label} selectedKeys={new Set([formData[field.name]])} onChange={(e) => handleChange(field.name, e.target.value)} variant="bordered">{(field.options || []).map((opt: string) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</Select>;
      case "checkbox": return <Checkbox key={field.name} isSelected={!!formData[field.name]} onValueChange={(v) => handleChange(field.name, v)}>{field.label}</Checkbox>;
      case "text": return field.name === "name" ? <NameCell key={field.name} value={formData.name || ""} onSave={(v) => handleChange("name", v)} /> : <Input key={field.name} label={field.label} value={formData[field.name] || ""} onValueChange={(v) => handleChange(field.name, v)} variant="bordered" />;
      default: return <Input key={field.name} label={field.label} value={formData[field.name] || ""} onValueChange={(v) => handleChange(field.name, v)} variant="bordered" />;
    }
  }, [formData, handleChange, NameCell]);

  const allFields = useMemo(() => ({
    basic: [{ name: "tradeNo", label: "Trade No.", type: "text" }, { name: "date", label: "Date", type: "date" }, { name: "name", label: "Stock/Asset Name", type: "text" }, { name: "entry", label: "Entry Price (₹)", type: "number", unit: "₹" }, { name: "sl", label: "Stop Loss (SL) (₹)", type: "number", unit: "₹" }, { name: "tsl", label: "Trailing SL (TSL) (₹)", type: "number", unit: "₹" }, { name: "cmp", label: "Current Market Price (₹)", type: "number", unit: "₹" }, { name: "buySell", label: "Buy/Sell", type: "select", options: ["Buy", "Sell"] }, { name: "initialQty", label: "Initial Quantity (qty)", type: "number", unit: "qty" }, { name: "setup", label: "Setup", type: "select", options: ["ITB", "Chop BO", "IPO Base", "3/5/8", "21/50", "Breakout", "Pullback", "Reversal", "Continuation", "Gap Fill", "OTB", "Stage 2", "ONP BO", "EP", "Pivot Bo", "Cheat", "Flag", "Other"] }, { name: "baseDuration", label: "Base Duration", type: "text" }, { name: "positionStatus", label: "Position Status", type: "select", options: ["Open", "Closed", "Partial"] }, { name: "planFollowed", label: "Plan Followed", type: "checkbox" }, { name: "exitTrigger", label: "Exit Trigger", type: "select", options: ["Breakeven exit", "Market Pressure", "R multiples", "Random", "SL", "Target", "Trailing SL"] }, { name: "proficiencyGrowthAreas", label: "Proficiency Growth Areas", type: "select", options: ["Biased Analysis", "Booked Early", "Didn't Book Loss", "FOMO", "Illiquid Stock", "Illogical SL", "Lack of Patience", "Late Entry", "Momentum-less stock", "Overconfidence", "Overtrading", "Poor Exit", "Poor Po Size", "Poor Sector", "Poor Stock", "Shifted SL Quickly", "Too Early Entry", "Too Tight SL"] }],
    advanced: [{ name: "pyramid1Price", label: "Pyramid-1 Price (₹)", type: "number", unit: "₹" }, { name: "pyramid1Qty", label: "Pyramid-1 Quantity (qty)", type: "number", unit: "qty" }, { name: "pyramid1Date", label: "Pyramid-1 Date", type: "date" }, { name: "pyramid2Price", label: "Pyramid-2 Price (₹)", type: "number", unit: "₹" }, { name: "pyramid2Qty", label: "Pyramid-2 Quantity (qty)", type: "number", unit: "qty" }, { name: "pyramid2Date", label: "Pyramid-2 Date", type: "date" }, { name: "exit1Price", label: "Exit-1 Price (₹)", type: "number", unit: "₹" }, { name: "exit1Qty", label: "Exit-1 Quantity (qty)", type: "number", unit: "qty" }, { name: "exit1Date", label: "Exit-1 Date", type: "date" }, { name: "exit2Price", label: "Exit-2 Price (₹)", type: "number", unit: "₹" }, { name: "exit2Qty", label: "Exit-2 Quantity (qty)", type: "number", unit: "qty" }, { name: "exit2Date", label: "Exit-2 Date", type: "date" }, { name: "exit3Price", label: "Exit-3 Price (₹)", type: "number", unit: "₹" }, { name: "exit3Qty", label: "Exit-3 Quantity (qty)", type: "number", unit: "qty" }, { name: "exit3Date", label: "Exit-3 Date", type: "date" }]
  }), []);
  const currentFields = activeTab === "basic" ? allFields.basic : allFields.advanced;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({ count: currentFields.length, getScrollElement: () => parentRef.current, estimateSize: () => 80, overscan: 5 });
  const onTabChange = useCallback((key: React.Key) => { if ((isUploadOnlyMode && key !== 'charts') || (isActionsEditMode && key === 'charts')) return; dispatch({ type: 'SET_ACTIVE_TAB', payload: key as string }); }, [isUploadOnlyMode, isActionsEditMode]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size={activeTab === 'charts' ? "3xl" : "2xl"} scrollBehavior="inside" backdrop="blur" classNames={{base:"transform-gpu backdrop-blur-sm", wrapper:"transform-gpu", backdrop:"bg-black/40", closeButton:"text-foreground/60 hover:bg-white/10"}} motionProps={{variants:{enter:{opacity:1, scale:1, y:0, transition:{duration:0.2, ease:[0.16,1,0.3,1]}}, exit:{opacity:0, scale:0.98, y:10, transition:{duration:0.15, ease:[0.16,1,0.3,1]}}}, initial:{opacity:0, scale:0.98, y:10}}}>
      <ModalContent className={`bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[85vh] z-[9999] ${activeTab === 'charts' ? 'w-[90vw] max-w-4xl' : 'w-[95vw] max-w-md'}`}>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b dark:border-gray-700 bg-white/80 dark:bg-gray-900/80"><Tabs selectedKey={activeTab} onSelectionChange={onTabChange} aria-label="Options" color="primary" size="sm" classNames={{tabList:"bg-transparent p-0.5 rounded-xl", cursor:"bg-gray-200 dark:bg-gray-600 rounded-lg shadow-sm", tab:"px-4 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 data-[selected=true]:text-gray-900 dark:data-[selected=true]:text-white data-[hover=true]:bg-gray-100/80 dark:data-[hover=true]:bg-gray-700/50 rounded-lg transition-all duration-200"}}><Tab key="basic" title="Basic" isDisabled={isUploadOnlyMode} /><Tab key="advanced" title="Advanced" isDisabled={isUploadOnlyMode} /><Tab key="charts" title="Charts" isDisabled={isActionsEditMode} /></Tabs></ModalHeader>
            <Divider />
            <ModalBody className="px-2 py-2 overflow-y-auto"><AnimatePresence mode="wait" initial={false}><motion.div key={activeTab} initial={{opacity:0, x:10}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-10}} transition={{duration:0.15, ease:[0.2,0,0.2,1]}} className="transform-gpu">{activeTab === 'charts' ? <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><ChartImageUpload tradeId={formData.id} imageType="beforeEntry" currentImage={chartAttachments.beforeEntry} onImageUploaded={handleBeforeEntryUploaded} onImageDeleted={handleBeforeEntryDeleted} allowTemporary={true} /><ChartImageUpload tradeId={formData.id} imageType="afterExit" currentImage={chartAttachments.afterExit} onImageUploaded={handleAfterExitUploaded} onImageDeleted={handleAfterExitDeleted} allowTemporary={true} suggestedUploadMethod={chartUploadMethods.beforeEntry} /></div></div> : <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {calculatedFields.map(field => {
                      const value = formData[field.name as keyof TradeModalFormData];
                      let displayValue = typeof value === 'number' ? value.toFixed(2) : value || '0';
                      if(field.format) displayValue = field.format(value);
                      else if(field.unit && field.unit !== '₹' && field.unit !== '%') displayValue = `${displayValue} ${field.unit}`;
                      if(field.unit === '%') displayValue = `${displayValue}%`;
                      return <div key={field.name} className="p-2 rounded-lg bg-default-100 border border-default-200"><div className="text-[10px] text-foreground-500">{field.label}</div><div className={`font-medium text-sm ${field.name === 'plRs' && (value > 0 ? 'text-success' : 'text-danger')}`}>{displayValue}</div></div>
                  })}
              </div>
              {validationIssues.length > 0 && <div className="mb-4 space-y-2">{validationIssues.map((issue, index) => <div key={index} className={`p-2 text-sm rounded-lg flex items-center gap-2 ${issue.type === 'error' ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700'}`}><Icon icon={issue.type === 'error' ? "lucide:alert-circle" : "lucide:alert-triangle"} />{issue.message}</div>)}</div>}
              <div ref={parentRef} className="max-h-[60vh] overflow-auto" style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>{rowVirtualizer.getVirtualItems().map((vRow) => (<div key={vRow.index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: vRow.size, transform: `translateY(${vRow.start}px)` }}><div className="p-2">{renderField(currentFields[vRow.index])}</div></div>))}</div></>}</motion.div></AnimatePresence></ModalBody>
            <Divider />
            <ModalFooter className="border-t dark:border-gray-700 py-2 px-4"><Button variant="flat" onPress={() => onOpenChange(false)} className="bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border dark:border-gray-600 h-8 text-xs">Cancel</Button><Button color="primary" onPress={handleSubmit} isDisabled={validationIssues.some(i => i.type === 'error')} className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md h-8 text-sm" isIconOnly><Icon icon={mode === "add" ? "lucide:plus" : "lucide:check"} className="h-4 w-4" /></Button></ModalFooter>
          </>
        )}
      </ModalContent>
      <ChartImageViewer isOpen={isChartViewerOpen} onOpenChange={setIsChartViewerOpen} chartImage={chartViewerImage} title={chartViewerImage ? (chartAttachments.beforeEntry?.id === chartViewerImage.id ? 'Before Entry' : 'After Exit') : 'Chart'} />
      <UniversalChartViewer isOpen={isUniversalViewerOpen} onOpenChange={setIsUniversalViewerOpen} initialTradeId={formData.id} refreshTrigger={chartRefreshTrigger} />
    </Modal>
  );
});

TradeModal.displayName = "TradeModal";