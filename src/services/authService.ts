import { supabase } from '../lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export interface SignUpData {
  email: string
  password: string
  firstName?: string
  lastName?: string
}

export interface SignInData {
  email: string
  password: string
}

/**
 * Bulletproof Authentication Service
 * ARCHITECTURAL FIXES:
 * - Single source of truth for session management
 * - Complete cache invalidation on sign-out
 * - No circular dependencies with SupabaseService
 * - Event emitter pattern for decoupling
 * - Unified state management
 */
export class AuthService {
  // UNIFIED STATE MANAGEMENT - Single source of truth
  private static _sessionData: {
    session: Session | null
    user: User | null
    userId: string | null
    lastCheck: number
  } = {
    session: null,
    user: null,
    userId: null,
    lastCheck: 0
  }

  // Configuration
  private static readonly AUTH_CACHE_DURATION = 10 * 60 * 1000 // 10 minutes
  private static readonly DEBOUNCE_DELAY = 100 // 100ms debounce

  // State management
  private static _refreshPromise: Promise<void> | null = null
  private static _isInitialized = false
  private static _authStateListenerSetup = false
  private static _debounceTimeout: NodeJS.Timeout | null = null

  // Event emitter for decoupling (replaces circular dependency)
  private static _eventListeners: Array<(event: 'signOut' | 'signIn' | 'tokenRefresh') => void> = []

  /**
   * UNIFIED SESSION REFRESH - Single source of truth for all auth state
   * This replaces the multiple cache systems with one coordinated approach
   */
  private static async _refreshSession(): Promise<void> {
    // Prevent concurrent refresh operations
    if (this._refreshPromise) {
      await this._refreshPromise;
      return;
    }

    this._refreshPromise = this._performSessionRefresh();

    try {
      await this._refreshPromise;
    } finally {
      this._refreshPromise = null;
    }
  }

  private static async _performSessionRefresh(): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.warn('⚠️ Session refresh error:', error);
        this._clearSessionData();
        return;
      }

      // Update unified session data
      this._sessionData = {
        session,
        user: session?.user || null,
        userId: session?.user?.id || null,
        lastCheck: Date.now()
      };

    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      this._clearSessionData();
    }
  }

  /**
   * Clear all session data - ensures complete cleanup
   */
  private static _clearSessionData(): void {
    this._sessionData = {
      session: null,
      user: null,
      userId: null,
      lastCheck: 0
    };
  }

  /**
   * Ensure session data is fresh by checking cache age and refreshing if needed
   * DRY HELPER: Centralizes cache validation logic used by all public methods
   */
  private static async _ensureSessionIsFresh(): Promise<void> {
    const now = Date.now();

    // Check if cached session is still valid
    if (this._sessionData.session !== null &&
        (now - this._sessionData.lastCheck) < this.AUTH_CACHE_DURATION) {
      return; // Cache is fresh, no refresh needed
    }

    // Cache is stale or empty, refresh session data
    await this._refreshSession();
  }

  /**
   * Setup auth state listener with unified state management
   */
  private static _setupAuthStateListener(): void {
    if (this._authStateListenerSetup) return;

    supabase.auth.onAuthStateChange((event, session) => {
      // Debounce rapid auth state changes
      if (this._debounceTimeout) {
        clearTimeout(this._debounceTimeout);
      }

      this._debounceTimeout = setTimeout(() => {
        // Update unified session data immediately
        this._sessionData = {
          session,
          user: session?.user || null,
          userId: session?.user?.id || null,
          lastCheck: Date.now()
        };

        // Emit events for decoupling (replaces circular dependency)
        if (event === 'SIGNED_IN') {
          this._emitEvent('signIn');
        } else if (event === 'SIGNED_OUT') {
          this._emitEvent('signOut');
        } else if (event === 'TOKEN_REFRESHED') {
          this._emitEvent('tokenRefresh');
        }

        // Clear any pending refresh promise to force fresh data
        this._refreshPromise = null;
      }, this.DEBOUNCE_DELAY);
    });

    this._authStateListenerSetup = true;
  }

  /**
   * Event emitter for decoupling from SupabaseService
   */
  private static _emitEvent(event: 'signOut' | 'signIn' | 'tokenRefresh'): void {
    this._eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('❌ Auth event listener error:', error);
      }
    });
  }

  /**
   * Subscribe to auth events (replaces circular dependency)
   */
  static onAuthEvent(listener: (event: 'signOut' | 'signIn' | 'tokenRefresh') => void): () => void {
    this._eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this._eventListeners.indexOf(listener);
      if (index > -1) {
        this._eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Initialize authentication - call this once at app startup
   */
  static async initialize(): Promise<void> {
    if (this._isInitialized) return;

    try {
      // Setup unified auth state listener
      this._setupAuthStateListener();

      // Pre-populate the unified session data
      await this._refreshSession();
      this._isInitialized = true;
      console.log('🔐 Authentication service initialized with unified state management');
    } catch (error) {
      console.error('❌ Failed to initialize authentication service:', error);
    }
  }

  /**
   * Sign up a new user with email and password
   */
  static async signUp({ email, password, firstName, lastName }: SignUpData) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || '',
          }
        }
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign in an existing user with email and password
   */
  static async signIn({ email, password }: SignInData) {
    try {
      // Debug logging removed for production performance

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Sign in error:', error.message)
        throw error
      }

      // Debug logging removed for production performance
      return { data, error: null }
    } catch (error) {
      const authError = error as AuthError
      console.error('❌ Sign in failed:', authError.message)
      return { data: null, error: authError }
    }
  }

  /**
   * Sign in with OAuth provider (Twitter, Google)
   */
  static async signInWithProvider(provider: 'twitter' | 'google') {
    try {
      // Use environment variable for redirect URL, fallback to production domain
      const redirectTo = (import.meta as any).env.VITE_OAUTH_REDIRECT_URL || 'https://www.nexusjournal.in/auth/callback';

      // For client-side OAuth, use the simple approach from documentation
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Sign out the current user - FIXED: Complete cache invalidation
   */
  static async signOut() {
    try {
      console.log('🔐 Starting logout process...')

      // CRITICAL FIX: Use 'local' scope to ensure complete logout
      const { error } = await supabase.auth.signOut({ scope: 'local' })

      if (error) {
        console.error('🔐 Logout error:', error)
        throw error
      }

      // CRITICAL BUG FIX: Complete cache invalidation
      this._clearSessionData();
      this._refreshPromise = null;

      // DECOUPLING FIX: Use event emitter instead of circular dependency
      this._emitEvent('signOut');

      console.log('🔐 Logout process completed successfully')
      return { error: null }
    } catch (error) {
      console.error('🔐 Logout process failed:', error)
      return { error: error as AuthError }
    }
  }

  /**
   * Send password reset email
   */
  static async resetPassword(email: string) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Resend email verification
   */
  static async resendVerification(email: string) {
    try {
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Check if user exists (for better error messaging)
   */
  static async checkUserExists(email: string): Promise<boolean> {
    try {
      // Try to initiate password reset - this will tell us if user exists
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      // If no error, user exists
      // If error contains "User not found", user doesn't exist
      if (error && error.message.includes('User not found')) {
        return false
      }

      return true
    } catch (error) {
      // If there's an error, assume user doesn't exist
      return false
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(updates: {
    email?: string
    firstName?: string
    lastName?: string
  }) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: updates.email,
        data: {
          first_name: updates.firstName,
          last_name: updates.lastName,
          full_name: updates.firstName && updates.lastName
            ? `${updates.firstName} ${updates.lastName}`
            : updates.firstName || updates.lastName || '',
        }
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }

  /**
   * Get current session - REFACTORED: Uses centralized cache validation
   */
  static async getCurrentSession() {
    // Ensure session is fresh using centralized helper
    await this._ensureSessionIsFresh();
    return { session: this._sessionData.session, error: null };
  }

  /**
   * Get current user - REFACTORED: Uses centralized cache validation
   */
  static async getCurrentUser() {
    // Ensure session is fresh using centralized helper
    await this._ensureSessionIsFresh();
    return { user: this._sessionData.user, error: null };
  }

  /**
   * Get user ID - REFACTORED: Uses centralized cache validation
   */
  static async getUserId(): Promise<string | null> {
    // Ensure session is fresh using centralized helper
    await this._ensureSessionIsFresh();
    return this._sessionData.userId;
  }

  /**
   * Check if user is authenticated - REFACTORED: Uses centralized cache validation
   */
  static async isAuthenticated(): Promise<boolean> {
    // Setup auth listener on first call
    this._setupAuthStateListener();

    // Ensure session is fresh using centralized helper
    await this._ensureSessionIsFresh();
    return !!this._sessionData.session;
  }

  /**
   * Listen to auth state changes - MAINTAINED: Backward compatibility
   */
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }

  /**
   * Get current session from unified state (for internal/helper use)
   * This avoids redundant calls in helper functions
   */
  static getCurrentSessionFromCache(): Session | null {
    return this._sessionData.session;
  }

  /**
   * Refresh session - SIMPLIFIED: Uses unified state management
   */
  static async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        throw error
      }

      // Force refresh of unified session data
      await this._refreshSession();

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as AuthError }
    }
  }
}

// Export auth state management utilities
export const getAuthState = async (): Promise<AuthState> => {
  try {
    // FINAL OPTIMIZATION: Single call instead of redundant getCurrentSession() + getCurrentUser()
    // getCurrentUser() ensures session is refreshed, then we get session from unified cache
    const { user } = await AuthService.getCurrentUser()

    // Get session from unified state (already refreshed by getCurrentUser call)
    const session = AuthService.getCurrentSessionFromCache()

    return {
      user,
      session,
      loading: false,
      error: null
    }
  } catch (error) {
    const authError = error as AuthError
    // Don't treat session missing as an error state
    if (authError.message === 'Auth session missing!') {
      return {
        user: null,
        session: null,
        loading: false,
        error: null
      }
    }

    return {
      user: null,
      session: null,
      loading: false,
      error: authError.message
    }
  }
}

// Enhanced error handling types
export interface ProcessedAuthError {
  code: string
  message: string
  isRetryable: boolean
}

// Helper function to handle auth errors - FIXED: Proper type handling
export const getAuthErrorMessage = (error: AuthError | null): ProcessedAuthError => {
  if (!error) {
    return {
      code: 'NO_ERROR',
      message: '',
      isRetryable: false
    }
  }

  console.log('🔍 Processing auth error:', error.message)

  switch (error.message) {
    case 'Invalid login credentials':
      return {
        code: 'INVALID_CREDENTIALS',
        message: '❌ Incorrect email or password!\n\n💡 New user? Click "Sign Up Instead" below to create an account.',
        isRetryable: true
      }
    case 'Email not confirmed':
    case 'Email link is invalid or has expired':
    case 'Signup requires a valid password':
      return {
        code: 'EMAIL_NOT_CONFIRMED',
        message: '❌ Email not verified! Check your inbox and click the verification link.',
        isRetryable: true
      }
    case 'User already registered':
      return {
        code: 'USER_EXISTS',
        message: 'An account with this email already exists. Please sign in instead.',
        isRetryable: false
      }
    case 'Password should be at least 6 characters':
      return {
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long.',
        isRetryable: true
      }
    case 'Unable to validate email address: invalid format':
      return {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address.',
        isRetryable: true
      }
    case 'Signup is disabled':
      return {
        code: 'SIGNUP_DISABLED',
        message: 'New user registration is currently disabled.',
        isRetryable: false
      }
    case 'For security purposes, you can only request this once every 60 seconds':
      return {
        code: 'RATE_LIMITED',
        message: 'Please wait 60 seconds before requesting another verification email.',
        isRetryable: true
      }
    case 'Auth session missing!':
      return {
        code: 'SESSION_MISSING',
        message: 'Your session has expired. Please sign in again.',
        isRetryable: true
      }
    default:
      // Check for specific error patterns
      if (error.message.toLowerCase().includes('invalid login') ||
          error.message.toLowerCase().includes('invalid credentials') ||
          error.message.toLowerCase().includes('wrong password') ||
          error.message.toLowerCase().includes('incorrect password')) {
        return {
          code: 'INVALID_CREDENTIALS',
          message: '❌ Incorrect email or password!\n\n💡 New user? Click "Sign Up Instead" below to create an account.',
          isRetryable: true
        }
      }

      // Check for email confirmation related errors
      if (error.message.toLowerCase().includes('confirm') ||
          error.message.toLowerCase().includes('verify') ||
          error.message.toLowerCase().includes('email')) {
        return {
          code: 'EMAIL_NOT_CONFIRMED',
          message: '❌ Email not verified! Check your inbox and click the verification link.',
          isRetryable: true
        }
      }

      // Default case for unknown errors
      return {
        code: 'UNKNOWN_ERROR',
        message: `❌ Authentication failed: ${error.message}`,
        isRetryable: true
      }
  }
}