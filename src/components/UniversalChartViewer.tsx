import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Tooltip, Select, SelectItem, Chip, Progress, Input, DatePicker } from '@heroui/react';
import { Icon } from '@iconify/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartImage } from '../types/trade';
import { formatFileSize } from '../utils/chartImageUtils';
import { SupabaseService } from '../services/supabaseService';
import { ChartImageService } from '../services/chartImageService';

interface UniversalChartViewerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialChartImage?: ChartImage | null;
  initialTradeId?: string;
  refreshTrigger?: number; // Add refresh trigger prop
}

interface ChartImageWithContext extends ChartImageBlob {
  tradeName?: string;
  tradeDate?: string;
  tradeNo?: number;
  dataUrl?: string;
  // Additional trade context for filtering
  plRs?: number;
  setup?: string;
  positionStatus?: 'Open' | 'Closed' | 'Partial';
}

type FilterType = 'all' | 'beforeEntry' | 'afterExit';
type OutcomeFilter = 'all' | 'win' | 'loss' | 'breakeven';

interface DateRange {
  start: string | null;
  end: string | null;
}

export const UniversalChartViewer: React.FC<UniversalChartViewerProps> = ({
  isOpen,
  onOpenChange,
  initialChartImage,
  initialTradeId,
  refreshTrigger,
}) => {
  const [allImages, setAllImages] = useState<ChartImageWithContext[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [setupFilter, setSetupFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [showFilters, setShowFilters] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [preloadedImages, setPreloadedImages] = useState<Map<string, string>>(new Map());
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);

  // Setup options (same as in trade modal)
  const SETUP_OPTIONS = [
    'ITB', 'Chop BO', 'IPO Base', '3/5/8', '21/50', 'Breakout', 'Pullback',
    'Reversal', 'Continuation', 'Gap Fill', 'OTB', 'Stage 2', 'ONP BO',
    'EP', 'Pivot Bo', 'Cheat', 'Flag', 'Other'
  ];

  // Get unique symbols for search
  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(allImages.map(img => img.tradeName).filter(Boolean));
    return Array.from(symbols).sort();
  }, [allImages]);

  // Get unique setups from the data
  const uniqueSetups = useMemo(() => {
    const setups = Array.from(new Set(allImages.map(img => img.setup).filter(Boolean)));
    return setups.sort();
  }, [allImages]);

  // Get filtered symbols for dropdown
  const filteredSymbols = useMemo(() => {
    if (!symbolSearch) return uniqueSymbols.slice(0, 10);
    return uniqueSymbols
      .filter(symbol => symbol.toLowerCase().includes(symbolSearch.toLowerCase()))
      .slice(0, 10);
  }, [uniqueSymbols, symbolSearch]);

  // Helper function to determine trade outcome
  const getTradeOutcome = (plRs: number | undefined, positionStatus: string | undefined): OutcomeFilter => {
    if (plRs === undefined || positionStatus === 'Open') return 'breakeven';
    if (plRs > 0) return 'win';
    if (plRs < 0) return 'loss';
    return 'breakeven';
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filter !== 'all' ||
           outcomeFilter !== 'all' ||
           setupFilter !== 'all' ||
           dateRange.start ||
           dateRange.end ||
           symbolSearch.length > 0;
  }, [filter, outcomeFilter, setupFilter, dateRange, symbolSearch]);

  // Filter images based on all active filters
  const filteredImages = useMemo(() => {
    let images = allImages;

    // Apply chart type filter (beforeEntry/afterExit)
    if (filter !== 'all') {
      images = images.filter(img => img.imageType === filter);
    }

    // Apply outcome filter (win/loss/breakeven)
    if (outcomeFilter !== 'all') {
      images = images.filter(img => {
        const outcome = getTradeOutcome(img.plRs, img.positionStatus);
        return outcome === outcomeFilter;
      });
    }

    // Apply setup filter
    if (setupFilter !== 'all') {
      images = images.filter(img => img.setup === setupFilter);
    }

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      images = images.filter(img => {
        if (!img.tradeDate) return false;
        const tradeDate = new Date(img.tradeDate);

        if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          if (tradeDate < startDate) return false;
        }

        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          if (tradeDate > endDate) return false;
        }

        return true;
      });
    }

    // Apply symbol search
    if (symbolSearch) {
      images = images.filter(img =>
        img.tradeName?.toLowerCase().includes(symbolSearch.toLowerCase())
      );
    }

    return images;
  }, [allImages, filter, outcomeFilter, setupFilter, dateRange, symbolSearch, getTradeOutcome]);

  const currentImage = filteredImages[currentIndex];

  // Load all chart images when modal opens or when refresh is triggered
  useEffect(() => {
    if (isOpen) {
      loadAllImages();
    } else {
      // Cleanup when modal closes
      preloadedImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      setPreloadedImages(new Map());
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      // Reset current index when closing
      setCurrentIndex(0);
    }
  }, [isOpen, refreshTrigger]); // Add refreshTrigger to dependencies

  // Set initial image when provided
  useEffect(() => {
    if (initialChartImage && filteredImages.length > 0) {
      const index = filteredImages.findIndex(img => img.id === initialChartImage.id);
      if (index >= 0) {
        setCurrentIndex(index);
      }
    }
  }, [initialChartImage, filteredImages]);

  // Reset current index when filter or symbol search changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [filter, symbolSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 'Escape':
          onOpenChange(false);
          break;
        case '1':
          setFilter('beforeEntry');
          break;
        case '2':
          setFilter('afterExit');
          break;
        case '0':
          setFilter('all');
          break;
        case 'w':
          setOutcomeFilter('win');
          break;
        case 'l':
          setOutcomeFilter('loss');
          break;
        case 'b':
          setOutcomeFilter('breakeven');
          break;
        case 'c':
          // Clear all filters
          setFilter('all');
          setOutcomeFilter('all');
          setSetupFilter('all');
          setDateRange({ start: null, end: null });
          setSymbolSearch('');
          break;
        case 'f':
          // Toggle filter panel
          setShowFilters(!showFilters);
          break;
        case 'F11':
        case 'F':
          // Toggle fullscreen
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          // Toggle header visibility
          setShowHeader(!showHeader);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, filteredImages.length]);

  const loadAllImages = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      // PRODUCTION-SAFE: Use paginated loading for chart viewer
      const tradesResult = await SupabaseService.getTradesWithSmartLoading({ pageSize: 100, maxResults: 500 });
      const allTrades = tradesResult.trades;

      // PURE SUPABASE: Extract chart images from trade chart attachments
      const imagesWithDataUrls: ChartImageWithContext[] = [];
      let processedCount = 0;
      const totalItems = allTrades.length;

      // Process trades and extract chart attachments
      for (let i = 0; i < allTrades.length; i++) {
        const trade = allTrades[i];
        setLoadingProgress((processedCount / totalItems) * 100);

        try {
          if (trade.chartAttachments) {
            // Process beforeEntry chart
            if (trade.chartAttachments.beforeEntry) {
              const chartImage = trade.chartAttachments.beforeEntry;

              let dataUrl = chartImage.dataUrl;

              // If no dataUrl, try to generate one (but skip temporary charts)
              if (!dataUrl && chartImage.storage === 'blob' && chartImage.blobId && !(chartImage as any).isTemporary) {
                dataUrl = await ChartImageService.getChartImageDataUrl(chartImage);
              }

              if (dataUrl) {
                const imageWithContext = {
                  id: chartImage.id,
                  tradeId: trade.id,
                  imageType: 'beforeEntry' as const,
                  filename: chartImage.filename,
                  mimeType: chartImage.mimeType,
                  size: chartImage.size,
                  data: new Blob(),
                  uploadedAt: new Date(chartImage.uploadedAt),
                  compressed: chartImage.compressed || false,
                  originalSize: chartImage.originalSize,
                  tradeName: trade.name,
                  tradeDate: trade.date,
                  tradeNo: trade.tradeNo ? Number(trade.tradeNo) : 0,
                  dataUrl,
                  // Additional trade context for filtering
                  plRs: trade.plRs,
                  setup: trade.setup,
                  positionStatus: trade.positionStatus
                };

                imagesWithDataUrls.push(imageWithContext);
              }
            }

            // Process afterExit chart
            if (trade.chartAttachments.afterExit) {
              const chartImage = trade.chartAttachments.afterExit;

              let dataUrl = chartImage.dataUrl;

              // If no dataUrl, try to generate one (but skip temporary charts)
              if (!dataUrl && chartImage.storage === 'blob' && chartImage.blobId && !(chartImage as any).isTemporary) {
                dataUrl = await ChartImageService.getChartImageDataUrl(chartImage);
              }

              if (dataUrl) {
                const imageWithContext = {
                  id: chartImage.id,
                  tradeId: trade.id,
                  imageType: 'afterExit' as const,
                  filename: chartImage.filename,
                  mimeType: chartImage.mimeType,
                  size: chartImage.size,
                  data: new Blob(),
                  uploadedAt: new Date(chartImage.uploadedAt),
                  compressed: chartImage.compressed || false,
                  originalSize: chartImage.originalSize,
                  tradeName: trade.name,
                  tradeDate: trade.date,
                  tradeNo: trade.tradeNo ? Number(trade.tradeNo) : 0,
                  dataUrl,
                  // Additional trade context for filtering
                  plRs: trade.plRs,
                  setup: trade.setup,
                  positionStatus: trade.positionStatus
                };

                imagesWithDataUrls.push(imageWithContext);

              }
            }
          }
        } catch (err) {
          // Failed to process chart attachments for trade
        }
        processedCount++;
      }

      // All chart processing is now done in the main loop above



      // Deduplicate images by ID (in case same image exists in both blob and inline storage)
      const uniqueImages = new Map<string, ChartImageWithContext>();
      imagesWithDataUrls.forEach(image => {
        if (!uniqueImages.has(image.id)) {
          uniqueImages.set(image.id, image);
        }
      });

      // Sort images: beforeEntry first, then afterExit, then by trade date
      const sortedImages = Array.from(uniqueImages.values()).sort((a, b) => {
        // First sort by image type: beforeEntry (0) comes before afterExit (1)
        const typeOrder = { beforeEntry: 0, afterExit: 1 };
        const typeComparison = typeOrder[a.imageType] - typeOrder[b.imageType];

        if (typeComparison !== 0) {
          return typeComparison;
        }

        // If same type, sort by trade date (newest first)
        const dateA = a.tradeDate ? new Date(a.tradeDate).getTime() : 0;
        const dateB = b.tradeDate ? new Date(b.tradeDate).getTime() : 0;
        return dateB - dateA;
      });

      setAllImages(sortedImages);
      setLoadingProgress(100);

      // Preload first few images
      preloadAdjacentImages(0, imagesWithDataUrls);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to load chart images: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const preloadAdjacentImages = useCallback((index: number, images: ChartImageWithContext[]) => {
    const preloadRange = 2; // Preload 2 images before and after current
    const newPreloaded = new Map(preloadedImages);

    for (let i = Math.max(0, index - preloadRange); i <= Math.min(images.length - 1, index + preloadRange); i++) {
      const img = images[i];
      if (img.dataUrl && !newPreloaded.has(img.id)) {
        newPreloaded.set(img.id, img.dataUrl);
      }
    }

    setPreloadedImages(newPreloaded);
  }, [preloadedImages]);

  const navigateNext = useCallback(() => {
    if (currentIndex < filteredImages.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      preloadAdjacentImages(newIndex, filteredImages);
      resetZoom();
    }
  }, [currentIndex, filteredImages, preloadAdjacentImages]);

  const navigatePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      preloadAdjacentImages(newIndex, filteredImages);
      resetZoom();
    }
  }, [currentIndex, filteredImages, preloadAdjacentImages]);

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      // Fullscreen error
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const downloadCurrentImage = () => {
    if (currentImage?.dataUrl) {
      const link = document.createElement('a');
      link.href = currentImage.dataUrl;
      link.download = currentImage.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getImageTypeLabel = (type: 'beforeEntry' | 'afterExit') => {
    return type === 'beforeEntry' ? 'Before Entry' : 'After Exit';
  };

  const getImageTypeIcon = (type: 'beforeEntry' | 'afterExit') => {
    return type === 'beforeEntry' ? 'lucide:trending-up' : 'lucide:trending-down';
  };

  // Symbol search helper functions
  const handleSymbolSearchChange = (value: string) => {
    setSymbolSearch(value);
    setShowSymbolDropdown(value.length > 0);
  };

  const handleSymbolSelect = (symbol: string) => {
    setSymbolSearch(symbol);
    setShowSymbolDropdown(false);
    // Find first image for this symbol
    const symbolIndex = filteredImages.findIndex(img => img.tradeName === symbol);
    if (symbolIndex >= 0) {
      setCurrentIndex(symbolIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="full"
      backdrop="blur"
      classNames={{
        base: "bg-white/95 dark:bg-gray-900/95",
        backdrop: "bg-black/60",
      }}
      hideCloseButton
    >
      <ModalContent>
        {(onClose) => (
          <>
            {/* Collapsible Header */}
            <AnimatePresence>
              {showHeader && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ModalHeader className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
              {/* Main Header Row */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {/* Current Symbol Only */}
                  {currentImage && (
                    <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      {currentImage.tradeName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Input
                      size="sm"
                      placeholder="Search..."
                      value={symbolSearch}
                      onChange={(e) => handleSymbolSearchChange(e.target.value)}
                      onFocus={() => setShowSymbolDropdown(symbolSearch.length > 0)}
                      onBlur={() => setTimeout(() => setShowSymbolDropdown(false), 200)}
                      className="w-28"
                      classNames={{
                        input: "text-xs",
                        inputWrapper: "h-7 min-h-7"
                      }}
                      startContent={<Icon icon="lucide:search" className="w-3 h-3 text-gray-400" />}
                      aria-label="Search chart symbols"
                    />

                    {/* Symbol Dropdown */}
                    {showSymbolDropdown && filteredSymbols.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-32 overflow-y-auto">
                        {filteredSymbols.map((symbol) => (
                          <div
                            key={symbol}
                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                            onMouseDown={() => handleSymbolSelect(symbol)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Select symbol ${symbol}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleSymbolSelect(symbol);
                              }
                            }}
                          >
                            {symbol}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Filter */}
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={() => setShowFilters(!showFilters)}
                    className="w-7 h-7 min-w-7 relative"
                  >
                    <Icon icon="lucide:filter" className="w-3 h-3" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center text-[10px]">
                        {[filter !== 'all', outcomeFilter !== 'all', setupFilter !== 'all', dateRange.start, dateRange.end, symbolSearch].filter(Boolean).length}
                      </span>
                    )}
                  </Button>

                  {/* Counter */}
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-center min-w-[2.5rem]">
                    {filteredImages.length > 0 ? `${currentIndex + 1}/${filteredImages.length}` : '0/0'}
                  </div>

                  {/* Navigation */}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={navigatePrevious}
                    isDisabled={currentIndex <= 0}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:chevron-left" className="w-3 h-3" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={navigateNext}
                    isDisabled={currentIndex >= filteredImages.length - 1}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:chevron-right" className="w-3 h-3" />
                  </Button>

                  {/* Zoom */}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={handleZoomOut}
                    isDisabled={zoom <= 0.5}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:zoom-out" className="w-4 h-4" />
                  </Button>
                  <div className="text-sm font-mono px-1 min-w-[2rem] text-center text-gray-600 dark:text-gray-400">
                    {Math.round(zoom * 100)}%
                  </div>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={handleZoomIn}
                    isDisabled={zoom >= 5}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:zoom-in" className="w-4 h-4" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={toggleFullscreen}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon={isFullscreen ? "lucide:minimize" : "lucide:maximize"} className="w-4 h-4" />
                  </Button>

                  {/* Actions */}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={downloadCurrentImage}
                    isDisabled={!currentImage?.dataUrl}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:download" className="w-4 h-4" />
                  </Button>

                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={() => setShowHeader(false)}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:chevron-up" className="w-3 h-3" />
                  </Button>

                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={onClose}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:x" className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Collapsible Filter Panel */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2 overflow-hidden"
                  >
                    <div className="flex justify-end flex-wrap gap-2 mr-8">
                      {/* Chart Type */}
                      <Select
                        size="sm"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as FilterType)}
                        className="w-24"
                        classNames={{
                          trigger: "h-7 min-h-7",
                          value: "text-xs"
                        }}
                        placeholder="Type"
                        aria-label="Filter by chart type"
                      >
                        <SelectItem key="all">All</SelectItem>
                        <SelectItem key="beforeEntry">Entry</SelectItem>
                        <SelectItem key="afterExit">Exit</SelectItem>
                      </Select>

                      {/* Outcome */}
                      <Select
                        size="sm"
                        value={outcomeFilter}
                        onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
                        className="w-28"
                        classNames={{
                          trigger: "h-7 min-h-7",
                          value: "text-xs"
                        }}
                        placeholder="Outcome"
                        aria-label="Filter by trade outcome"
                      >
                        <SelectItem key="all">All</SelectItem>
                        <SelectItem key="win">Win</SelectItem>
                        <SelectItem key="loss">Loss</SelectItem>
                        <SelectItem key="breakeven">Breakeven</SelectItem>
                      </Select>

                      {/* Setup */}
                      <Select
                        size="sm"
                        value={setupFilter}
                        onChange={(e) => setSetupFilter(e.target.value)}
                        className="w-28"
                        classNames={{
                          trigger: "h-7 min-h-7",
                          value: "text-xs"
                        }}
                        placeholder="Setup"
                        aria-label="Filter by trade setup"
                      >
                        <SelectItem key="all">All</SelectItem>
                        {(uniqueSetups as any).map((setup: string) =>
                          <SelectItem key={setup}>{setup}</SelectItem>
                        )}
                      </Select>

                      {/* From Date */}
                      <Input
                        type="date"
                        size="sm"
                        value={dateRange.start || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value || null }))}
                        className="w-32"
                        classNames={{
                          input: "text-xs",
                          inputWrapper: "h-7 min-h-7"
                        }}
                        placeholder="From"
                        aria-label="Filter from date"
                      />

                      {/* To Date */}
                      <Input
                        type="date"
                        size="sm"
                        value={dateRange.end || ''}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value || null }))}
                        className="w-32"
                        classNames={{
                          input: "text-xs",
                          inputWrapper: "h-7 min-h-7"
                        }}
                        placeholder="To"
                        aria-label="Filter to date"
                      />

                      {/* Clear */}
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => {
                          setFilter('all');
                          setOutcomeFilter('all');
                          setSetupFilter('all');
                          setDateRange({ start: null, end: null });
                          setSymbolSearch('');
                        }}
                        className="h-7 text-xs"
                        startContent={<Icon icon="lucide:x" className="w-3 h-3" />}
                        isDisabled={!hasActiveFilters}
                      >
                        Clear
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </ModalHeader>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsed Header Toggle */}
            {!showHeader && (
              <div className="absolute top-2 right-2 z-50">
                <Button
                  isIconOnly
                  variant="flat"
                  size="sm"
                  onPress={() => setShowHeader(true)}
                  className="w-8 h-8 bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
                  aria-label="Show header"
                >
                  <Icon icon="lucide:chevron-down" className="w-4 h-4" />
                </Button>
              </div>
            )}

            <ModalBody className="p-0 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[80vh]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="mb-6"
                  >
                    <Icon icon="lucide:loader-2" className="w-12 h-12 animate-spin text-foreground mb-4" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="text-center"
                  >
                    <p className="text-lg font-medium text-foreground mb-4 font-sans">Loading chart images...</p>
                    <Progress value={loadingProgress} className="w-64 mb-2" color="primary" />
                    <p className="text-sm text-foreground/70 font-sans">{Math.round(loadingProgress)}%</p>
                  </motion.div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-[80vh]">
                  <Icon icon="lucide:image-off" className="w-12 h-12 text-danger-500 mb-4" />
                  <p className="text-lg text-danger-600">{error}</p>
                  <Button
                    color="primary"
                    variant="light"
                    onPress={loadAllImages}
                    className="mt-4"
                    startContent={<Icon icon="lucide:refresh-cw" className="w-4 h-4" />}
                  >
                    Retry
                  </Button>
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[80vh]">
                  <Icon icon="lucide:image-off" className="w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-lg text-gray-600 dark:text-gray-400">No chart images found</p>
                  <p className="text-sm text-gray-500">Upload some chart images to get started</p>
                </div>
              ) : currentImage ? (
                <div className="relative w-full h-[80vh] bg-gray-50 dark:bg-gray-900 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentImage.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <img
                        src={currentImage.dataUrl}
                        alt={`${currentImage.tradeName} - ${getImageTypeLabel(currentImage.imageType)}`}
                        className={`max-w-none transition-transform ${
                          zoom > 1 ? 'cursor-grab' : 'cursor-zoom-in'
                        } ${isDragging ? 'cursor-grabbing' : ''}`}
                        style={{
                          transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                          maxHeight: zoom === 1 ? '100%' : 'none',
                          maxWidth: zoom === 1 ? '100%' : 'none',
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onClick={zoom === 1 ? handleZoomIn : undefined}
                        draggable={false}
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Minimal Navigation Overlay */}
                  <div className="absolute inset-y-0 left-0 flex items-center">
                    <Button
                      isIconOnly
                      variant="flat"
                      size="sm"
                      onPress={navigatePrevious}
                      isDisabled={currentIndex <= 0}
                      className="ml-2 w-7 h-7 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm rounded-full transition-all duration-200"
                      aria-label="Previous image"
                    >
                      <Icon icon="lucide:chevron-left" className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="absolute inset-y-0 right-0 flex items-center">
                    <Button
                      isIconOnly
                      variant="flat"
                      size="sm"
                      onPress={navigateNext}
                      isDisabled={currentIndex >= filteredImages.length - 1}
                      className="mr-2 w-7 h-7 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm rounded-full transition-all duration-200"
                      aria-label="Next image"
                    >
                      <Icon icon="lucide:chevron-right" className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </ModalBody>

            <ModalFooter className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
              <div className="flex justify-between items-center w-full">
                <div className="text-xs text-gray-500 flex gap-3">
                  <span>← → navigate</span>
                  <span>H header</span>
                  <span>F filters</span>
                  <span>F11 fullscreen</span>
                  {zoom > 1 && <span>• Drag to pan</span>}
                </div>

                <div className="flex items-center gap-2">
                  {currentImage && currentImage.tradeDate && (
                    <span className="text-xs text-gray-500">
                      {new Date(currentImage.tradeDate).toLocaleDateString()}
                    </span>
                  )}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={onClose}
                    className="w-7 h-7 min-w-7"
                  >
                    <Icon icon="lucide:x" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};