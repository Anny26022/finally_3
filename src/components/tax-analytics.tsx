import React, { useCallback, useMemo, useRef, memo, useReducer, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { FixedSizeList } from "react-window";
import { TaxSummaryChart } from "./tax/tax-summary-chart";
import { TaxTable } from "./tax/tax-table";
import { TaxEditModal } from "./tax/tax-edit-modal";
import { useTrades } from "../hooks/use-trades";
import { useAccountingMethod } from "../context/AccountingMethodContext";
import { useGlobalFilter } from "../context/GlobalFilterContext";
import { calculateTradePL } from "../utils/accountingUtils";
import { SupabaseService } from '../services/supabaseService';
import { AuthService } from '../services/authService';

// ===================================================================================
// === DATA & CACHING LOGIC
// ===================================================================================

export const invalidateTaxDataCache = async () => {
  try {
    const userId = await AuthService.getUserId();
    if (userId) {
      SupabaseService.clearMiscDataCache('taxData', userId);
    }
  } catch (error) {
    SupabaseService.clearMiscDataCache();
  }
};

const setupTaxDataListener = (callback) => {
  window.addEventListener('taxDataUpdated', callback);
  return () => {
    window.removeEventListener('taxDataUpdated', callback);
  };
};

const getCachedTaxData = async () => {
  try {
    return await SupabaseService.getMiscData('taxData') || {};
  } catch (error) {
    console.error('❌ Failed to fetch tax data:', error);
    return {};
  }
};

export const updateChargesBreakdown = async (chargesData) => {
  try {
    const existingTaxData = await getCachedTaxData();
    const updatedTaxData = {
      ...existingTaxData,
      chargesBreakdown: chargesData,
      lastUpdated: new Date().toISOString()
    };
    const success = await SupabaseService.saveMiscData('taxData', updatedTaxData);
    if (success) {
      window.dispatchEvent(new CustomEvent('taxDataUpdated'));
    }
    return success;
  } catch (error) {
    return false;
  }
};

// ===================================================================================
// === WEB WORKER LOGIC (INLINED)
// ===================================================================================

const workerLogic = () => {
  // This self-executing function runs inside the worker's scope.
  self.onmessage = (event) => {
    const { trades, selectedYear, useCashBasis, taxesByMonth, monthOrder } = event.data;

    // Utility function (must be self-contained within the worker)
    // This matches the logic from utils/accountingUtils.ts
    const calculateTradePL = (trade, useCashBasis) => {
        if (!trade) return 0;

        if (!useCashBasis) {
            // Accrual basis: Use the trade's total realized P/L
            return trade.plRs ?? 0;
        } else {
            // Cash basis: Calculate P/L for the specific exit if it's a cash basis exit
            const cashBasisExit = trade._cashBasisExit;
            if (cashBasisExit) {
                const avgEntry = trade.avgEntry || trade.entry || 0;
                const correctExitPrice = cashBasisExit.price;

                if (avgEntry > 0 && correctExitPrice > 0) {
                    const pl = trade.buySell === 'Buy'
                        ? (correctExitPrice - avgEntry) * cashBasisExit.qty
                        : (avgEntry - correctExitPrice) * cashBasisExit.qty;
                    return pl;
                }
            } else {
                // Cash basis for individual trades: Use the trade's total realized P/L
                if (trade.positionStatus === 'Closed') {
                    return trade.plRs || 0;
                } else if (trade.positionStatus === 'Partial') {
                    // For partial positions, calculate realized P/L from exits only
                    const avgEntry = trade.avgEntry || trade.entry || 0;
                    let totalRealizedPL = 0;

                    // Calculate P/L for each exit
                    if (trade.exit1Date && trade.exit1Qty && trade.exit1Price && avgEntry > 0) {
                        const pl = trade.buySell === 'Buy'
                            ? (trade.exit1Price - avgEntry) * trade.exit1Qty
                            : (avgEntry - trade.exit1Price) * trade.exit1Qty;
                        totalRealizedPL += pl;
                    }

                    if (trade.exit2Date && trade.exit2Qty && trade.exit2Price && avgEntry > 0) {
                        const pl = trade.buySell === 'Buy'
                            ? (trade.exit2Price - avgEntry) * trade.exit2Qty
                            : (avgEntry - trade.exit2Price) * trade.exit2Qty;
                        totalRealizedPL += pl;
                    }

                    if (trade.exit3Date && trade.exit3Qty && trade.exit3Price && avgEntry > 0) {
                        const pl = trade.buySell === 'Buy'
                            ? (trade.exit3Price - avgEntry) * trade.exit3Qty
                            : (avgEntry - trade.exit3Price) * trade.exit3Qty;
                        totalRealizedPL += pl;
                    }

                    // Fallback: If no individual exit data but we have partial exit information
                    if (totalRealizedPL === 0 && trade.exitedQty > 0) {
                        // Use stored plRs if available (most reliable)
                        if (trade.plRs !== undefined && trade.plRs !== null) {
                            return trade.plRs;
                        }

                        // Calculate from aggregate exit data if avgExitPrice is available
                        if (trade.avgExitPrice > 0 && avgEntry > 0) {
                            const pl = trade.buySell === 'Buy'
                                ? (trade.avgExitPrice - avgEntry) * trade.exitedQty
                                : (avgEntry - trade.avgExitPrice) * trade.exitedQty;
                            return pl;
                        }
                    }

                    return totalRealizedPL;
                }
            }

            return 0;
        }
    };

    // 1. Filter Trades
    let filteredTrades = selectedYear === 'All time' ? trades : trades.filter(t => t.date.startsWith(selectedYear));

    if (useCashBasis) {
      const seenTradeIds = new Set();
      filteredTrades = filteredTrades.filter(trade => {
        const originalId = trade.id.split('_exit_')[0];
        if (seenTradeIds.has(originalId)) return false;
        seenTradeIds.add(originalId);
        return true;
      });
    }

    const closedTrades = filteredTrades
      .filter(t => t.positionStatus === "Closed" || t.positionStatus === "Partial")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const cummPfs = closedTrades.map(t => t.cummPf).filter(v => typeof v === 'number' && !isNaN(v));

    // 2. Calculate Drawdown Breakdown
    let runningMax = 0;
    let wasInDrawdown = false;
    const drawdownBreakdown = closedTrades.map((trade, index) => {
      const currentPF = trade.cummPf || 0;
      if (index === 0) runningMax = Math.max(0, currentPF);

      const isNewPeak = currentPF > runningMax;
      if (isNewPeak) {
        runningMax = currentPF;
        wasInDrawdown = false;
      }
      
      const drawdownFromPeak = runningMax - currentPF;
      const isInDrawdown = drawdownFromPeak > 0;
      const isRecovery = wasInDrawdown && drawdownFromPeak === 0 && !isNewPeak;

      let commentary, commentaryType;
      if (index === 0) { commentary = "Portfolio inception"; commentaryType = "start"; } 
      else if (isNewPeak) { commentary = "New peak achieved"; commentaryType = "peak"; } 
      else if (isRecovery) { commentary = "Full recovery achieved"; commentaryType = "recovery"; } 
      else if (drawdownFromPeak === 0) { commentary = "At peak level"; commentaryType = "neutral"; } 
      else if (drawdownFromPeak > 10) { commentary = "Deep drawdown"; commentaryType = "severe"; } 
      else if (drawdownFromPeak > 5) { commentary = "Significant drawdown"; commentaryType = "moderate"; } 
      else if (drawdownFromPeak > 2) { commentary = "Moderate drawdown"; commentaryType = "moderate"; } 
      else { commentary = "Minor correction"; commentaryType = "mild"; }

      if (isInDrawdown) wasInDrawdown = true;

      const displayDate = useCashBasis ? (trade.exit1Date || trade.exit2Date || trade.exit3Date || trade.date) : trade.date;
      return {
        uniqueKey: `${index}-${trade.id}`,
        date: displayDate, symbol: trade.name || 'Unknown', stockPFImpact: trade.pfImpact || 0,
        cummPFImpact: currentPF, drawdownFromPeak, isNewPeak, commentary, commentaryType
      };
    });

    // 3. Calculate Core Metrics
    let maxCummPF = 0, minCummPF = 0, maxDrawdown = 0, currentDrawdown = 0;
    if (cummPfs.length > 0) {
      maxCummPF = Math.max(...cummPfs);
      const currentCummPF = cummPfs[cummPfs.length - 1];
      minCummPF = Math.min(...cummPfs);

      if (maxCummPF <= 0) {
        maxDrawdown = Math.abs(minCummPF);
        currentDrawdown = Math.abs(currentCummPF);
      } else {
        let runningMaxPf = cummPfs[0];
        cummPfs.forEach(pf => {
          runningMaxPf = Math.max(runningMaxPf, pf);
          maxDrawdown = Math.max(maxDrawdown, runningMaxPf - pf);
        });
        currentDrawdown = Math.max(0, maxCummPF - currentCummPF);
      }
    }
    
    // 4. Calculate P/L
    let totalGrossPL = 0;
    if (useCashBasis) {
        const allTradesForYear = selectedYear === 'All time' ? trades : trades.filter(t => t.date.startsWith(selectedYear));
        const expandedTrades = allTradesForYear.flatMap(trade =>
            Array.isArray(trade._expandedTrades)
            ? trade._expandedTrades.filter(t => t._cashBasisExit)
            : (trade._cashBasisExit ? [trade] : [])
        );
        totalGrossPL = expandedTrades.reduce((sum, t) => sum + calculateTradePL(t, useCashBasis), 0);
    } else {
        totalGrossPL = filteredTrades.reduce((sum, t) => sum + calculateTradePL(t, useCashBasis), 0);
    }
    
    const totalTaxes = monthOrder.reduce((sum, m) => sum + (taxesByMonth[m] || 0), 0);
    const totalNetPL = totalGrossPL - totalTaxes;

    // 5. Post results back to main thread
    self.postMessage({
      type: 'RESULT',
      payload: {
        drawdownBreakdown, maxCummPF, minCummPF, maxDrawdown, currentDrawdown,
        totalGrossPL, totalTaxes, totalNetPL,
        tradesFullyCalculated: true
      }
    });
  };
};

// ===================================================================================
// === MODERN LOADER COMPONENT
// ===================================================================================
const TaxMetricsLoader = memo(() => (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} className="flex items-center justify-center py-16 px-4">
        <div className="text-center space-y-6 max-w-sm">
            <div className="relative mx-auto w-20 h-20">
                <motion.div className="absolute inset-0 rounded-full border-2 border-primary/20" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute inset-3 rounded-full border-2 border-transparent border-t-primary border-r-primary" animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                <motion.div className="absolute inset-6 rounded-full bg-primary/10" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
                <motion.div className="absolute inset-0 flex items-center justify-center" animate={{ scale: [1, 1.05, 1], }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                    <Icon icon="lucide:calculator" className="w-7 h-7 text-primary" />
                </motion.div>
            </div>
            <div className="space-y-4">
                <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }} className="text-xl font-semibold text-foreground tracking-tight">Calculating Tax Metrics</motion.h3>
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }} className="text-sm text-foreground-500 leading-relaxed max-w-xs mx-auto">Processing trade data and computing performance metrics.</motion.p>
            </div>
        </div>
    </motion.div>
));
TaxMetricsLoader.displayName = 'TaxMetricsLoader';

// ===================================================================================
// === CUSTOM HOOK FOR SCALABLE TAX CALCULATIONS
// ===================================================================================

const initialState = {
  isLoading: true,
  drawdownBreakdown: [],
  maxCummPF: 0, minCummPF: 0, maxDrawdown: 0, currentDrawdown: 0,
  totalGrossPL: 0, totalTaxes: 0, totalNetPL: 0,
};

function taxCalculationReducer(state, action) {
  switch (action.type) {
    case 'START_CALCULATION':
      return { ...state, isLoading: true };
    case 'SET_RESULT':
      return { ...state, isLoading: false, ...action.payload };
    case 'SET_TAXES': // Handle tax-only updates for responsiveness
      return {
          ...state, 
          totalTaxes: action.payload.totalTaxes,
          totalNetPL: state.totalGrossPL - action.payload.totalTaxes
      };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}

const useTaxCalculations = (trades, selectedYear, useCashBasis, taxesByMonth, monthOrder) => {
  const [state, dispatch] = useReducer(taxCalculationReducer, initialState);
  const workerRef = useRef(null);

  useEffect(() => {
    const workerScript = `(${workerLogic.toString()})()`;
    const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (event) => {
      if (event.data.type === 'RESULT') {
        dispatch({ type: 'SET_RESULT', payload: event.data.payload });
      }
    };
    
    return () => {
      workerRef.current.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  useEffect(() => {
    const tradesFullyCalculated = trades.length === 0 || trades.every(t => t.positionStatus !== 'Closed' || typeof t.cummPf === 'number');

    if (workerRef.current && tradesFullyCalculated && taxesByMonth) {
      dispatch({ type: 'START_CALCULATION' });
      workerRef.current.postMessage({ trades, selectedYear, useCashBasis, taxesByMonth, monthOrder });
    } else if (!tradesFullyCalculated) {
      dispatch({ type: 'START_CALCULATION' });
    }
  }, [trades, selectedYear, useCashBasis, taxesByMonth, monthOrder]);
  
  useEffect(() => {
    if (taxesByMonth) {
        const totalTaxes = monthOrder.reduce((sum, m) => sum + (taxesByMonth[m] || 0), 0);
        dispatch({ type: 'SET_TAXES', payload: { totalTaxes } });
    }
  }, [taxesByMonth, monthOrder]);

  return state;
};

// ===================================================================================
// === OPTIMIZED & MEMOIZED CHILD COMPONENTS
// ===================================================================================
const TaxMetrics = memo(({ isLoading, maxCummPF, minCummPF, currentDrawdown, totalGrossPL, totalTaxes, totalNetPL, onDrawdownClick }) => {
  const formatCurrency = useCallback((value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value), []);
  const tooltipContent = useMemo(() => ({ maxCummPF: <div className="max-w-xs p-2 text-sm">Max Cumulative PF (Peak)</div>, minCummPF: <div className="max-w-xs p-2 text-sm">Min Cumulative PF (Lowest)</div> }), []);

  if (isLoading) {
      return <TaxMetricsLoader />;
  }

  if (maxCummPF === 0 && minCummPF === 0 && totalGrossPL === 0) {
      return <div className="text-center py-8"><Icon icon="lucide:bar-chart-3" className="w-12 h-12 text-default-300 mx-auto" /><h3 className="mt-2 text-lg font-medium">No Data Available</h3></div>;
  }
  
  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center"><div className="flex items-center gap-2"><span>Max Cumm PF (Peak)</span><Tooltip content={tooltipContent.maxCummPF}><Button isIconOnly size="sm" variant="light"><Icon icon="lucide:info" className="w-3 h-3" /></Button></Tooltip></div><span className="text-[#00B386] font-medium">{maxCummPF.toFixed(2)}%</span></div>
        <div className="flex justify-between items-center"><div className="flex items-center gap-2"><span>Min Cumm PF</span><Tooltip content={tooltipContent.minCummPF}><Button isIconOnly size="sm" variant="light"><Icon icon="lucide:info" className="w-3 h-3" /></Button></Tooltip></div><span className="text-[#FF3B3B] font-medium">{minCummPF.toFixed(2)}%</span></div>
        <div className="flex justify-between items-center"><div className="flex items-center gap-2"><span>Drawdown</span><Button isIconOnly size="sm" variant="light" onPress={onDrawdownClick}><Icon icon="lucide:table" className="w-3 h-3" /></Button></div>{currentDrawdown < 0.001 ? <span className="text-[#00B386] font-medium flex items-center gap-1"><Icon icon="lucide:rocket" />Flying high</span> : <span className="text-[#FF3B3B] text-sm">{currentDrawdown.toFixed(2)}% LOST</span>}</div>
        <Divider />
        <div className="space-y-4">
            <div className="flex justify-between items-center"><span>Total Gross P/L</span><span className={`font-medium ${totalGrossPL >= 0 ? 'text-[#00B386]' : 'text-[#FF3B3B]'}`}>{formatCurrency(totalGrossPL)}</span></div>
            <div className="flex justify-between items-center"><span>Total Taxes</span><span className="text-[#FF3B3B] font-medium">{formatCurrency(totalTaxes)}</span></div>
            <div className="flex justify-between items-center"><span>Total Net P/L</span><span className={`font-medium ${totalNetPL >= 0 ? 'text-[#00B386]' : 'text-[#FF3B3B]'}`}>{formatCurrency(totalNetPL)}</span></div>
        </div>
    </div>
  );
});
TaxMetrics.displayName = "TaxMetrics";


// ===================================================================================
// === VIRTUALIZED DRAWDOWN TABLE (THE FIX)
// ===================================================================================

const VirtualizedDrawdownTable = memo(({ breakdownData }) => {
    if (!breakdownData || breakdownData.length === 0) {
        return <div className="p-4 text-center text-default-500">No drawdown data to display.</div>;
    }

    const columnConfig = [
        { key: 'date', label: 'Date', width: 110 },
        { key: 'symbol', label: 'Symbol', width: 120 },
        { key: 'stockPF', label: 'Stock PF Impact', width: 120, align: 'center' },
        { key: 'cummPF', label: 'Cum PF Impact', width: 120, align: 'center' },
        { key: 'drawdown', label: 'DD From Peak', width: 120, align: 'center' },
        { key: 'commentary', label: 'Commentary', width: 150, flex: 1 },
    ];

    const Row = ({ index, style }) => {
        const item = breakdownData[index];
        if (!item) return null;

        return (
            <div style={style} className={`flex items-center border-b border-divider/20 hover:bg-content1/20 transition-colors ${item.isNewPeak ? "bg-success/10 border-l-4 border-l-success" : ""}`}>
                <div className="py-2.5 px-3 text-sm flex items-center gap-1" style={{ width: columnConfig[0].width }}>
                    {item.isNewPeak && <Icon icon="lucide:crown" className="w-3 h-3 text-warning" />}
                    {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
                <div className="py-2.5 px-3 text-sm font-medium" style={{ width: columnConfig[1].width }}>{item.symbol}</div>
                <div className="py-2.5 px-3 text-sm font-medium text-center" style={{ width: columnConfig[2].width }}>
                    <span className={item.stockPFImpact >= 0 ? "text-success" : "text-danger"}>{item.stockPFImpact >= 0 ? "+" : ""}{item.stockPFImpact.toFixed(2)}%</span>
                </div>
                <div className="py-2.5 px-3 text-sm font-medium text-center" style={{ width: columnConfig[3].width }}>{item.cummPFImpact.toFixed(2)}%</div>
                <div className="py-2.5 px-3 text-sm font-medium text-center" style={{ width: columnConfig[4].width }}>
                    <span className={item.drawdownFromPeak > 0 ? "text-danger" : "text-success"}>{item.drawdownFromPeak === 0 ? "0.00%" : `-${item.drawdownFromPeak.toFixed(2)}%`}</span>
                </div>
                <div className="py-2.5 px-3 text-sm" style={{ width: columnConfig[5].width, flex: columnConfig[5].flex }}>
                    <div className={`text-xs px-2 py-1 rounded-md font-medium leading-tight inline-block ${ item.commentaryType === 'peak' ? 'bg-success/10 text-success' : item.commentaryType === 'recovery' ? 'bg-primary/10 text-primary' : item.commentaryType === 'mild' ? 'bg-warning/10 text-warning' : item.commentaryType.includes('moderate') ? 'bg-danger/10 text-danger' : item.commentaryType === 'severe' ? 'bg-danger/20 text-danger' : 'bg-default/10 text-default-600' }`}>
                        {item.commentary}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="border border-divider/30 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex bg-background sticky top-0 z-10 border-b border-divider/30">
                {columnConfig.map(col => (
                    <div key={col.key} className="px-3 py-2.5 text-sm font-medium text-default-600" style={{ width: col.width, flex: col.flex, textAlign: col.align || 'start' }}>
                        {col.label}
                    </div>
                ))}
            </div>
            {/* Body */}
            <div className="max-h-[55vh] w-full">
                <FixedSizeList
                    height={400} // Adjust this based on your modal's content area
                    itemCount={breakdownData.length}
                    itemSize={55} // The height of each row
                    width="100%"
                >
                    {Row}
                </FixedSizeList>
            </div>
        </div>
    );
});
VirtualizedDrawdownTable.displayName = 'VirtualizedDrawdownTable';


// ===================================================================================
// === MAIN COMPONENT (REFACTORED & SIMPLIFIED)
// ===================================================================================
export const TaxAnalytics = () => {
  const { trades } = useTrades();
  const { accountingMethod } = useAccountingMethod();
  const useCashBasis = accountingMethod === 'cash';

  const tradeYears = useMemo(() => Array.from(new Set(trades.map(t => new Date(t.date).getFullYear()))).sort((a, b) => b - a), [trades]);
  const yearOptions = useMemo(() => ['All time', ...tradeYears.map(String)], [tradeYears]);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [isDrawdownModalOpen, setIsDrawdownModalOpen] = useState(false);
  const [taxesByMonth, setTaxesByMonth] = useState({});

  const monthOrder = useMemo(() => ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], []);
  
  const loadTaxData = useCallback(async () => {
    const allTaxData = await getCachedTaxData();
    let yearDataToShow = {};
    if (selectedYear === 'All time') {
      const allYearData = {};
      monthOrder.forEach(month => { allYearData[month] = 0; });
      Object.values(allTaxData).forEach((yearData) => {
          if (typeof yearData === 'object' && yearData !== null) {
              Object.entries(yearData).forEach(([month, amount]) => {
                  if (typeof amount === 'number') allYearData[month] = (allYearData[month] || 0) + amount;
              });
          }
      });
      yearDataToShow = allYearData;
    } else {
      const yearData = allTaxData[selectedYear] || {};
      const completeYearData = {};
      monthOrder.forEach(month => { completeYearData[month] = yearData[month] || 0; });
      yearDataToShow = completeYearData;
    }
    setTaxesByMonth(yearDataToShow);
  }, [selectedYear, monthOrder]);
  
  useEffect(() => { loadTaxData(); }, [loadTaxData]);
  useEffect(() => setupTaxDataListener(loadTaxData), [loadTaxData]);

  const { isLoading, drawdownBreakdown, maxCummPF, minCummPF, maxDrawdown, currentDrawdown, totalGrossPL, totalTaxes, totalNetPL } = useTaxCalculations(trades, selectedYear, useCashBasis, taxesByMonth, monthOrder);

  const handleYearChange = useCallback((keys) => {
      const selected = Array.from(keys)[0];
      if (selected && selected !== selectedYear) {
          setSelectedYear(selected);
      }
  }, [selectedYear]);

  const handleDrawdownClick = useCallback(() => setIsDrawdownModalOpen(true), []);

  return (
    <div className="space-y-6">
      <motion.div className="flex justify-between items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Dropdown>
          <DropdownTrigger>
              <Button variant="light" endContent={<Icon icon="lucide:chevron-down" />} size="sm" radius="full">
                  {selectedYear}
              </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Year selection" selectionMode="single" selectedKeys={new Set([selectedYear])} onSelectionChange={handleYearChange} disallowEmptySelection>
            {yearOptions.map((option) => (<DropdownItem key={option} textValue={option}>{option}</DropdownItem>))}
          </DropdownMenu>
        </Dropdown>
        <Button variant="light" startContent={<Icon icon="lucide:download" />} size="sm" radius="full">
            Export
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
            <CardHeader><h3 className="text-xl font-semibold">Tax Summary</h3></CardHeader>
            <Divider />
            <CardBody><TaxSummaryChart taxesByMonth={taxesByMonth} selectedYear={selectedYear} /></CardBody>
        </Card>
        <Card>
            <CardHeader><h3 className="text-xl font-semibold">Tax Metrics</h3></CardHeader>
            <Divider />
            <CardBody className="p-6">
                <TaxMetrics isLoading={isLoading} {...{ maxCummPF, minCummPF, currentDrawdown, totalGrossPL, totalTaxes, totalNetPL, onDrawdownClick: handleDrawdownClick }} />
            </CardBody>
        </Card>
      </div>
      
      <Card>
          <CardHeader><h3 className="text-xl font-semibold">Monthly Tax Breakdown</h3></CardHeader>
          <Divider />
          <CardBody><TaxTable trades={trades} taxesByMonth={taxesByMonth} setTaxesByMonth={setTaxesByMonth} selectedYear={selectedYear} /></CardBody>
      </Card>
      
      <TaxEditModal isOpen={isModalOpen} onOpenchange={setIsModalOpen} month={selectedMonth} />

      <Modal isOpen={isDrawdownModalOpen} onOpenChange={setIsDrawdownModalOpen} size="3xl" scrollBehavior="inside" backdrop="blur" classNames={{ base: "transform-gpu backdrop-blur-sm", backdrop: "bg-black/40", closeButton: "text-foreground/60 hover:bg-white/10" }}>
        <ModalContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[85vh]">
          {(onClose) => (
            <>
              <ModalHeader className="border-b border-divider px-4 py-3">
                  <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10"><Icon icon="lucide:trending-down" className="text-primary" /></div>
                      <div>
                          <span className="text-base font-semibold">Drawdown Breakdown</span>
                          <p className="text-xs text-default-500 mt-0.5">{useCashBasis ? 'Cash Basis' : 'Accrual Basis'} • {selectedYear}</p>
                      </div>
                  </div>
              </ModalHeader>
              <ModalBody className="p-4">
                 <div className="space-y-3">
                    <div className="p-2 bg-content1/20 rounded-lg border border-divider/20 flex items-center justify-between">
                         <p className="text-xs font-medium">Max DD: <span className="text-danger">{maxDrawdown.toFixed(2)}%</span></p>
                         <p className="text-xs text-default-500">{useCashBasis ? 'Exit dates' : 'Entry dates'}</p>
                    </div>
                    <VirtualizedDrawdownTable breakdownData={drawdownBreakdown} />
                 </div>
              </ModalBody>
              <ModalFooter className="border-t border-divider px-4 py-1.5">
                <Button variant="flat" onPress={onClose} size="sm" startContent={<Icon icon="lucide:x" />}>
                    Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
TaxAnalytics.displayName = 'TaxAnalytics';

export default TaxAnalytics;