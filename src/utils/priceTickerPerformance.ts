/**
 * Performance monitoring utilities for PriceTicker component
 * Tracks render times, memory usage, and optimization metrics
 */

interface PerformanceMetrics {
  renderTime: number;
  tickCount: number;
  memoryUsage?: number;
  timestamp: number;
}

class PriceTickerPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private renderStartTime: number = 0;
  private maxMetricsHistory = 100;

  /**
   * Start timing a render cycle
   */
  startRender(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * End timing a render cycle and record metrics
   */
  endRender(tickCount: number): void {
    const renderTime = performance.now() - this.renderStartTime;
    
    const metric: PerformanceMetrics = {
      renderTime,
      tickCount,
      timestamp: Date.now()
    };

    // Add memory usage if available
    if ('memory' in performance) {
      metric.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    this.metrics.push(metric);

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log performance warnings
    this.checkPerformanceThresholds(metric);
  }

  /**
   * Check if performance metrics exceed acceptable thresholds
   */
  private checkPerformanceThresholds(metric: PerformanceMetrics): void {
    // Warn if render time exceeds 16ms (60fps threshold)
    if (metric.renderTime > 16) {
      console.warn(`🐌 PriceTicker slow render: ${metric.renderTime.toFixed(2)}ms for ${metric.tickCount} ticks`);
    }

    // Warn if render time exceeds 33ms (30fps threshold)
    if (metric.renderTime > 33) {
      console.error(`🚨 PriceTicker critical performance: ${metric.renderTime.toFixed(2)}ms for ${metric.tickCount} ticks`);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    averageRenderTime: number;
    maxRenderTime: number;
    minRenderTime: number;
    totalRenders: number;
    recentRenders: PerformanceMetrics[];
  } {
    if (this.metrics.length === 0) {
      return {
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: 0,
        totalRenders: 0,
        recentRenders: []
      };
    }

    const renderTimes = this.metrics.map(m => m.renderTime);
    
    return {
      averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
      totalRenders: this.metrics.length,
      recentRenders: this.metrics.slice(-10) // Last 10 renders
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
  }

  /**
   * Log current performance stats to console
   */
  logStats(): void {
    const stats = this.getStats();
    console.group('📊 PriceTicker Performance Stats');
    console.log(`Average render time: ${stats.averageRenderTime.toFixed(2)}ms`);
    console.log(`Max render time: ${stats.maxRenderTime.toFixed(2)}ms`);
    console.log(`Min render time: ${stats.minRenderTime.toFixed(2)}ms`);
    console.log(`Total renders: ${stats.totalRenders}`);
    console.groupEnd();
  }
}

// Global instance for monitoring
export const priceTickerMonitor = new PriceTickerPerformanceMonitor();

/**
 * React hook for performance monitoring
 */
export const usePriceTickerPerformance = (tickCount: number) => {
  React.useEffect(() => {
    priceTickerMonitor.startRender();
    
    return () => {
      priceTickerMonitor.endRender(tickCount);
    };
  });

  return {
    getStats: () => priceTickerMonitor.getStats(),
    logStats: () => priceTickerMonitor.logStats(),
    reset: () => priceTickerMonitor.reset()
  };
};

/**
 * Performance optimization utilities
 */
export const PriceTickerOptimizations = {
  /**
   * Check if virtualization should be enabled based on tick count
   */
  shouldUseVirtualization: (tickCount: number): boolean => {
    return tickCount > 50; // Enable virtualization for more than 50 ticks
  },

  /**
   * Calculate optimal update frequency based on performance
   */
  getOptimalUpdateFrequency: (averageRenderTime: number): number => {
    if (averageRenderTime > 33) return 2000; // 2 seconds if very slow
    if (averageRenderTime > 16) return 1000; // 1 second if slow
    return 500; // 500ms if fast enough
  },

  /**
   * Memory usage check
   */
  checkMemoryUsage: (): { usage: number; warning: boolean } => {
    if ('memory' in performance) {
      const usage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
      return {
        usage,
        warning: usage > 100 // Warn if over 100MB
      };
    }
    return { usage: 0, warning: false };
  }
};
