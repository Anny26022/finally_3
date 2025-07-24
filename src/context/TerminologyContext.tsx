import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupabaseService } from '../services/supabaseService';

export type TerminologyType = 'pyramid' | 'buysell';

interface TerminologyContextType {
  terminology: TerminologyType;
  setTerminology: (type: TerminologyType) => void;
  getColumnLabel: (key: string) => string;
  isLoading: boolean;
  debugPersistence: () => void;
}

const TerminologyContext = createContext<TerminologyContextType | undefined>(undefined);

export const useTerminology = (): TerminologyContextType => {
  const context = useContext(TerminologyContext);
  if (!context) {
    throw new Error('useTerminology must be used within a TerminologyProvider');
  }
  return context;
};

// Column label mappings for different terminologies
const COLUMN_LABELS = {
  pyramid: {
    // Pyramid terminology (current)
    pyramid1Price: "P1 Price (₹)",
    pyramid1Qty: "P1 Qty",
    pyramid1Date: "P1 Date",
    pyramid2Price: "P2 Price (₹)",
    pyramid2Qty: "P2 Qty",
    pyramid2Date: "P2 Date",
    exit1Price: "E1 Price (₹)",
    exit1Qty: "E1 Qty",
    exit1Date: "E1 Date",
    exit2Price: "E2 Price (₹)",
    exit2Qty: "E2 Qty",
    exit2Date: "E2 Date",
    exit3Price: "E3 Price (₹)",
    exit3Qty: "E3 Qty",
    exit3Date: "E3 Date",
  },
  buysell: {
    // Buy/Sell terminology (new)
    initialQty: "QB1",
    pyramid1Price: "B2",
    pyramid1Qty: "QB2",
    pyramid1Date: "B2 Date",
    pyramid2Price: "B3",
    pyramid2Qty: "QB3",
    pyramid2Date: "B3 Date",
    exit1Price: "S1",
    exit1Qty: "QS1",
    exit1Date: "Sell1 Date",
    exit2Price: "S2",
    exit2Qty: "QS2",
    exit2Date: "Sell2 Date",
    exit3Price: "S3",
    exit3Qty: "QS3",
    exit3Date: "Sell3 Date",
  }
};

// Default column labels (fallback)
const DEFAULT_LABELS: Record<string, string> = {
  tradeNo: "Trade No.",
  date: "Date",
  name: "Name",
  setup: "Setup",
  buySell: "Buy/Sell",
  entry: "Entry (₹)",
  avgEntry: "Avg. Entry (₹)",
  sl: "SL (₹)",
  slPercent: "SL %",
  tsl: "TSL (₹)",
  cmp: "CMP (₹)",
  initialQty: "Initial Qty",
  positionSize: "Pos. Size",
  allocation: "Allocation (%)",
  openQty: "Open Qty",
  exitedQty: "Exited Qty",
  avgExitPrice: "Avg. Exit (₹)",
  stockMove: "Stock Move (%)",
  openHeat: "Open Heat (%)",
  rewardRisk: "R:R",
  holdingDays: "Holding Days",
  positionStatus: "Status",
  realisedAmount: "Realized Amount",
  plRs: "Realized P/L (₹)",
  pfImpact: "PF Impact (%)",
  cummPf: "Cumm. PF (%)",
  planFollowed: "Plan Followed",
  exitTrigger: "Exit Trigger",
  proficiencyGrowthAreas: "Growth Areas",
  chartAttachments: "Charts",
  actions: "Actions",
  unrealizedPL: "Unrealized P/L",
  notes: "Notes",
};

export const TerminologyProvider: React.FC<{
  children: React.ReactNode;
  // NEW: Accept pre-loaded data from AppInitializer
  initialTerminology?: string | null;
}> = ({ children, initialTerminology }) => {
  // Initialize with pre-loaded data or default
  const getInitialTerminology = (): TerminologyType => {
    if (initialTerminology && (initialTerminology === 'pyramid' || initialTerminology === 'buysell')) {
      return initialTerminology as TerminologyType;
    }
    return 'pyramid';
  };

  const [terminology, setTerminologyState] = useState<TerminologyType>(getInitialTerminology());
  const [isLoading, setIsLoading] = useState(!initialTerminology);

  // Only load from Supabase if no pre-loaded data was provided
  useEffect(() => {
    if (initialTerminology !== undefined) {
      // We have pre-loaded data, no need to fetch
      setIsLoading(false);
      console.log('📋 Using pre-loaded terminology:', initialTerminology || 'pyramid');
      return;
    }

    // Fallback: load terminology preference with coordinated DataLoaderService
    const loadTerminology = async () => {
      try {
        // Use SupabaseService directly (it handles deduplication via executeWithLock)
        let savedTerminology = await SupabaseService.getMiscData('terminology_preference');

        // If not found in Supabase, try localStorage as fallback
        if (!savedTerminology) {
          savedTerminology = localStorage.getItem('terminology_preference');
        }

        // Validate and set the terminology
        if (savedTerminology && (savedTerminology === 'pyramid' || savedTerminology === 'buysell')) {
          setTerminologyState(savedTerminology);

          // If we got it from localStorage, sync to Supabase
          if (localStorage.getItem('terminology_preference') === savedTerminology) {
            try {
              await SupabaseService.setMiscData('terminology_preference', savedTerminology);
            } catch (syncError) {
              console.warn('Failed to sync terminology to Supabase:', syncError);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to load terminology preference, using default:', error);

        // Final fallback to localStorage only
        try {
          const localTerminology = localStorage.getItem('terminology_preference');
          if (localTerminology && (localTerminology === 'pyramid' || localTerminology === 'buysell')) {
            setTerminologyState(localTerminology as TerminologyType);
          }
        } catch (localError) {
          console.error('Failed to load from localStorage:', localError);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTerminology();
  }, [initialTerminology]);

  // Save terminology preference with dual persistence
  const setTerminology = async (type: TerminologyType) => {
    try {
      // Update state immediately for responsive UI
      setTerminologyState(type);

      // Save to localStorage immediately (synchronous)
      localStorage.setItem('terminology_preference', type);

      // Save to Supabase (asynchronous)
      await SupabaseService.setMiscData('terminology_preference', type);

      console.log(`Terminology preference saved: ${type}`);
    } catch (error) {
      console.error('Failed to save terminology preference to Supabase:', error);

      // Ensure localStorage is still updated even if Supabase fails
      try {
        localStorage.setItem('terminology_preference', type);
        console.log(`Terminology preference saved to localStorage: ${type}`);
      } catch (localError) {
        console.error('Failed to save to localStorage:', localError);
      }
    }
  };

  // Get column label based on current terminology
  const getColumnLabel = (key: string): string => {
    const terminologyLabels = COLUMN_LABELS[terminology];
    return terminologyLabels[key] || DEFAULT_LABELS[key] || key;
  };

  // Debug function to check persistence status
  const debugPersistence = async () => {
    try {
      const supabaseValue = await SupabaseService.getMiscData('terminology_preference');
      const localStorageValue = localStorage.getItem('terminology_preference');
      const currentValue = terminology;

      console.log('=== Terminology Persistence Debug ===');
      console.log('Current state:', currentValue);
      console.log('Supabase value:', supabaseValue);
      console.log('localStorage value:', localStorageValue);
      console.log('All synced:', supabaseValue === localStorageValue && localStorageValue === currentValue);
      console.log('=====================================');
    } catch (error) {
      console.error('Debug persistence failed:', error);
    }
  };

  return (
    <TerminologyContext.Provider value={{
      terminology,
      setTerminology,
      getColumnLabel,
      isLoading,
      debugPersistence
    }}>
      {children}
    </TerminologyContext.Provider>
  );
};
