import { Trade } from '../types/trade';
import { SupabaseService } from './supabaseService';
import { v4 as uuidv4 } from 'uuid';

/**
 * WORLD-CLASS TRADE SERVICE
 * 
 * Pure service functions for TanStack Query:
 * - No state management
 * - Simple async functions
 * - Proper error handling
 * - Optimized for caching
 */

/**
 * GET TRADES: ENTERPRISE-SCALE fetch with performance optimizations
 * ✅ STABLE FUNCTION: No parameters, stable reference for TanStack Query deduplication
 */
export async function getTrades(): Promise<Trade[]> {
  try {
    const startTime = performance.now();
    console.log('🚀 [tradeService] STABLE queryFn - Starting enterprise-scale trade loading...');

    // INTELLIGENT LOADING: Let smart loading automatically determine optimal strategy
    const result = await SupabaseService.getTradesWithSmartLoading();

    const loadTime = performance.now() - startTime;
    console.log(`✅ [tradeService] Loaded ${result.trades?.length || 0} trades in ${loadTime.toFixed(2)}ms using ${result.strategy} strategy`);
    console.log(`🎯 [tradeService] STABLE queryFn executed - TanStack Query will cache and deduplicate this`);

    // PERFORMANCE OPTIMIZATION: Skip pre-sorting to improve load times
    // Sorting is handled by the UI components when needed
    const trades = result.trades || [];

    return trades;
  } catch (error) {
    console.error('❌ Failed to fetch trades:', error);
    throw new Error('Failed to fetch trades');
  }
}

/**
 * SAVE TRADE: Create or update a trade
 */
export async function saveTrade(trade: Trade): Promise<Trade> {
  try {
    // Validate trade data
    if (!trade.id) {
      throw new Error('Trade must have an ID');
    }
    
    if (!trade.date) {
      throw new Error('Trade must have a date');
    }

    // Handle chart attachments if present
    if (trade.chartAttachments) {
      if (trade.chartAttachments.beforeEntry?.storage === 'blob' && trade.chartAttachments.beforeEntry.blobId) {
        await SupabaseService.updateChartImageBlobTradeId(trade.chartAttachments.beforeEntry.blobId, trade.id);
      }
      if (trade.chartAttachments.afterExit?.storage === 'blob' && trade.chartAttachments.afterExit.blobId) {
        await SupabaseService.updateChartImageBlobTradeId(trade.chartAttachments.afterExit.blobId, trade.id);
      }
    }

    // Save to database
    const success = await SupabaseService.saveTrade(trade);
    if (!success) {
      throw new Error('Failed to save trade to database');
    }

    return trade;
  } catch (error) {
    console.error('❌ Failed to save trade:', error);
    throw error;
  }
}

/**
 * DELETE TRADE: Remove a trade and its associated data
 */
export async function deleteTrade(tradeId: string): Promise<void> {
  try {
    if (!tradeId) {
      throw new Error('Trade ID is required');
    }

    // Extract original trade ID (handle cash basis expanded IDs)
    const originalTradeId = tradeId.includes('_exit_') ? tradeId.split('_exit_')[0] : tradeId;

    // Delete associated chart images
    try {
      const { ChartImageService } = await import('./chartImageService');
      await ChartImageService.deleteTradeChartImages(originalTradeId);
    } catch (error) {
      console.warn('⚠️ Failed to delete chart images:', error);
      // Continue with trade deletion even if chart deletion fails
    }

    // Delete from database
    const success = await SupabaseService.deleteTrade(originalTradeId);
    if (!success) {
      throw new Error('Failed to delete trade from database');
    }
  } catch (error) {
    console.error('❌ Failed to delete trade:', error);
    throw error;
  }
}

/**
 * BULK IMPORT TRADES: Import multiple trades efficiently
 */
export async function bulkImportTrades(trades: Trade[]): Promise<Trade[]> {
  try {
    if (!trades || trades.length === 0) {
      return [];
    }

    // Validate and prepare trades
    const validatedTrades = trades.map(trade => ({
      ...trade,
      id: trade.id && isValidUUID(trade.id) ? trade.id : uuidv4()
    }));

    // Use bulk import for better performance
    const success = await SupabaseService.bulkImportTrades(validatedTrades);
    if (!success) {
      throw new Error('Bulk import failed');
    }

    return validatedTrades;
  } catch (error) {
    console.error('❌ Bulk import failed:', error);
    throw error;
  }
}

/**
 * CLEAR ALL TRADES: Remove all trade data
 */
export async function clearAllTrades(): Promise<void> {
  try {
    const success = await SupabaseService.clearAllData(true);
    if (!success) {
      throw new Error('Failed to clear all trades');
    }
  } catch (error) {
    console.error('❌ Failed to clear all trades:', error);
    throw error;
  }
}

/**
 * GET TRADE SETTINGS: Fetch user preferences
 */
export async function getTradeSettings(): Promise<any> {
  try {
    return await SupabaseService.getTradeSettings();
  } catch (error) {
    console.error('❌ Failed to get trade settings:', error);
    return null;
  }
}

/**
 * SAVE TRADE SETTINGS: Save user preferences
 */
export async function saveTradeSettings(settings: any): Promise<void> {
  try {
    const success = await SupabaseService.saveTradeSettings(settings);
    if (!success) {
      throw new Error('Failed to save trade settings');
    }
  } catch (error) {
    console.error('❌ Failed to save trade settings:', error);
    throw error;
  }
}

/**
 * HELPER: Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * QUERY KEYS: For TanStack Query cache management
 */
export const queryKeys = {
  trades: {
    all: ['trades'] as const,
    lists: () => [...queryKeys.trades.all, 'list'] as const,
    list: (filters: any) => [...queryKeys.trades.lists(), { filters }] as const,
    details: () => [...queryKeys.trades.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.trades.details(), id] as const,
  },
  settings: {
    all: ['trade-settings'] as const,
  },
} as const;
