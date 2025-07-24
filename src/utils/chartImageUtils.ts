import { ChartImage } from '../types/trade';
// Removed generateId import - using uuidv4 directly
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../services/supabaseService';

// Configuration constants
export const CHART_IMAGE_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB max file size
  INLINE_THRESHOLD: 0, // PURE SUPABASE: No inline storage - all images go to Supabase

  // Enhanced compression settings for smaller file sizes
  COMPRESSION_QUALITY: 0.7, // JPEG compression quality (reduced for smaller files)
  WEBP_QUALITY: 0.65, // WebP compression quality (more aggressive)
  HIGH_COMPRESSION_QUALITY: 0.6, // For very large files
  ULTRA_COMPRESSION_QUALITY: 0.5, // For extremely large files

  // Dimension limits for different file sizes
  MAX_DIMENSION: 1920, // Reduced from 2048 for smaller files
  LARGE_FILE_MAX_DIMENSION: 1600, // For files > 1MB
  HUGE_FILE_MAX_DIMENSION: 1280, // For files > 3MB

  // Compression thresholds
  AGGRESSIVE_COMPRESSION_THRESHOLD: 300 * 1024, // 300KB - use more aggressive compression
  HIGH_COMPRESSION_THRESHOLD: 1 * 1024 * 1024, // 1MB - use high compression
  ULTRA_COMPRESSION_THRESHOLD: 3 * 1024 * 1024, // 3MB - use ultra compression

  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/webp'] as const,
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.webp'] as const,

  // Progressive JPEG for better loading experience
  PROGRESSIVE_JPEG: true,

  // Target file sizes (we'll try to achieve these)
  TARGET_SIZE_SMALL: 100 * 1024, // 100KB target for small charts
  TARGET_SIZE_MEDIUM: 200 * 1024, // 200KB target for medium charts
  TARGET_SIZE_LARGE: 400 * 1024, // 400KB target for large charts
};

// Image validation
export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export function validateImageFile(file: File): ImageValidationResult {
  const result: ImageValidationResult = { isValid: true, warnings: [] };

  // Check file size
  if (file.size > CHART_IMAGE_CONFIG.MAX_FILE_SIZE) {
    result.isValid = false;
    result.error = `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(CHART_IMAGE_CONFIG.MAX_FILE_SIZE)})`;
    return result;
  }

  // Check file type
  if (!CHART_IMAGE_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    result.isValid = false;
    result.error = `File type "${file.type}" is not supported. Allowed types: ${CHART_IMAGE_CONFIG.ALLOWED_TYPES.join(', ')}`;
    return result;
  }

  // Check file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!CHART_IMAGE_CONFIG.ALLOWED_EXTENSIONS.includes(extension as any)) {
    result.isValid = false;
    result.error = `File extension "${extension}" is not supported. Allowed extensions: ${CHART_IMAGE_CONFIG.ALLOWED_EXTENSIONS.join(', ')}`;
    return result;
  }

  // Add warnings for large files
  if (file.size > CHART_IMAGE_CONFIG.INLINE_THRESHOLD) {
    result.warnings?.push(`Large file (${formatFileSize(file.size)}) will be stored separately for better performance`);
  }

  return result;
}

// Enhanced image compression with smart format selection
export async function compressImage(file: File, maxDimension = CHART_IMAGE_CONFIG.MAX_DIMENSION, customQuality?: number): Promise<{
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  outputFormat: string;
}> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions with aggressive resizing for large files
        let { width, height } = img;

        // Determine max dimension based on file size for more aggressive compression
        let effectiveMaxDimension = maxDimension;
        if (file.size > CHART_IMAGE_CONFIG.ULTRA_COMPRESSION_THRESHOLD) {
          effectiveMaxDimension = Math.min(maxDimension, CHART_IMAGE_CONFIG.HUGE_FILE_MAX_DIMENSION); // 1280px for huge files
        } else if (file.size > CHART_IMAGE_CONFIG.HIGH_COMPRESSION_THRESHOLD) {
          effectiveMaxDimension = Math.min(maxDimension, CHART_IMAGE_CONFIG.LARGE_FILE_MAX_DIMENSION); // 1600px for large files
        }

        const needsResize = width > effectiveMaxDimension || height > effectiveMaxDimension;

        if (needsResize) {
          const ratio = Math.min(effectiveMaxDimension / width, effectiveMaxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
          console.log(`📐 Resizing image: ${img.width}x${img.height} → ${width}x${height} (${effectiveMaxDimension}px limit for ${formatFileSize(file.size)} file)`);
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Enable image smoothing for better quality
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        // Enhanced smart format and quality selection based on file size
        let outputFormat: string;
        let quality: number;

        // Determine compression level based on file size
        const isUltraLarge = file.size > CHART_IMAGE_CONFIG.ULTRA_COMPRESSION_THRESHOLD;
        const isLarge = file.size > CHART_IMAGE_CONFIG.HIGH_COMPRESSION_THRESHOLD;
        const isModerate = file.size > CHART_IMAGE_CONFIG.AGGRESSIVE_COMPRESSION_THRESHOLD;

        // Choose optimal format and quality based on file size and type
        if (file.type === 'image/png' && !hasTransparency(ctx, width, height)) {
          // Convert PNG without transparency to JPEG for much better compression
          outputFormat = 'image/jpeg';
          if (customQuality !== undefined) {
            quality = customQuality;
          } else if (isUltraLarge) {
            quality = CHART_IMAGE_CONFIG.ULTRA_COMPRESSION_QUALITY; // 0.5 for huge files
          } else if (isLarge) {
            quality = CHART_IMAGE_CONFIG.HIGH_COMPRESSION_QUALITY; // 0.6 for large files
          } else if (isModerate) {
            quality = CHART_IMAGE_CONFIG.COMPRESSION_QUALITY; // 0.7 for moderate files
          } else {
            quality = 0.8; // Higher quality for small files
          }
        } else if (file.type === 'image/png') {
          // Keep PNG for transparency but try WebP if supported
          if (supportsWebP()) {
            outputFormat = 'image/webp';
            quality = isUltraLarge ? 0.4 : isLarge ? 0.5 : CHART_IMAGE_CONFIG.WEBP_QUALITY;
          } else {
            outputFormat = 'image/png';
            quality = 1; // PNG doesn't use quality parameter
          }
        } else if (supportsWebP()) {
          // Prefer WebP for all large files due to superior compression
          outputFormat = 'image/webp';
          if (customQuality !== undefined) {
            quality = customQuality;
          } else if (isUltraLarge) {
            quality = 0.4; // Very aggressive for huge files
          } else if (isLarge) {
            quality = 0.5; // Aggressive for large files
          } else {
            quality = CHART_IMAGE_CONFIG.WEBP_QUALITY; // 0.65 for normal files
          }
        } else {
          // Default to JPEG with aggressive compression
          outputFormat = 'image/jpeg';
          if (customQuality !== undefined) {
            quality = customQuality;
          } else if (isUltraLarge) {
            quality = CHART_IMAGE_CONFIG.ULTRA_COMPRESSION_QUALITY; // 0.5
          } else if (isLarge) {
            quality = CHART_IMAGE_CONFIG.HIGH_COMPRESSION_QUALITY; // 0.6
          } else if (isModerate) {
            quality = CHART_IMAGE_CONFIG.COMPRESSION_QUALITY; // 0.7
          } else {
            quality = 0.8; // Higher quality for small files
          }
        }

        // Multi-pass compression to achieve target file sizes
        const tryCompress = (currentQuality: number, attempt: number = 1): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: outputFormat,
              lastModified: Date.now(),
            });

            // Determine target size based on original file size
            let targetSize: number;
            if (file.size > CHART_IMAGE_CONFIG.ULTRA_COMPRESSION_THRESHOLD) {
              targetSize = CHART_IMAGE_CONFIG.TARGET_SIZE_LARGE; // 400KB for huge files
            } else if (file.size > CHART_IMAGE_CONFIG.HIGH_COMPRESSION_THRESHOLD) {
              targetSize = CHART_IMAGE_CONFIG.TARGET_SIZE_MEDIUM; // 200KB for large files
            } else {
              targetSize = CHART_IMAGE_CONFIG.TARGET_SIZE_SMALL; // 100KB for normal files
            }

            // If file is still too large and we can compress more, try again
            if (compressedFile.size > targetSize && currentQuality > 0.3 && attempt < 4 && outputFormat !== 'image/png') {
              const newQuality = Math.max(0.3, currentQuality - 0.15); // Reduce quality by 15%
              console.log(`🔄 File still ${formatFileSize(compressedFile.size)} (target: ${formatFileSize(targetSize)}), trying quality ${newQuality.toFixed(2)} (attempt ${attempt + 1})`);
              tryCompress(newQuality, attempt + 1);
              return;
            }

            // Success - return the compressed file
            const compressionRatio = file.size / compressedFile.size;
            console.log(`✅ Compression complete: ${formatFileSize(file.size)} → ${formatFileSize(compressedFile.size)} (${compressionRatio.toFixed(2)}x) [${outputFormat}] quality: ${currentQuality.toFixed(2)}`);

            resolve({
              compressedFile,
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressionRatio,
              outputFormat,
            });
          }, outputFormat, currentQuality);
        };

        // Start compression with initial quality
        tryCompress(quality);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Check if image has transparency (for PNG optimization)
function hasTransparency(ctx: CanvasRenderingContext2D | null, width: number, height: number): boolean {
  if (!ctx) return false;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Check alpha channel (every 4th value)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true; // Found transparency
      }
    }
    return false;
  } catch {
    return true; // Assume transparency if we can't check
  }
}

// Check WebP support
function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// Get image dimensions
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Convert file to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix to get just the base64 data
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Create chart image record
export async function createChartImage(
  file: File,
  shouldCompress: boolean = true
): Promise<{ chartImage: ChartImage; processedFile: File }> {
  const validation = validateImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  let processedFile = file;
  let compressed = false;
  let originalSize = file.size;

  // Always compress images for better storage efficiency (except very small WebP files)
  const shouldSkipCompression = !shouldCompress ||
    (file.type === 'image/webp' && file.size < 50 * 1024); // Skip only for small WebP files under 50KB

  if (!shouldSkipCompression) {
    try {
      console.log(`🔄 Starting compression for ${formatFileSize(file.size)} ${file.type} image...`);
      const compressionResult = await compressImage(file);

      // Only use compressed version if it's actually smaller
      if (compressionResult.compressedSize < file.size) {
        processedFile = compressionResult.compressedFile;
        compressed = true;
        console.log(`📸 Image optimized: ${formatFileSize(originalSize)} → ${formatFileSize(processedFile.size)} (${compressionResult.compressionRatio.toFixed(2)}x) [${compressionResult.outputFormat}]`);
      } else {
        console.log(`📸 Original file is already optimal: ${formatFileSize(file.size)}`);
      }
    } catch (error) {
      console.warn('⚠️ Image compression failed, using original:', error);
    }
  } else {
    console.log(`⏭️ Skipping compression for small ${file.type} file: ${formatFileSize(file.size)}`);
  }

  const dimensions = await getImageDimensions(processedFile);

  // PURE SUPABASE: Always use blob storage, no inline storage
  const chartImage: ChartImage = {
    id: uuidv4(), // Use UUID for chart image ID
    filename: file.name,
    mimeType: processedFile.type as any,
    size: processedFile.size,
    uploadedAt: new Date(),
    storage: 'blob', // Always use blob storage for Supabase
    dimensions,
    compressed,
    originalSize: compressed ? originalSize : undefined,
    // Always use UUID for Supabase compatibility
    blobId: uuidv4()
  };

  return { chartImage, processedFile };
}

// Utility functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getImageDataUrl(chartImage: ChartImage): string | null {
  if (chartImage.storage === 'inline' && chartImage.data) {
    return `data:${chartImage.mimeType};base64,${chartImage.data}`;
  }
  return null;
}

// Storage size calculation for trade
export function calculateChartAttachmentsSize(chartAttachments?: any): number {
  if (!chartAttachments) return 0;

  let totalSize = 0;
  if (chartAttachments.beforeEntry) {
    totalSize += chartAttachments.beforeEntry.size || 0;
  }
  if (chartAttachments.afterExit) {
    totalSize += chartAttachments.afterExit.size || 0;
  }

  return totalSize;
}

// Get compression info for display
export function getCompressionInfo(chartImage: ChartImage): {
  isCompressed: boolean;
  originalSize?: number;
  compressionRatio?: number;
  savedSpace?: number;
  compressionText?: string;
} {
  if (!chartImage.compressed || !chartImage.originalSize) {
    return { isCompressed: false };
  }

  const compressionRatio = chartImage.originalSize / chartImage.size;
  const savedSpace = chartImage.originalSize - chartImage.size;
  const savedPercentage = ((savedSpace / chartImage.originalSize) * 100).toFixed(0);

  return {
    isCompressed: true,
    originalSize: chartImage.originalSize,
    compressionRatio,
    savedSpace,
    compressionText: `${savedPercentage}% smaller (${formatFileSize(savedSpace)} saved)`
  };
}
