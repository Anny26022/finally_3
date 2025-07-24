import React, { useState, useEffect, useCallback } from 'react';
import { SupabaseService } from '../services/supabaseService';

export interface DashboardWidget {
  id: string;
  name: string;
  isVisible: boolean;
}

const DEFAULT_DASHBOARD_CONFIG: DashboardWidget[] = [
  { id: 'portfolio-performance', name: 'Portfolio Performance', isVisible: true },
  { id: 'performance-metrics', name: 'Performance Metrics', isVisible: true },
  { id: 'trade-statistics', name: 'Trade Statistics', isVisible: true },
  { id: 'top-performers', name: 'Top Performers', isVisible: true },
];

export const useDashboardConfig = () => {
  const [dashboardConfig, setDashboardConfig] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load dashboard config from IndexedDB on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      try {
        const storedConfigRecord = await SupabaseService.getMiscData('dashboardConfig');
        if (storedConfigRecord) {
          const parsedConfig: DashboardWidget[] = storedConfigRecord;
          // Merge with default to ensure new widgets are added and old ones removed if structure changes
          const mergedConfig = DEFAULT_DASHBOARD_CONFIG.map(defaultWidget => {
            const existingWidget = parsedConfig.find(p => p.id === defaultWidget.id);
            return existingWidget ? { ...defaultWidget, isVisible: existingWidget.isVisible } : defaultWidget;
          });
          // Filter out any widgets from stored config that are no longer in default config
          const finalConfig = mergedConfig.filter(widget => DEFAULT_DASHBOARD_CONFIG.some(defaultWidget => defaultWidget.id === widget.id));
          setDashboardConfig(finalConfig);
        }
      } catch (error) {
        // Silent error handling
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Save dashboard config to IndexedDB
  useEffect(() => {
    if (!isLoading && typeof window !== 'undefined') {
      SupabaseService.saveMiscData('dashboardConfig', dashboardConfig);
    }
  }, [dashboardConfig, isLoading]);

  const toggleWidgetVisibility = useCallback((id: string) => {
    setDashboardConfig(prevConfig =>
      prevConfig.map(widget =>
        widget.id === id ? { ...widget, isVisible: !widget.isVisible } : widget
      )
    );
  }, []);

  return {
    dashboardConfig,
    toggleWidgetVisibility,
    isLoading,
  };
}; 