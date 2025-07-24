import { useState, useEffect, useCallback } from 'react'
import { AuthService, AuthState, getAuthState } from '../services/authService'

/**
 * Custom hook that subscribes to AuthService events and provides React state
 * This is the ONLY place that should manage auth state in React components
 * 
 * ARCHITECTURAL BENEFITS:
 * - Single source of truth (AuthService)
 * - Event-driven updates (no polling)
 * - Automatic cleanup
 * - Optimized re-renders
 */
export const useAuthServiceSubscription = () => {
  // Simple state that mirrors AuthService state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null
  })

  // Memoized state updater to prevent unnecessary re-renders
  const updateAuthState = useCallback(async () => {
    try {
      const state = await getAuthState()
      setAuthState(state)
    } catch (error) {
      console.error('❌ Failed to get auth state:', error)
      setAuthState({
        user: null,
        session: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      })
    }
  }, [])

  // Initialize and subscribe to AuthService events
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        // Initialize AuthService (idempotent operation)
        await AuthService.initialize()
        
        // Get initial state
        if (isMounted) {
          await updateAuthState()
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error)
        if (isMounted) {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            error: 'Failed to initialize authentication'
          })
        }
      }
    }

    // Subscribe to AuthService events
    const unsubscribeSignIn = AuthService.onAuthEvent((event) => {
      if (event === 'signIn' && isMounted) {
        updateAuthState()
      }
    })

    const unsubscribeSignOut = AuthService.onAuthEvent((event) => {
      if (event === 'signOut' && isMounted) {
        setAuthState({
          user: null,
          session: null,
          loading: false,
          error: null
        })
      }
    })

    const unsubscribeTokenRefresh = AuthService.onAuthEvent((event) => {
      if (event === 'tokenRefresh' && isMounted) {
        updateAuthState()
      }
    })

    // Initialize
    initializeAuth()

    // Cleanup function
    return () => {
      isMounted = false
      unsubscribeSignIn()
      unsubscribeSignOut()
      unsubscribeTokenRefresh()
    }
  }, [updateAuthState])

  // Return state and actions (actions are just AuthService methods)
  return {
    // State
    ...authState,
    
    // Actions (direct AuthService methods - no duplication)
    signIn: AuthService.signIn.bind(AuthService),
    signUp: AuthService.signUp.bind(AuthService),
    signInWithProvider: AuthService.signInWithProvider.bind(AuthService),
    signOut: AuthService.signOut.bind(AuthService),
    resetPassword: AuthService.resetPassword.bind(AuthService),
    resendVerification: AuthService.resendVerification.bind(AuthService),
    updatePassword: AuthService.updatePassword.bind(AuthService),
    updateProfile: AuthService.updateProfile.bind(AuthService),
    refreshSession: AuthService.refreshSession.bind(AuthService),
    
    // Utility methods
    refresh: updateAuthState
  }
}

/**
 * Performance monitoring for auth state changes
 */
export const useAuthPerformanceMonitor = () => {
  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      if (duration > 100) {
        console.warn(`🐌 Auth state subscription took ${duration.toFixed(2)}ms`)
      }
    }
  })
}
