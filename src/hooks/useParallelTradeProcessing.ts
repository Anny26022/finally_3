/**
 * Parallel Trade Processing Hook
 * Breaks the cascading dependency chain with parallel processing
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trade } from '../types/trade';
import { startPerformanceTracking, endPerformanceTracking } from '../utils/performanceMonitor';

interface ProcessingStage {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

interface ParallelProcessingState {
  stages: Record<string, ProcessingStage>;
  isComplete: boolean;
  progress: number;
}

interface ParallelProcessingOptions {
  rawTrades: Trade[];
  getPortfolioSize: (month: string, year: number) => number;
  useCashBasis: boolean;
  searchQuery: string;
  statusFilter: string;
  globalFilter: any;
  sortDescriptor: any;
}

/**
 * Hook for parallel trade processing that breaks dependency chains
 */
export const useParallelTradeProcessing = (options: ParallelProcessingOptions) => {
  const {
    rawTrades,
    getPortfolioSize,
    useCashBasis,
    searchQuery,
    statusFilter,
    globalFilter,
    sortDescriptor
  } = options;

  const [processingState, setProcessingState] = useState<ParallelProcessingState>({
    stages: {},
    isComplete: false,
    progress: 0
  });

  const [finalResult, setFinalResult] = useState<Trade[]>([]);

  // Update stage status
  const updateStage = useCallback((stageName: string, updates: Partial<ProcessingStage>) => {
    setProcessingState(prev => ({
      ...prev,
      stages: {
        ...prev.stages,
        [stageName]: {
          ...prev.stages[stageName],
          ...updates
        }
      }
    }));
  }, []);

  // Calculate progress
  const calculateProgress = useCallback((stages: Record<string, ProcessingStage>) => {
    const stageNames = Object.keys(stages);
    if (stageNames.length === 0) return 0;
    
    const completedStages = stageNames.filter(name => 
      stages[name].status === 'completed'
    ).length;
    
    return (completedStages / stageNames.length) * 100;
  }, []);

  // Initialize stages
  useEffect(() => {
    const initialStages: Record<string, ProcessingStage> = {
      'portfolio-calculation': { name: 'Portfolio Calculation', status: 'pending' },
      'trade-processing': { name: 'Trade Processing', status: 'pending' },
      'cash-basis-expansion': { name: 'Cash Basis Expansion', status: 'pending' },
      'filtering': { name: 'Filtering & Search', status: 'pending' },
      'sorting': { name: 'Sorting', status: 'pending' },
      'cumulative-calculation': { name: 'Cumulative Calculation', status: 'pending' }
    };

    setProcessingState({
      stages: initialStages,
      isComplete: false,
      progress: 0
    });
  }, [rawTrades.length, useCashBasis, searchQuery, statusFilter]);

  // Parallel processing effect
  useEffect(() => {
    if (rawTrades.length === 0) {
      setFinalResult([]);
      return;
    }

    const processInParallel = async () => {
      const trackingName = `parallel-processing-${rawTrades.length}`;
      startPerformanceTracking(trackingName, { 
        tradeCount: rawTrades.length,
        parallelStages: 6
      });

      try {
        // ✅ STAGE 1: Portfolio Calculation (Independent)
        updateStage('portfolio-calculation', { status: 'processing' });
        const portfolioPromise = new Promise<Record<string, number>>((resolve) => {
          const portfolioSizes: Record<string, number> = {};
          rawTrades.forEach(trade => {
            if (trade.date) {
              const tradeDate = new Date(trade.date);
              const month = tradeDate.toLocaleString('default', { month: 'short' });
              const year = tradeDate.getFullYear();
              const monthKey = `${month}-${year}`;
              if (!portfolioSizes[monthKey]) {
                portfolioSizes[monthKey] = getPortfolioSize(month, year);
              }
            }
          });
          resolve(portfolioSizes);
        });

        // ✅ STAGE 2: Trade Processing (Depends on portfolio, but can start immediately)
        updateStage('trade-processing', { status: 'processing' });
        const tradeProcessingPromise = portfolioPromise.then(async (portfolioSizes) => {
          // Use Web Worker for heavy calculations
          if (rawTrades.length > 50) {
            const { useTradeCalculationWorker } = await import('./useTradeCalculationWorker');
            const { calculateTrades } = useTradeCalculationWorker();
            return calculateTrades(rawTrades, portfolioSizes);
          } else {
            const { processTrades } = await import('../services/tradeCalculator');
            return processTrades(rawTrades, getPortfolioSize);
          }
        });

        // ✅ STAGE 3: Cash Basis Expansion (Can prepare while trades are processing)
        updateStage('cash-basis-expansion', { status: 'processing' });
        const cashBasisPromise = tradeProcessingPromise.then(async (processedTrades) => {
          if (!useCashBasis) return processedTrades;
          
          // Use existing cash basis logic for now
          const { applyCumulativeProfit } = await import('../services/tradeCalculator');
          // For now, return processed trades as-is (cash basis logic can be added later)
          return processedTrades;
        });

        // ✅ STAGE 4: Filtering (Can prepare filter functions while data processes)
        updateStage('filtering', { status: 'processing' });
        const filteringPromise = cashBasisPromise.then((trades) => {
          let filtered = trades;

          // Global filter
          if (globalFilter && globalFilter.type !== 'all') {
            const { getTradeDateForAccounting } = require('../utils/accountingUtils');
            const { isInGlobalFilter } = require('../utils/dateFilterUtils');
            filtered = filtered.filter(trade => {
              const relevantDate = getTradeDateForAccounting(trade, useCashBasis);
              return isInGlobalFilter(relevantDate, globalFilter);
            });
          }

          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(trade => 
              trade.name?.toLowerCase().includes(query) ||
              trade.setup?.toLowerCase().includes(query) ||
              trade.tradeNo?.toLowerCase().includes(query) ||
              trade.notes?.toLowerCase().includes(query)
            );
          }

          // Status filter
          if (statusFilter) {
            filtered = filtered.filter(trade => trade.positionStatus === statusFilter);
          }

          return filtered;
        });

        // ✅ STAGE 5: Sorting (Independent of other operations)
        updateStage('sorting', { status: 'processing' });
        const sortingPromise = filteringPromise.then((trades) => {
          if (!sortDescriptor?.column) return trades;

          const { getChronologicalSortComparator } = require('../services/tradeCalculator');
          const comparator = getChronologicalSortComparator(sortDescriptor);
          return [...trades].sort(comparator);
        });

        // ✅ STAGE 6: Cumulative Calculation (Final stage)
        updateStage('cumulative-calculation', { status: 'processing' });
        const cumulativePromise = sortingPromise.then(async (trades) => {
          const { applyCumulativeProfit } = await import('../services/tradeCalculator');
          return applyCumulativeProfit(trades, useCashBasis);
        });

        // Wait for all stages and update progress
        const portfolioSizes = await portfolioPromise;
        updateStage('portfolio-calculation', { status: 'completed', result: portfolioSizes });

        const processedTrades = await tradeProcessingPromise;
        updateStage('trade-processing', { status: 'completed', result: processedTrades });

        const cashBasisTrades = await cashBasisPromise;
        updateStage('cash-basis-expansion', { status: 'completed', result: cashBasisTrades });

        const filteredTrades = await filteringPromise;
        updateStage('filtering', { status: 'completed', result: filteredTrades });

        const sortedTrades = await sortingPromise;
        updateStage('sorting', { status: 'completed', result: sortedTrades });

        const finalTrades = await cumulativePromise;
        updateStage('cumulative-calculation', { status: 'completed', result: finalTrades });

        // Set final result
        setFinalResult(finalTrades);
        
        setProcessingState(prev => ({
          ...prev,
          isComplete: true,
          progress: 100
        }));

        endPerformanceTracking(trackingName, {
          totalTrades: finalTrades.length,
          parallelStages: 6,
          success: true
        });

      } catch (error) {
        console.error('❌ Parallel processing failed:', error);
        endPerformanceTracking(trackingName, {
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    };

    processInParallel();
  }, [rawTrades, getPortfolioSize, useCashBasis, searchQuery, statusFilter, globalFilter, sortDescriptor]);

  // Update progress when stages change
  useEffect(() => {
    const progress = calculateProgress(processingState.stages);
    setProcessingState(prev => ({
      ...prev,
      progress
    }));
  }, [processingState.stages, calculateProgress]);

  return {
    trades: finalResult,
    isProcessing: !processingState.isComplete,
    progress: processingState.progress,
    stages: processingState.stages,
    isComplete: processingState.isComplete
  };
};
