import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SortDescriptor {
  column: string;
  direction: 'ascending' | 'descending';
}

interface TradeFilterState {
  // WORLD-CLASS STATE: All UI state in one place
  searchQuery: string;
  statusFilter: string;
  sortDescriptor: SortDescriptor;
  accountingMethod: string;
  globalFilter: any;
  visibleColumns: string[];

  // Actions
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: string) => void;
  setSortDescriptor: (descriptor: SortDescriptor) => void;
  setAccountingMethod: (method: string) => void;
  setGlobalFilter: (filter: any) => void;
  setVisibleColumns: (columns: string[]) => void;

  // Bulk update for efficiency
  updateFilters: (updates: Partial<Omit<TradeFilterState, 'setSearchQuery' | 'setStatusFilter' | 'setSortDescriptor' | 'setAccountingMethod' | 'setGlobalFilter' | 'setVisibleColumns' | 'updateFilters'>>) => void;
}

/**
 * WORLD-CLASS ZUSTAND STORE
 * 
 * Single source of truth for all UI state:
 * - Filters, sorting, column visibility
 * - Persisted to localStorage automatically
 * - Shared across all components
 * - No prop drilling needed
 */
export const useTradeFilterStore = create<TradeFilterState>()(
  persist(
    (set, get) => ({
      // WORLD-CLASS INITIAL STATE: All defaults in one place
      searchQuery: '',
      statusFilter: '',
      sortDescriptor: { column: 'tradeNo', direction: 'ascending' },
      accountingMethod: 'accrual',
      globalFilter: 'all',
      visibleColumns: [
        'tradeNo', 'date', 'name', 'setup', 'buySell', 'entry', 'avgEntry', 'sl', 'slPercent', 'tsl', 'cmp',
        'initialQty', 'pyramid1Price', 'pyramid1Qty', 'pyramid1Date', 'pyramid2Price', 'pyramid2Qty', 'pyramid2Date',
        'positionSize', 'allocation', 'exit1Price', 'exit1Qty', 'exit1Date', 'exit2Price', 'exit2Qty', 'exit2Date',
        'exit3Price', 'exit3Qty', 'exit3Date', 'openQty', 'exitedQty', 'avgExitPrice', 'stockMove', 'openHeat',
        'rewardRisk', 'holdingDays', 'positionStatus', 'realisedAmount', 'plRs', 'pfImpact', 'cummPf',
        'planFollowed', 'exitTrigger', 'proficiencyGrowthAreas', 'chartAttachments', 'actions', 'unrealizedPL', 'notes'
      ],

      // Actions
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      setSortDescriptor: (sortDescriptor) => set({ sortDescriptor }),
      setAccountingMethod: (accountingMethod) => set({ accountingMethod }),
      setGlobalFilter: (globalFilter) => set({ globalFilter }),
      setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
      
      // Bulk update for efficiency
      updateFilters: (updates) => set((state) => ({ ...state, ...updates })),
    }),
    {
      name: 'trade-filter-store', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        searchQuery: state.searchQuery,
        statusFilter: state.statusFilter,
        sortDescriptor: state.sortDescriptor,
        accountingMethod: state.accountingMethod,
        visibleColumns: state.visibleColumns,
        // Don't persist globalFilter as it might be context-dependent
      }),
    }
  )
);

// Selector hooks for performance optimization
export const useSearchQuery = () => useTradeFilterStore((state) => state.searchQuery);
export const useStatusFilter = () => useTradeFilterStore((state) => state.statusFilter);
export const useSortDescriptor = () => useTradeFilterStore((state) => state.sortDescriptor);
export const useAccountingMethod = () => useTradeFilterStore((state) => state.accountingMethod);
export const useGlobalFilter = () => useTradeFilterStore((state) => state.globalFilter);
export const useVisibleColumns = () => useTradeFilterStore((state) => state.visibleColumns);

// Action hooks
export const useTradeFilterActions = () => useTradeFilterStore((state) => ({
  setSearchQuery: state.setSearchQuery,
  setStatusFilter: state.setStatusFilter,
  setSortDescriptor: state.setSortDescriptor,
  setAccountingMethod: state.setAccountingMethod,
  setGlobalFilter: state.setGlobalFilter,
  setVisibleColumns: state.setVisibleColumns,
  updateFilters: state.updateFilters,
}));
