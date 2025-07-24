import React, { useState, useCallback, useRef } from 'react';
import { Button, Card, CardBody, Progress, Tooltip, Input, Tabs, Tab } from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartImage } from '../types/trade';
import { ChartImageService } from '../services/chartImageService';
import { validateImageFile, formatFileSize, CHART_IMAGE_CONFIG, getCompressionInfo } from '../utils/chartImageUtils';

interface ChartImageUploadProps {
  tradeId: string;
  imageType: 'beforeEntry' | 'afterExit';
  currentImage?: ChartImage;
  onImageUploaded: (chartImage: ChartImage, uploadMethod?: 'file' | 'url') => void;
  onImageDeleted: () => void;
  disabled?: boolean;
  compact?: boolean;
  suggestedUploadMethod?: 'file' | 'url';
  allowTemporary?: boolean; // NEW: Allow temporary uploads for new trades
}

export const ChartImageUpload: React.FC<ChartImageUploadProps> = ({
  tradeId,
  imageType,
  currentImage,
  onImageUploaded,
  onImageDeleted,
  disabled = false,
  compact = false,
  suggestedUploadMethod,
  allowTemporary = true, // NEW: Default to allowing temporary uploads
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>(() => {
    // Use suggested method if provided, otherwise default to 'file'
    return suggestedUploadMethod || 'file';
  });
  const [tradingViewUrl, setTradingViewUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const title = imageType === 'beforeEntry' ? 'Before Entry Chart' : 'After Exit Chart';
  const icon = imageType === 'beforeEntry' ? 'lucide:trending-up' : 'lucide:trending-down';

  // Helper function to ensure chart image has dataUrl for immediate preview
  const ensureChartImageDataUrl = useCallback(async (chartImage: ChartImage): Promise<ChartImage> => {
    if (chartImage.dataUrl) {
      return chartImage; // Already has dataUrl
    }

    // For temporary charts, don't try to fetch from service (they're not in Supabase yet)
    if ((chartImage as any).isTemporary) {
      return chartImage; // Return as-is, should have been set by service
    }

    // Get dataUrl from service for saved charts
    const dataUrl = await ChartImageService.getChartImageDataUrl(chartImage);
    return {
      ...chartImage,
      dataUrl: dataUrl || undefined
    };
  }, []);

  // Auto-select suggested upload method for consistency
  React.useEffect(() => {
    if (suggestedUploadMethod && !currentImage) {
      setUploadMethod(suggestedUploadMethod);

    }
  }, [suggestedUploadMethod, currentImage, imageType]);
  
  // Load preview URL for current image
  React.useEffect(() => {
    if (currentImage) {

      // Reset image load error state when processing new image
      setImageLoadError(false);

      // If the image already has a dataUrl (temporary or loaded from database), use it directly
      if (currentImage.dataUrl) {
        setPreviewUrl(currentImage.dataUrl);
      } else if ((currentImage as any).isTemporary) {
        // For temporary images without dataUrl, show error
        setPreviewUrl(null);
        setError('Temporary chart image missing preview data');
      } else {
        // For saved images, fetch from service

        // Clear any existing error state
        setError(null);

        ChartImageService.getChartImageDataUrl(currentImage).then(url => {
          if (url) {
            // Add a small delay to ensure the data URL is fully ready
            setTimeout(() => {
              setPreviewUrl(url);
            }, 100);
          } else {
            setPreviewUrl(null);
            setError('Failed to load image from cloud storage');
          }
        }).catch(error => {
          setPreviewUrl(null);
          setError('Failed to load image preview');
        });
      }
    } else {
      setPreviewUrl(null);
    }
  }, [currentImage, imageType]);
  
  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  // Validate TradingView URL
  const isValidTradingViewUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('tradingview.com') ||
             urlObj.hostname.includes('chartimg.com') ||
             url.includes('tradingview') ||
             url.includes('chart');
    } catch {
      return false;
    }
  }, []);

  // Convert TradingView URL to direct S3 image URL
  const getTradingViewImageUrl = useCallback((url: string): string => {


    // If it's already a direct S3 image URL, return as-is
    if (url.includes('s3.tradingview.com/snapshots/')) {

      return url;
    }

    // If it's already an image URL, return as-is
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg') || url.includes('.webp')) {

      return url;
    }

    // Extract snapshot ID from various TradingView URL formats
    let snapshotId = null;

    // Pattern 1: https://www.tradingview.com/x/SNAPSHOT_ID/
    const xUrlMatch = url.match(/tradingview\.com\/x\/([a-zA-Z0-9]+)\/?/);
    if (xUrlMatch) {
      snapshotId = xUrlMatch[1];

    }

    // Pattern 2: https://www.tradingview.com/chart/SYMBOL/SNAPSHOT_ID/
    if (!snapshotId) {
      const chartUrlMatch = url.match(/tradingview\.com\/chart\/[^\/]+\/([a-zA-Z0-9]+)\/?/);
      if (chartUrlMatch) {
        snapshotId = chartUrlMatch[1];

      }
    }

    // Pattern 3: Look for snapshot ID in URL parameters
    if (!snapshotId) {
      const paramMatch = url.match(/[?&]snapshot[_-]?id=([a-zA-Z0-9]+)/i);
      if (paramMatch) {
        snapshotId = paramMatch[1];

      }
    }

    // Pattern 4: Extract any alphanumeric ID that looks like a snapshot ID (8+ chars)
    if (!snapshotId) {
      const idMatches = url.match(/[a-zA-Z0-9]{8,}/g);
      if (idMatches) {
        // Take the last match as it's likely the snapshot ID
        snapshotId = idMatches[idMatches.length - 1];

      }
    }

    // If we found a snapshot ID, construct the S3 URL
    if (snapshotId && snapshotId.length >= 8) {
      const firstLetter = snapshotId.charAt(0).toLowerCase();
      const s3Url = `https://s3.tradingview.com/snapshots/${firstLetter}/${snapshotId}.png`;

      return s3Url;
    }

    // Handle TradingView widget URLs (fallback)
    if (url.includes('tradingview.com/widgetembed/')) {
      const symbolMatch = url.match(/symbol=([^&]+)/);
      if (symbolMatch) {

        return `https://www.tradingview.com/chart/?symbol=${symbolMatch[1]}`;
      }
    }

    // For other formats, try to append image export parameters (fallback)
    const separator = url.includes('?') ? '&' : '?';
    const fallbackUrl = `${url}${separator}format=image&width=1200&height=600`;

    return fallbackUrl;
  }, []);

  const handleUrlUpload = useCallback(async () => {
    if (disabled || !tradingViewUrl.trim()) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate URL
      if (!isValidTradingViewUrl(tradingViewUrl)) {
        setError('Please enter a valid TradingView chart URL');
        return;
      }

      // Convert to image URL
      const imageUrl = getTradingViewImageUrl(tradingViewUrl);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 80));
      }, 100);

      // Debug logging removed for production

      // Try to download image from URL with fallback approaches
      let response;
      try {
        // First attempt: Direct fetch with CORS
        response = await fetch(imageUrl, {
          mode: 'cors',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (corsError) {
        // Debug logging removed for production
        throw new Error('Unable to access TradingView image. This may be due to CORS restrictions. Try uploading the image file directly instead.');
      }

      const blob = await response.blob();

      // Convert blob to file
      const filename = `tradingview-${imageType}-${Date.now()}.png`;
      const file = new File([blob], filename, { type: blob.type || 'image/png' });

      clearInterval(progressInterval);
      setUploadProgress(90);

      // Upload the downloaded file

      const result = await ChartImageService.attachChartImage(tradeId, imageType, file, true, allowTemporary);

      setUploadProgress(100);

      if (result.success && result.chartImage) {
        // Ensure the chart image has a dataUrl for immediate preview
        const chartImageWithPreview = await ensureChartImageDataUrl(result.chartImage);

        // Mark as temporary if needed
        if (result.isTemporary) {
          chartImageWithPreview.isTemporary = true;
        }

        onImageUploaded(chartImageWithPreview, 'url');
        setTradingViewUrl(''); // Clear the URL input

      } else {
        setError(result.error || 'Upload failed');
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to download from URL');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [tradeId, imageType, onImageUploaded, disabled, title, tradingViewUrl, isValidTradingViewUrl, getTradingViewImageUrl, ensureChartImageDataUrl]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      // Show warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        // Debug logging removed for production
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      // Upload image
      // Debug logging removed for production

      const result = await ChartImageService.attachChartImage(tradeId, imageType, file, true, allowTemporary);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result.success && result.chartImage) {
        // Ensure the chart image has a dataUrl for immediate preview
        const chartImageWithPreview = await ensureChartImageDataUrl(result.chartImage);

        // Mark as temporary if needed
        if (result.isTemporary) {
          chartImageWithPreview.isTemporary = true;
        }

        onImageUploaded(chartImageWithPreview, 'file');

      } else {
        setError(result.error || 'Upload failed');
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [tradeId, imageType, onImageUploaded, disabled, title, ensureChartImageDataUrl]);
  
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input value to allow re-uploading the same file
    event.target.value = '';
  }, [handleFileSelect]);
  
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);
  
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(true);
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragActive(false);
  }, []);
  
  const handleDelete = useCallback(async () => {
    if (!currentImage || disabled) return;



    try {
      const success = await ChartImageService.deleteChartImage(tradeId, imageType, currentImage);
      if (success) {
        onImageDeleted();
      } else {
        setError('Failed to delete image');
      }
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Delete failed');
    }
  }, [currentImage, tradeId, imageType, onImageDeleted, disabled, title]);
  
  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);
  
  if (compact && !currentImage) {
    return (
      <Tooltip content={`Upload ${title}`}>
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={openFileDialog}
          isDisabled={disabled}
          className="text-gray-500 hover:text-primary-500"
          aria-label={`Upload ${title}`}
        >
          <Icon icon={icon} className="w-4 h-4" />
          <input
            ref={fileInputRef}
            type="file"
            accept={CHART_IMAGE_CONFIG.ALLOWED_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
            aria-label={`Upload ${title} chart image file`}
          />
        </Button>
      </Tooltip>
    );
  }
  
  return (
    <Card className="w-full">
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon icon={icon} className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          {currentImage && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  {formatFileSize(currentImage.size)}
                </div>
                {(() => {
                  const compressionInfo = getCompressionInfo(currentImage);
                  if (compressionInfo.isCompressed && compressionInfo.compressionText) {
                    return (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Icon icon="lucide:zap" className="w-3 h-3" />
                        {compressionInfo.compressionText}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={handleDelete}
                isDisabled={disabled}
                className="text-danger-500 hover:text-danger-600"
                aria-label={`Delete ${title}`}
              >
                <Icon icon="lucide:trash-2" className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          {currentImage && previewUrl ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative group"
            >
              <div className="relative w-full h-32 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <img
                  src={previewUrl}
                  alt={title}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoadError ? 'opacity-0' : 'opacity-100'}`}
                  onError={(e) => {
                    setImageLoadError(true);
                  }}
                  onLoad={() => {
                    setImageLoadError(false);
                  }}
                />
                {/* Fallback overlay - only show when image fails to load */}
                {imageLoadError && (
                  <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                    <Icon icon="lucide:image" className="w-8 h-8 mb-2" />
                    <p className="text-xs text-center px-2">
                      Chart Image<br />
                      <span className="text-xs opacity-75">
                        {currentImage?.filename || 'Preview not available'}
                      </span>
                    </p>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <Button
                  isIconOnly
                  variant="flat"
                  size="sm"
                  onPress={() => {
                    setUploadMethod('file');
                    openFileDialog();
                  }}
                  isDisabled={disabled}
                  className="w-6 h-6 min-w-6 rounded-md bg-black/90 hover:bg-black text-white border-0 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
                  aria-label="Replace chart image"
                >
                  <Icon icon="lucide:upload" className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              {/* Upload Method Tabs */}
              {suggestedUploadMethod && imageType === 'afterExit' && (
                <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Icon icon="lucide:info" className="w-3 h-3" />
                    Auto-selected {suggestedUploadMethod === 'url' ? 'TradingView URL' : 'file upload'} method to match your "Before Entry" chart
                  </p>
                </div>
              )}
              <Tabs
                selectedKey={uploadMethod}
                onSelectionChange={(key) => setUploadMethod(key as 'file' | 'url')}
                size="sm"
                variant="underlined"
                classNames={{
                  tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                  cursor: "w-full bg-primary-500",
                  tab: "max-w-fit px-0 h-12",
                  tabContent: "group-data-[selected=true]:text-primary-500"
                }}
              >
                <Tab
                  key="file"
                  title={
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:upload" className="w-4 h-4" />
                      <span>Upload File</span>
                    </div>
                  }
                />
                <Tab
                  key="url"
                  title={
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:link" className="w-4 h-4" />
                      <span>TradingView URL</span>
                    </div>
                  }
                />
              </Tabs>

              {/* Upload Content */}
              {uploadMethod === 'file' ? (
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                    ${dragActive
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={openFileDialog}
                  role="button"
                  tabIndex={0}
                  aria-label={`Upload ${title} by dropping file or clicking`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openFileDialog();
                    }
                  }}
                >
                  {isUploading ? (
                    <div className="space-y-3">
                      <Icon icon="lucide:upload-cloud" className="w-8 h-8 mx-auto text-primary-500 animate-pulse" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                        <Progress
                          value={uploadProgress}
                          className="mt-2"
                          aria-label="File upload progress"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Icon icon="lucide:image-plus" className="w-8 h-8 mx-auto text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Drop image here or click to upload
                        </p>
                        <p className="text-xs text-gray-500">
                          PNG, JPG, WebP up to {formatFileSize(CHART_IMAGE_CONFIG.MAX_FILE_SIZE)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      label="TradingView Chart URL"
                      placeholder="https://www.tradingview.com/chart/..."
                      value={tradingViewUrl}
                      onValueChange={setTradingViewUrl}
                      variant="bordered"
                      startContent={<Icon icon="lucide:link" className="w-4 h-4 text-gray-400" />}
                      isDisabled={disabled || isUploading}
                      description="Paste your TradingView chart link here"
                    />
                  </div>

                  {isUploading ? (
                    <div className="space-y-3 text-center">
                      <Icon icon="lucide:download" className="w-8 h-8 mx-auto text-primary-500 animate-pulse" />
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Downloading from TradingView...</p>
                        <Progress
                          value={uploadProgress}
                          className="mt-2"
                          aria-label="TradingView image download progress"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center">
                      <Button
                        isIconOnly
                        variant="flat"
                        size="sm"
                        onPress={handleUrlUpload}
                        isDisabled={disabled || !tradingViewUrl.trim()}
                        className="w-6 h-6 min-w-6 rounded-lg bg-black/90 hover:bg-black text-white border-0 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Upload chart from URL"
                      >
                        <Icon icon="lucide:upload" className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-2 bg-danger-50 dark:bg-danger-950 border border-danger-200 dark:border-danger-800 rounded-lg"
          >
            <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
          </motion.div>
        )}


        
        <input
          ref={fileInputRef}
          type="file"
          accept={CHART_IMAGE_CONFIG.ALLOWED_TYPES.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          aria-label={`Upload ${title} chart image file`}
        />
      </CardBody>
    </Card>
  );
};
