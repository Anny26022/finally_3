import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import { SupabaseService } from '../services/supabaseService';

export type FilterType = "all" | "week" | "month" | "fy" | "cy" | "custom";
export interface GlobalFilter {
  type: FilterType;
  startDate?: Date;
  endDate?: Date;
  year?: number;
  month?: number; // 0-11
  fyStartYear?: number;
}

const defaultFilter: GlobalFilter = { type: "all" };

// Global filter helpers - now with Supabase persistence
async function loadGlobalFilterFromSupabase(): Promise<GlobalFilter> {
  try {
    const stored = await SupabaseService.getMiscData('globalFilter');
    if (stored && stored.type) {
      // Convert date strings back to Date objects if they exist
      const filter = { ...stored };
      if (filter.startDate) filter.startDate = new Date(filter.startDate);
      if (filter.endDate) filter.endDate = new Date(filter.endDate);
      return filter;
    }
    return defaultFilter;
  } catch (error) {
    return defaultFilter;
  }
}

async function saveGlobalFilterToSupabase(filterObj: GlobalFilter) {
  try {
    // Convert Date objects to strings for storage
    const filterToStore = { ...filterObj };
    if (filterToStore.startDate) filterToStore.startDate = filterToStore.startDate.toISOString() as any;
    if (filterToStore.endDate) filterToStore.endDate = filterToStore.endDate.toISOString() as any;

    await SupabaseService.saveMiscData('globalFilter', filterToStore);
  } catch (error) {
    // Handle error silently
  }
}

const GlobalFilterContext = createContext<{
  filter: GlobalFilter;
  setFilter: React.Dispatch<React.SetStateAction<GlobalFilter>>;
}>({
  filter: defaultFilter,
  setFilter: () => {},
});

export const GlobalFilterProvider: React.FC<{
  children: React.ReactNode;
  // NEW: Accept pre-loaded data from AppInitializer
  initialGlobalFilter?: any;
}> = ({ children, initialGlobalFilter }) => {
  // Initialize with pre-loaded data or default
  const getInitialFilter = (): GlobalFilter => {
    if (initialGlobalFilter && initialGlobalFilter.type) {
      // Convert date strings back to Date objects if they exist
      const filter = { ...initialGlobalFilter };
      if (filter.startDate) filter.startDate = new Date(filter.startDate);
      if (filter.endDate) filter.endDate = new Date(filter.endDate);
      return filter;
    }
    return defaultFilter;
  };

  const [filter, setFilter] = useState<GlobalFilter>(getInitialFilter());
  const [hydrated, setHydrated] = useState(!!initialGlobalFilter);

  // Only load from Supabase if no pre-loaded data was provided
  useEffect(() => {
    if (initialGlobalFilter !== undefined) {
      // We have pre-loaded data, no need to fetch
      setHydrated(true);
      return;
    }

    // Fallback: load from Supabase directly (SupabaseService handles deduplication)
    const loadFilter = async () => {
      try {
        const savedFilter = await loadGlobalFilterFromSupabase();
        setFilter(savedFilter);
      } catch (error) {
        // Handle error silently, keep default filter
      } finally {
        setHydrated(true);
      }
    };

    loadFilter();
  }, [initialGlobalFilter]);

  // Save to Supabase when filter changes (but not on initial load)
  useEffect(() => {
    if (hydrated) {
      saveGlobalFilterToSupabase(filter);
    }
  }, [filter, hydrated]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    filter,
    setFilter
  }), [filter]);

  return (
    <GlobalFilterContext.Provider value={contextValue}>
      {children}
    </GlobalFilterContext.Provider>
  );
};

export const useGlobalFilter = () => useContext(GlobalFilterContext);