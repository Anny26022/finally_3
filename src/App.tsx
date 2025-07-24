import React, { useRef, useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { Icon } from "@iconify/react";
import { Route, Switch, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@heroui/react";
import { ThemeSwitcher } from "./components/theme-switcher";
import { useTheme } from "@heroui/use-theme";
import { TruePortfolioProvider } from "./utils/TruePortfolioContext";
import { TruePortfolioSetupManager } from "./components/TruePortfolioSetupManager";
import { ProfileSettingsModal } from "./components/ProfileSettingsModal";
import { GlobalFilterProvider } from "./context/GlobalFilterContext";
import { AccountingMethodProvider } from "./context/AccountingMethodContext";
import { TerminologyProvider } from "./context/TerminologyContext";
import { GlobalFilterBar } from "./components/GlobalFilterBar";
import { TradeTrackerLogo } from './components/icons/TradeTrackerLogo';
import { AnimatedBrandName } from './components/AnimatedBrandName';
import ErrorBoundary from "./components/ErrorBoundary";
import { Analytics } from '@vercel/analytics/react';
import { Loader } from "./components/Loader";
import ResetPasswordPage from './pages/reset-password';
import { AuthService } from './services/authService';

// WORLD-CLASS ARCHITECTURE: TanStack Query setup
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// ✅ SOLUTION 3: Optimized TanStack Query Client Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ OPTIMIZED: Better configuration for performance and UX
      staleTime: 1 * 60 * 1000,     // 1 minute (shorter for fresher data)
      gcTime: 30 * 60 * 1000,       // 30 minutes (longer cache retention)
      retry: (failureCount, error) => {
        // ✅ Smart retry logic
        if (failureCount < 3) return true;
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,    // ✅ Enable for better sync
      refetchOnMount: 'always',      // ✅ Always check for updates

      // ✅ Enable optimistic updates with placeholder data
      placeholderData: (previousData) => previousData,

      // ✅ Network mode for better offline handling
      networkMode: 'online',
    },
    mutations: {
      retry: (failureCount, error) => {
        // ✅ Retry mutations up to 2 times
        if (failureCount < 2) return true;
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Lazy load heavy components for better performance with preloading
const TradeJournal = React.lazy(() => import("./components/trade-journal"));
const TradeAnalytics = React.lazy(() => import("./components/trade-analytics").then(module => ({ default: module.TradeAnalytics })));
const TaxAnalytics = React.lazy(() => import("./components/tax-analytics").then(module => ({ default: module.TaxAnalytics })));
const MonthlyPerformanceTable = React.lazy(() => import("./pages/monthly-performance").then(module => ({ default: module.MonthlyPerformanceTable })));
const DeepAnalyticsPage = React.lazy(() => import("./pages/DeepAnalyticsPage"));

// Preload components for faster navigation
const preloadComponents = () => {
  // Preload most commonly accessed components
  import("./components/trade-analytics");
  import("./components/tax-analytics");
  import("./pages/monthly-performance");
};

// Authentication - Pure cloud-based
import { AuthProvider, useAuth, useUser } from "./context/AuthContext";
import { AuthGuard } from "./components/auth/AuthGuard";
import { SupabaseService } from "./services/supabaseService";
// ✅ REMOVED: Imperative AppInitializer conflicts with TanStack Query
// import { AppInitializer } from "./services/appInitializer";
// import { useAppInitializer } from "./hooks/useAppInitializer";
// import { AuthDebug } from "./components/debug/AuthDebug";
import { AuthModal } from "./components/auth/AuthModal";
import { AuthCallback } from "./pages/AuthCallback";
import { GapDownAnalysisWrapper } from "./components/GapDownAnalysisWrapper";
// Pure cloud-based architecture with Supabase

// Main App Content Component (authenticated users only)
function AppContent() {
  const location = useLocation();
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [userName, setUserName] = React.useState('');
  const [loadingPrefs, setLoadingPrefs] = React.useState(true);
  const [isFullWidthEnabled, setIsFullWidthEnabled] = React.useState(false);
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  const mainContentRef = useRef<HTMLElement>(null);
  const [isMainContentFullscreen, setIsMainContentFullscreen] = useState(false);

  const getDefaultUserName = () => {
    // Use user's name from auth or fallback
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  // Helper function to get only the first name
  const getFirstName = (fullName: string) => {
    if (!fullName) return 'User';
    return fullName.split(' ')[0];
  };

  // Migration check removed - app is now purely cloud-based

  // Memoize Supabase helper functions to prevent re-creation on every render
  const fetchUserPreferences = useCallback(async () => {
    try {
      const prefs = await SupabaseService.getUserPreferences();
      return prefs;
    } catch (error) {
      return null;
    }
  }, []);

  const saveUserPreferences = useCallback(async (prefs: Partial<{ is_mobile_menu_open: boolean; is_profile_open: boolean; user_name: string; is_full_width_enabled: boolean }>) => {
    try {
      const existing = await fetchUserPreferences() || {};
      const updated = { ...existing, ...prefs };
      await SupabaseService.saveUserPreferences(updated);
    } catch (error) {
      // Debug logging removed for production
    }
  }, [fetchUserPreferences]);

  React.useEffect(() => {
    // Load preferences from Supabase on mount
    const loadPreferences = async () => {
      try {
        const prefs = await fetchUserPreferences();
        if (prefs) {
          setIsMobileMenuOpen(!!prefs.is_mobile_menu_open);
          // CRITICAL FIX: Don't auto-open profile modal on refresh
          // Only load profile open state if it was explicitly saved as open
          // setIsProfileOpen(!!prefs.is_profile_open); // REMOVED - causes modal to open on every refresh
          setUserName(prefs.user_name || getDefaultUserName());
          setIsFullWidthEnabled(!!prefs.is_full_width_enabled);
        } else {
          // Set default values for new users
          setUserName(getDefaultUserName());
        }
      } catch (error) {
        // Set default values on error
        setUserName(getDefaultUserName());
      } finally {
        setLoadingPrefs(false);
      }
    };

    if (user) {
      loadPreferences();
    }
  }, [fetchUserPreferences, user]);

  React.useEffect(() => {
    if (!loadingPrefs) {
      saveUserPreferences({ is_mobile_menu_open: isMobileMenuOpen });
    }
  }, [isMobileMenuOpen, loadingPrefs, saveUserPreferences]);

  // CRITICAL FIX: Don't save profile open state to prevent auto-opening on refresh
  // The profile modal should only be opened by user action, not persisted
  // React.useEffect(() => {
  //   if (!loadingPrefs) {
  //     saveUserPreferences({ is_profile_open: isProfileOpen });
  //   }
  // }, [isProfileOpen, loadingPrefs, saveUserPreferences]);

  React.useEffect(() => {
    if (!loadingPrefs) {
      saveUserPreferences({ user_name: userName });
    }
  }, [userName, loadingPrefs, saveUserPreferences]);

  React.useEffect(() => {
    if (!loadingPrefs) {
      // Use immediate save for critical layout preferences
      SupabaseService.saveUserPreferencesImmediate({ is_full_width_enabled: isFullWidthEnabled })
        .then((success) => {
          if (!success) {
            // Fallback to regular debounced save
            saveUserPreferences({ is_full_width_enabled: isFullWidthEnabled });
          }
        })
        .catch(() => {
          // Fallback to regular debounced save
          saveUserPreferences({ is_full_width_enabled: isFullWidthEnabled });
        });
    }
  }, [isFullWidthEnabled, loadingPrefs, saveUserPreferences]);

  const handleToggleMainContentFullscreen = () => {
    if (!document.fullscreenElement) {
      mainContentRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMainContentFullscreen(document.fullscreenElement === mainContentRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // CRITICAL FIX: Initialize AuthService with JWT caching to prevent 2.8M+ auth calls
  React.useEffect(() => {
    AuthService.initialize().catch(error => {
      console.error('Failed to initialize AuthService:', error);
    });
  }, []);

  // PERFORMANCE OPTIMIZATION: Preload components and cache after initial render
  React.useEffect(() => {
    // Preload components after a short delay to not block initial render
    const timer = setTimeout(() => {
      preloadComponents();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // ✅ ENTERPRISE-GRADE: Let TanStack Query handle all data loading declaratively
  // No manual initialization needed - components declare what they need
  // const { data: initializationData, isLoading: isInitializing } = useAppInitializer(user?.id);

  // Memoize navigation items to prevent unnecessary re-renders
  const navItems = useMemo(() => [
    { path: "/", name: "Journal", icon: "lucide:book-open" },
    { path: "/analytics", name: "Analytics", icon: "lucide:bar-chart-2" },
    { path: "/tax-analytics", name: "Tax Analytics", icon: "lucide:calculator" },
    { path: "/monthly-performance", name: "Monthly Performance", icon: "lucide:calendar-check" },
    { path: "/deep-analytics", name: "Deep Analytics", icon: "lucide:pie-chart" }
  ], []);



  // ✅ ENTERPRISE-GRADE: Error handling now managed by individual TanStack Query hooks
  // Each component handles its own loading and error states declaratively

  // ✅ ENTERPRISE-GRADE: No global loading screen needed
  // Individual components handle their own loading states with TanStack Query

  return (
    <QueryClientProvider client={queryClient}>
      <TruePortfolioProvider>
        <AccountingMethodProvider initialAccountingMethod={null}>
          <TerminologyProvider initialTerminology={null}>
            <GlobalFilterProvider initialGlobalFilter={null}>
            <div className="min-h-screen bg-background font-sans antialiased">
          {/* Navigation */}
          <header className="sticky top-0 z-40 w-full border-b border-gray-200 dark:border-gray-700 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
            <nav className="px-4 sm:px-6">
              <div className="flex h-16 items-center justify-between">
                {/* Logo and Mobile Menu Button */}
                <div className="flex items-center gap-4">
                  <Link
                    to="/"
                    className="flex items-center gap-2 font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-foreground"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Outer circle */}
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                      />
                      {/* Diamond/gem shape */}
                      <path
                        d="M12 6L16 10L12 18L8 10L12 6Z"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        strokeLinejoin="round"
                      />
                      {/* Inner diamond lines */}
                      <path
                        d="M8 10L12 14L16 10"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        fill="none"
                        opacity="0.7"
                      />
                    </svg>
                    <AnimatedBrandName className="text-foreground" />
                  </Link>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="sm:hidden"
                  >
                    <Icon icon={isMobileMenuOpen ? "lucide:x" : "lucide:menu"} className="h-5 w-5" />
                  </Button>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden sm:flex sm:items-center sm:gap-8">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onMouseEnter={() => {
                          // ✅ ENTERPRISE-GRADE: TanStack Query handles preloading automatically
                          // No manual cache warming needed - declarative approach is superior
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg
                          ${isActive
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 backdrop-blur-md shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300'
                          }`}
                      >
                        <Icon icon={item.icon} className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                  <ThemeSwitcher />
                  {user ? (
                    <>
                      <Button
                        variant="flat"
                        size="sm"
                        onPress={() => setIsProfileOpen(true)}
                        className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 min-h-0 min-w-0 shadow-sm"
                        startContent={<Icon icon="lucide:user" className="h-4 w-4" />}
                      >
                        <span className="font-medium text-sm leading-none">{getFirstName(userName)}</span>
                      </Button>
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        onPress={signOut}
                        className="hidden sm:flex hover:bg-red-100 dark:hover:bg-red-900/20 transition-all duration-300"
                      >
                        <Icon icon="lucide:log-out" className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="flat"
                      size="sm"
                      onPress={() => setShowAuthModal(true)}
                      className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 min-h-0 min-w-0 shadow-sm"
                      startContent={<Icon icon="lucide:log-in" className="h-4 w-4" />}
                    >
                      <span className="font-medium text-sm leading-none">Sign In</span>
                    </Button>
                  )}
                </div>
              </div>
            </nav>

            {/* Mobile Navigation */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="sm:hidden border-t border-divider overflow-hidden"
                >
                  <div className="space-y-1 px-4 py-3 bg-background/30 backdrop-blur-xl">
                    {navItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onTouchStart={() => {
                            // ✅ ENTERPRISE-GRADE: TanStack Query handles preloading automatically
                            // No manual cache warming needed - declarative approach is superior
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg
                          ${isActive
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 backdrop-blur-md shadow-md'
                            : 'text-gray-700 dark:text-gray-300 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300'
                          }`}
                        >
                          <Icon icon={item.icon} className="h-4 w-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                    {user ? (
                      <>
                        {/* Profile Button for Mobile */}
                        <Button
                          variant="light"
                          size="sm"
                          onPress={() => {
                            setIsProfileOpen(true);
                            setIsMobileMenuOpen(false); // Close mobile menu when opening profile
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-700 dark:text-gray-300 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300"
                          startContent={<Icon icon="lucide:user" className="h-4 w-4" />}
                        >
                          <span>{getFirstName(userName) || 'Profile'}</span>
                        </Button>
                        {/* Sign Out Button for Mobile */}
                        <Button
                          isIconOnly
                          variant="light"
                          size="sm"
                          onPress={() => {
                            signOut();
                            setIsMobileMenuOpen(false);
                          }}
                          className="flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all duration-300"
                        >
                          <Icon icon="lucide:log-out" className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="light"
                        size="sm"
                        onPress={() => {
                          setShowAuthModal(true);
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-700 dark:text-gray-300 hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800/50 backdrop-blur-sm transition-all duration-300"
                        startContent={<Icon icon="lucide:log-in" className="h-4 w-4" />}
                      >
                        <span>Sign In</span>
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </header>

          {/* Global Filter Bar */}
          <GlobalFilterBar />

          {/* Main Content */}
          <main ref={mainContentRef} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <ErrorBoundary>
              <div className={isFullWidthEnabled ? "py-6" : "max-w-7xl mx-auto py-6"}>
                <Suspense fallback={<Loader />}>
                  <Switch>
                    <Route path="/auth/callback">
                      <AuthCallback />
                    </Route>
                    <Route path="/analytics">
                      <TradeAnalytics />
                    </Route>
                    <Route exact path="/" render={(props) => (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <TradeJournal {...props} toggleFullscreen={handleToggleMainContentFullscreen} isFullscreen={isMainContentFullscreen} />
                      </motion.div>
                    )} />
                    <Route path="/tax-analytics" component={TaxAnalytics} />
                    <Route path="/monthly-performance" component={MonthlyPerformanceTable} />
                    <Route path="/deep-analytics" component={DeepAnalyticsPage} />
                    <Route path="/reset-password" component={ResetPasswordPage} />
                  </Switch>
                </Suspense>
              </div>
            </ErrorBoundary>

            {/* Gap Down Analysis - positioned inside providers */}
            <GapDownAnalysisWrapper />
          </main>

          <ProfileSettingsModal
            isOpen={isProfileOpen}
            onOpenChange={setIsProfileOpen}
            userName={userName}
            setUserName={setUserName}
            isFullWidthEnabled={isFullWidthEnabled}
            setIsFullWidthEnabled={setIsFullWidthEnabled}
          />

          {/* Only show TruePortfolio setup for authenticated users */}
          {user && (
            <TruePortfolioSetupManager
              userName={userName}
              setUserName={setUserName}
            />
          )}

          {/* Migration removed - app is now purely cloud-based */}

          <Analytics />
          {/* <AuthDebug /> */}

          {/* Auth Modal for Guest Users */}
          {showAuthModal && (
            <AuthModal
              isOpen={showAuthModal}
              onClose={() => setShowAuthModal(false)}
            />
          )}
          </div>
          </GlobalFilterProvider>
        </TerminologyProvider>
      </AccountingMethodProvider>
    </TruePortfolioProvider>
    <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// Maintenance Mode Component
function MaintenanceMode() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
            <Icon icon="lucide:wrench" className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Under Maintenance
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            We're currently performing maintenance to improve your experience.
            We'll be back soon!
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-500">
          
        </div>
      </div>
    </div>
  );
}

// Main App Component with Authentication
export default function App() {
  // Set to true to enable maintenance mode
  const isMaintenanceMode = false;

  if (isMaintenanceMode) {
    return <MaintenanceMode />;
  }

  return (
    <AuthProvider>
      <AuthGuard>
        <AppContent />
      </AuthGuard>
    </AuthProvider>
  );
}
