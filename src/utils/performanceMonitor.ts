/**
 * Performance Monitor Utility
 * Tracks and logs performance metrics for the trade journal application
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private isEnabled: boolean = true;

  constructor() {
    // Enable performance monitoring in development, but reduce noise
    this.isEnabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Start tracking a performance metric
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata
    };

    this.metrics.set(name, metric);
    // Only log start for significant operations (reduce noise)
    if (metadata?.tradeCount > 50 || name.includes('calculation')) {
      console.log(`🚀 [Performance] Started: ${name}`, metadata);
    }
  }

  /**
   * End tracking a performance metric
   */
  end(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!this.isEnabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`⚠️ [Performance] Metric not found: ${name}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    const finalMetadata = {
      ...metric.metadata,
      ...additionalMetadata
    };

    // Log performance result with color coding
    const duration = metric.duration;
    let emoji = '✅';
    let color = 'color: green';

    if (duration > 1000) {
      emoji = '🐌';
      color = 'color: red';
    } else if (duration > 500) {
      emoji = '⚠️';
      color = 'color: orange';
    }

    // Only log completion for significant operations or slow operations
    if (duration > 100 || finalMetadata?.tradeCount > 50 || name.includes('calculation')) {
      console.log(
        `${emoji} [Performance] Completed: ${name} in ${duration.toFixed(2)}ms`,
        finalMetadata
      );
    }

    // Clean up
    this.metrics.delete(name);
    return duration;
  }

  /**
   * Track a function execution time
   */
  async track<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.start(name, metadata);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const startPerformanceTracking = (name: string, metadata?: Record<string, any>) => 
  performanceMonitor.start(name, metadata);

export const endPerformanceTracking = (name: string, metadata?: Record<string, any>) => 
  performanceMonitor.end(name, metadata);

export const trackPerformance = <T>(
  name: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, any>
) => performanceMonitor.track(name, fn, metadata);
