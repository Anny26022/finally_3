import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupabaseService } from '../services/supabaseService';

export type AccountingMethod = 'accrual' | 'cash';

interface AccountingMethodContextType {
  accountingMethod: AccountingMethod;
  setAccountingMethod: (method: AccountingMethod) => void;
  toggleAccountingMethod: () => void;
  clearAccountingMethodData: () => void;
}

const AccountingMethodContext = createContext<AccountingMethodContextType | undefined>(undefined);

interface AccountingMethodProviderProps {
  children: ReactNode;
  // NEW: Accept pre-loaded data from AppInitializer
  initialAccountingMethod?: string | null;
}

export const AccountingMethodProvider: React.FC<AccountingMethodProviderProps> = ({
  children,
  initialAccountingMethod
}) => {
  // Initialize with pre-loaded data or default
  const getInitialMethod = (): AccountingMethod => {
    if (initialAccountingMethod && (initialAccountingMethod === 'accrual' || initialAccountingMethod === 'cash')) {
      return initialAccountingMethod as AccountingMethod;
    }
    return 'cash';
  };

  const [accountingMethod, setAccountingMethodState] = useState<AccountingMethod>(getInitialMethod());
  const [isLoading, setIsLoading] = useState(!initialAccountingMethod);

  // Only load from Supabase if no pre-loaded data was provided
  useEffect(() => {
    if (initialAccountingMethod !== undefined) {
      // We have pre-loaded data, no need to fetch
      setIsLoading(false);
      console.log('📋 Using pre-loaded accounting method:', initialAccountingMethod || 'cash');
      return;
    }

    // Fallback: load from Supabase directly (SupabaseService handles deduplication)
    const loadAccountingMethod = async () => {
      try {
        const stored = await SupabaseService.getMiscData('accountingMethod');

        if (stored && (stored === 'accrual' || stored === 'cash')) {
          setAccountingMethodState(stored as AccountingMethod);
        } else {
          // If no stored preference, default to cash basis and save it
          setAccountingMethodState('cash');
          await SupabaseService.saveMiscData('accountingMethod', 'cash');
        }
      } catch (error) {
        // Even if Supabase fails, ensure we default to cash basis
        setAccountingMethodState('cash');
        console.warn('⚠️ Failed to load accounting method, using default:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountingMethod();
  }, [initialAccountingMethod]);

  // Memoized setter to prevent unnecessary re-renders
  const setAccountingMethod = React.useCallback((method: AccountingMethod) => {
    if (method === accountingMethod) return; // Prevent unnecessary updates

    // Immediate state update for responsive UI
    setAccountingMethodState(method);

    // Async Supabase update to prevent blocking
    requestIdleCallback(() => {
      SupabaseService.saveMiscData('accountingMethod', method).catch(error => {
        // Handle error silently
      });
    });
  }, [accountingMethod]);

  const toggleAccountingMethod = React.useCallback(() => {
    const newMethod = accountingMethod === 'accrual' ? 'cash' : 'accrual';
    setAccountingMethod(newMethod);
  }, [accountingMethod, setAccountingMethod]);

  const clearAccountingMethodData = React.useCallback(() => {
    try {
      localStorage.removeItem('accountingMethod');
      setAccountingMethodState('cash'); // Reset to default
      } catch (error) {
      }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    accountingMethod,
    setAccountingMethod,
    toggleAccountingMethod,
    clearAccountingMethodData
  }), [accountingMethod, setAccountingMethod, toggleAccountingMethod, clearAccountingMethodData]);

  // Always render children to prevent hook count mismatches
  return (
    <AccountingMethodContext.Provider value={contextValue}>
      {children}
    </AccountingMethodContext.Provider>
  );
};

export const useAccountingMethod = (): AccountingMethodContextType => {
  const context = useContext(AccountingMethodContext);
  if (!context) {
    throw new Error('useAccountingMethod must be used within an AccountingMethodProvider');
  }
  return context;
};
