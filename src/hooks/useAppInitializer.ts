import { useState, useEffect } from 'react';
import { AppInitializer, InitializationData, InitializationStatus } from '../services/appInitializer';

interface UseAppInitializerResult {
  data: InitializationData | null;
  status: InitializationStatus;
  isLoading: boolean;
  isError: boolean;
  isCriticalDataReady: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * React hook for AppInitializer integration
 * Provides clean bridge between service and React components
 */
export const useAppInitializer = (userId?: string): UseAppInitializerResult => {
  const [data, setData] = useState<InitializationData | null>(null);
  const [status, setStatus] = useState<InitializationStatus>(AppInitializer.getStatus());
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);

      console.log('🚀 useAppInitializer: Starting initialization...');
      const initData = await AppInitializer.initialize();
      
      setData(initData);
      setStatus(AppInitializer.getStatus());
      console.log('✅ useAppInitializer: Initialization complete');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error';
      console.error('❌ useAppInitializer: Initialization failed:', errorMessage);
      
      setIsError(true);
      setError(errorMessage);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize when user is available - but only once per user session
  useEffect(() => {
    if (userId && !AppInitializer.isCriticalDataReady()) {
      // User is authenticated and we haven't initialized yet
      initialize();
    } else if (!userId) {
      // User logged out - reset everything
      AppInitializer.reset();
      setData(null);
      setIsError(false);
      setError(null);
      setIsLoading(false);
      console.log('🔄 useAppInitializer: Reset due to user logout');
    }
  }, [userId]);

  // Update status periodically for real-time feedback
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(AppInitializer.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const retry = () => {
    AppInitializer.reset();
    initialize();
  };

  return {
    data,
    status,
    isLoading: isLoading && !AppInitializer.isCriticalDataReady(),
    isError,
    isCriticalDataReady: AppInitializer.isCriticalDataReady(),
    error,
    retry
  };
};
