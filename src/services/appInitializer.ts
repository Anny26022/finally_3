import { SupabaseService } from './supabaseService';
import { AuthService } from './authService';

/**
 * Unified App Initializer Service
 * Replaces CachePreloader with coordinated, priority-based data loading
 * Eliminates race conditions and lock contention with SupabaseService
 */

export interface InitializationData {
  // Critical Tier - Must load before UI renders
  userPreferences: any | null;
  accountingMethod: string | null;
  terminology: string | null;
  globalFilter: any | null;
  
  // Secondary Tier - Loads after critical data
  recentTrades: any[] | null;
  basicAnalytics: any | null;
  
  // Background Tier - Loads after secondary data
  heavyAnalytics: any | null;
  chartData: any | null;
  taxData: any | null;
}

export interface InitializationStatus {
  phase: 'idle' | 'critical' | 'secondary' | 'background' | 'complete' | 'error';
  progress: number; // 0-100
  criticalDataReady: boolean;
  secondaryDataReady: boolean;
  backgroundDataReady: boolean;
  error: string | null;
  startTime: number;
  completionTime: number | null;
}

export class AppInitializer {
  private static initializationData: InitializationData | null = null;
  private static initializationStatus: InitializationStatus = {
    phase: 'idle',
    progress: 0,
    criticalDataReady: false,
    secondaryDataReady: false,
    backgroundDataReady: false,
    error: null,
    startTime: 0,
    completionTime: null
  };

  private static isInitializing = false;
  private static initializationPromise: Promise<InitializationData> | null = null;
  private static backgroundOperationsAborted = false;

  /**
   * Reset initialization status to default state
   * Helper method for cleaner code organization
   */
  private static resetStatus(): void {
    this.initializationStatus = {
      phase: 'idle',
      progress: 0,
      criticalDataReady: false,
      secondaryDataReady: false,
      backgroundDataReady: false,
      error: null,
      startTime: 0,
      completionTime: null
    };
  }



  /**
   * Initialize the application with priority-based data loading
   * This replaces the CachePreloader system entirely
   */
  static async initialize(): Promise<InitializationData> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing && this.initializationPromise) {
      console.log('🔄 AppInitializer already running, waiting for completion...');
      return this.initializationPromise;
    }

    // Return cached data if already initialized
    if (this.initializationData && this.initializationStatus.criticalDataReady) {
      console.log('✅ AppInitializer already complete, returning cached data');
      return this.initializationData;
    }

    this.isInitializing = true;
    this.resetStatus(); // Use helper method for cleaner code
    this.initializationStatus.startTime = performance.now();
    this.initializationStatus.phase = 'critical';

    console.log('🚀 AppInitializer starting coordinated data loading...');

    this.initializationPromise = this.performInitialization();
    
    try {
      const result = await this.initializationPromise;
      return result;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Perform the actual initialization with coordinated data loading
   */
  private static async performInitialization(): Promise<InitializationData> {
    const data: InitializationData = {
      userPreferences: null,
      accountingMethod: null,
      terminology: null,
      globalFilter: null,
      recentTrades: null,
      basicAnalytics: null,
      heavyAnalytics: null,
      chartData: null,
      taxData: null
    };

    try {
      // CRITICAL TIER - Must complete before UI renders
      // Load critical data in parallel for maximum performance
      await this.loadCriticalData(data);
      this.initializationStatus.criticalDataReady = true;
      this.initializationStatus.progress = 100; // UI is now usable - 100% complete for user experience
      this.initializationStatus.phase = 'complete';
      this.initializationStatus.completionTime = performance.now();
      this.initializationData = data;

      const totalTime = this.initializationStatus.completionTime - this.initializationStatus.startTime;
      console.log(`✅ AppInitializer completed in ${Math.round(totalTime)}ms - UI ready`);

      // SECONDARY & BACKGROUND TIER - Start loading asynchronously without blocking
      // This runs in the background after critical data is ready and UI has rendered
      setTimeout(() => {
        // Check if operations were aborted (e.g., user logged out)
        if (!this.backgroundOperationsAborted) {
          this.loadNonCriticalData(data);
        }
      }, 0); // Next event loop to ensure React has rendered

      return data;

    } catch (error) {
      this.initializationStatus.phase = 'error';
      this.initializationStatus.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ AppInitializer failed:', error);

      // CRITICAL BUG FIX: Re-throw error instead of returning partial data
      // This ensures useAppInitializer hook receives the rejection and shows error screen
      throw error;
    }
  }

  /**
   * Load critical data that must be available before UI renders
   * Uses parallel loading for maximum performance (2-4x faster)
   */
  private static async loadCriticalData(data: InitializationData): Promise<void> {
    console.log('🔄 Loading critical data in parallel...');
    this.initializationStatus.phase = 'critical';

    const userId = await AuthService.getUserId();
    if (!userId) {
      console.error('❌ User not authenticated - cannot load critical data');
      throw new Error('Authentication required: User must be logged in to initialize application');
    }

    // CRITICAL BUG FIX: Use Promise.allSettled to prevent early failure
    // This allows partial success instead of complete failure when one request fails
    const criticalDataPromises = [
      SupabaseService.getUserPreferences(),
      SupabaseService.getMiscData('accountingMethod'),
      SupabaseService.getMiscData('terminology_preference'),
      SupabaseService.getMiscData('globalFilter')
    ];

    console.log('📋 Loading all critical data in parallel...');
    const results = await Promise.allSettled(criticalDataPromises);

    // Process results with proper error handling for each piece of critical data
    const [userPrefsResult, accountingMethodResult, terminologyResult, globalFilterResult] = results;

    // Handle user preferences (truly essential - hard error if fails)
    if (userPrefsResult.status === 'fulfilled') {
      data.userPreferences = userPrefsResult.value;
    } else {
      console.error('❌ Failed to load user preferences:', userPrefsResult.reason);
      // User preferences are essential - throw hard error
      throw new Error(`Critical failure: Unable to load user preferences - ${userPrefsResult.reason?.message || 'Unknown error'}`);
    }

    // Handle accounting method (less critical - use default if fails)
    if (accountingMethodResult.status === 'fulfilled') {
      data.accountingMethod = accountingMethodResult.value;
    } else {
      console.warn('⚠️ Failed to load accounting method, using default:', accountingMethodResult.reason);
      data.accountingMethod = 'cash'; // Safe default
    }

    // Handle terminology (less critical - use default if fails)
    if (terminologyResult.status === 'fulfilled') {
      data.terminology = terminologyResult.value;
    } else {
      console.warn('⚠️ Failed to load terminology, using default:', terminologyResult.reason);
      data.terminology = 'pyramid'; // Safe default
    }

    // Handle global filter (less critical - use default if fails)
    if (globalFilterResult.status === 'fulfilled') {
      data.globalFilter = globalFilterResult.value;
    } else {
      console.warn('⚠️ Failed to load global filter, using default:', globalFilterResult.reason);
      data.globalFilter = { type: 'all' }; // Safe default
    }

    console.log('✅ Critical data loading complete (parallel with graceful fallbacks)');
  }

  /**
   * Load non-critical data asynchronously without blocking UI
   * PERFORMANCE OPTIMIZED: All non-critical data loads in parallel for maximum efficiency
   */
  private static async loadNonCriticalData(data: InitializationData): Promise<void> {
    // Check if operations were aborted before starting
    if (this.backgroundOperationsAborted) {
      console.log('🛑 Background operations aborted - skipping non-critical data loading');
      return;
    }

    console.log('🔄 Loading all non-critical data in parallel (after UI render)...');
    this.initializationStatus.phase = 'secondary';

    try {
      // PERFORMANCE OPTIMIZATION: Combine all non-critical tasks into single batch
      // This eliminates sequential delay between secondary and background tasks
      const nonCriticalTasks = [
        // Secondary tier (more important background data)
        this.loadRecentTrades(data),
        this.loadBasicAnalytics(data),
        // Background tier (less critical data)
        this.loadHeavyAnalytics(data),
        this.loadChartData(data),
        this.loadTaxData(data)
      ];

      // Execute all non-critical data loading in parallel for maximum performance
      await Promise.allSettled(nonCriticalTasks);

      // Check again if operations were aborted during loading
      if (this.backgroundOperationsAborted) {
        console.log('🛑 Background operations aborted during loading');
        return;
      }

      // Update status flags - all non-critical data is now complete
      this.initializationStatus.secondaryDataReady = true;
      this.initializationStatus.backgroundDataReady = true;
      this.initializationStatus.phase = 'background';
      console.log('✅ All non-critical data loading complete (parallel execution)');

    } catch (error) {
      console.warn('⚠️ Non-critical data loading encountered errors:', error);
      // Silent failure for non-critical data - doesn't affect UI functionality
    }
  }

  /**
   * Load recent trades for immediate display
   */
  private static async loadRecentTrades(data: InitializationData): Promise<void> {
    try {
      // Check if operations were aborted
      if (this.backgroundOperationsAborted) return;

      console.log('📊 Loading recent trades...');
      const result = await SupabaseService.getTradesWithSmartLoading({
        pageSize: 50,
        maxResults: 100
      });
      data.recentTrades = result.trades;
    } catch (error) {
      // Check if error is due to authentication (user logged out)
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.log('👤 User logged out during trades loading - aborting');
        this.backgroundOperationsAborted = true;
        return;
      }
      console.warn('⚠️ Failed to load recent trades:', error);
      data.recentTrades = [];
    }
  }

  /**
   * Load basic analytics data
   */
  private static async loadBasicAnalytics(data: InitializationData): Promise<void> {
    try {
      // Check if operations were aborted
      if (this.backgroundOperationsAborted) return;

      console.log('📈 Loading basic analytics...');
      const currentYear = new Date().getFullYear();
      const portfolioData = await SupabaseService.getPortfolioData(currentYear);
      data.basicAnalytics = portfolioData;
    } catch (error) {
      // Check if error is due to authentication (user logged out)
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.log('👤 User logged out during analytics loading - aborting');
        this.backgroundOperationsAborted = true;
        return;
      }
      console.warn('⚠️ Failed to load basic analytics:', error);
      data.basicAnalytics = null;
    }
  }

  /**
   * Load heavy analytics data in background
   */
  private static async loadHeavyAnalytics(data: InitializationData): Promise<void> {
    try {
      console.log('📊 Loading heavy analytics...');
      const analyticsData = await SupabaseService.getAnalyticsData('performance');
      data.heavyAnalytics = analyticsData;
    } catch (error) {
      console.warn('⚠️ Failed to load heavy analytics:', error);
      data.heavyAnalytics = null;
    }
  }

  /**
   * Load chart data in background
   */
  private static async loadChartData(data: InitializationData): Promise<void> {
    try {
      console.log('📈 Loading chart data...');
      const chartData = await SupabaseService.getChartViewerData();
      data.chartData = chartData;
    } catch (error) {
      console.warn('⚠️ Failed to load chart data:', error);
      data.chartData = null;
    }
  }

  /**
   * Load tax data in background
   */
  private static async loadTaxData(data: InitializationData): Promise<void> {
    try {
      console.log('💰 Loading tax data...');
      const taxData = await SupabaseService.getMiscData('taxData');
      data.taxData = taxData;
    } catch (error) {
      console.warn('⚠️ Failed to load tax data:', error);
      data.taxData = null;
    }
  }

  /**
   * Get current initialization status
   */
  static getStatus(): InitializationStatus {
    return { ...this.initializationStatus };
  }

  /**
   * Get initialized data (returns null if not ready)
   */
  static getData(): InitializationData | null {
    return this.initializationData;
  }

  /**
   * Check if critical data is ready for UI rendering
   */
  static isCriticalDataReady(): boolean {
    return this.initializationStatus.criticalDataReady;
  }

  /**
   * Reset the initializer (for testing or re-initialization)
   */
  static reset(): void {
    this.initializationData = null;
    this.resetStatus(); // Use helper method for consistency
    this.isInitializing = false;
    this.initializationPromise = null;
    this.backgroundOperationsAborted = false; // Reset abort flag
    console.log('🔄 AppInitializer reset');
  }

  /**
   * Abort background operations (called on logout)
   */
  static abortBackgroundOperations(): void {
    this.backgroundOperationsAborted = true;
    console.log('🛑 AppInitializer: Background operations aborted');
  }

  /**
   * Warm specific data types (for compatibility with existing code)
   */
  static async warmCache(dataTypes: string[]): Promise<void> {
    if (!this.initializationData) {
      console.warn('⚠️ AppInitializer not initialized, cannot warm cache');
      return;
    }

    console.log('🔥 Warming cache for:', dataTypes);

    const warmingTasks = dataTypes.map(async (type) => {
      switch (type) {
        case 'trades':
          if (!this.initializationData!.recentTrades) {
            await this.loadRecentTrades(this.initializationData!);
          }
          break;
        case 'analytics':
          if (!this.initializationData!.basicAnalytics) {
            await this.loadBasicAnalytics(this.initializationData!);
          }
          break;
        case 'charts':
          if (!this.initializationData!.chartData) {
            await this.loadChartData(this.initializationData!);
          }
          break;
        case 'tax':
          if (!this.initializationData!.taxData) {
            await this.loadTaxData(this.initializationData!);
          }
          break;
        default:
          console.log(`Unknown cache type: ${type}`);
      }
    });

    await Promise.allSettled(warmingTasks);
    console.log('✅ Cache warming completed');
  }
}
