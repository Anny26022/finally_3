/**
 * Temporary Chart Storage Utility
 * 
 * This utility provides a seamless way to handle chart uploads for trades that don't exist yet.
 * It allows users to upload charts immediately without requiring trade data to be saved first,
 * eliminating the need for page refreshes or navigation through different pages.
 * 
 * Key Features:
 * - Upload charts before trade exists
 * - Store charts temporarily in UI state
 * - Automatically save to Supabase when trade is created
 * - No foreign key constraint issues
 * - Smooth user experience
 */

import { ChartImage, TradeChartAttachments } from '../types/trade';
import { ChartImageService } from '../services/chartImageService';

/**
 * Check if a chart image is stored temporarily
 */
export function isTemporaryChart(chartImage: ChartImage): boolean {
  return !!(chartImage as any).isTemporary;
}

/**
 * Check if chart attachments contain any temporary charts
 */
export function hasTemporaryCharts(chartAttachments?: TradeChartAttachments): boolean {
  if (!chartAttachments) return false;
  
  return (
    (chartAttachments.beforeEntry && isTemporaryChart(chartAttachments.beforeEntry)) ||
    (chartAttachments.afterExit && isTemporaryChart(chartAttachments.afterExit))
  );
}

/**
 * Save all temporary charts to Supabase after trade is created
 */
export async function saveTemporaryChartsToSupabase(
  tradeId: string,
  chartAttachments: TradeChartAttachments
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!hasTemporaryCharts(chartAttachments)) {
      return { success: true };
    }

    console.log('💾 Saving temporary charts to Supabase for trade:', tradeId);
    
    const result = await ChartImageService.saveTemporaryChartImages(tradeId, chartAttachments);
    
    if (result.success) {
      console.log('✅ All temporary charts saved successfully');
    } else {
      console.error('❌ Failed to save temporary charts:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error saving temporary charts:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create a temporary chart image for immediate UI display
 */
export function createTemporaryChartImage(
  file: File,
  chartImage: ChartImage
): ChartImage {
  return {
    ...chartImage,
    isTemporary: true,
    // Ensure we have a data URL for immediate display
    dataUrl: chartImage.data ? `data:${chartImage.mimeType};base64,${chartImage.data}` : undefined
  };
}

/**
 * Convert temporary chart to permanent chart (remove temporary flag)
 */
export function convertToPermanentChart(chartImage: ChartImage): ChartImage {
  const { isTemporary, ...permanentChart } = chartImage as any;
  return permanentChart;
}

/**
 * Get display status for chart upload
 */
export function getChartUploadStatus(chartImage?: ChartImage): {
  status: 'none' | 'temporary' | 'saved';
  message: string;
  icon: string;
} {
  if (!chartImage) {
    return {
      status: 'none',
      message: '',
      icon: 'lucide:upload'
    };
  }
  
  if (isTemporaryChart(chartImage)) {
    return {
      status: 'temporary',
      message: 'Chart uploaded (will save when trade is saved)',
      icon: 'lucide:clock'
    };
  }
  
  return {
    status: 'saved',
    message: 'Chart saved to cloud storage',
    icon: 'lucide:check-circle'
  };
}
