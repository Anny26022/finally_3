import React, { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { AuthModal } from './AuthModal'
import { Spinner } from '@heroui/react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import '../../styles/auth-performance.css'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  // Add error boundary for React hot reload issues
  const [authContextError, setAuthContextError] = useState<string | null>(null)

  let authData: any = null
  try {
    authData = useAuth()
  } catch (error) {
    if (!authContextError) {
      console.error('🔥 AuthGuard: React hot reload context error detected')
      setAuthContextError(error instanceof Error ? error.message : String(error))
    }
  }

  // If context error, show reload message
  if (authContextError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <Icon icon="lucide:refresh-cw" className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Context Error Detected
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              React hot reload caused a context issue. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { user, session, loading, error } = authData || {}
  const [mounted, setMounted] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isGuestMode, setIsGuestMode] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [forceShowAuth, setForceShowAuth] = useState(false)

  // Track when component is mounted
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle authentication errors
  useEffect(() => {
    if (error) {
      console.log('🔐 AuthGuard detected auth error:', error)
      setAuthError(error)
    }
  }, [error])

  // CRITICAL FIX: Add timeout to prevent infinite loading after logout
  useEffect(() => {
    if (loading && mounted) {
      const loadingTimeout = setTimeout(() => {
        console.log('🔐 AuthGuard loading timeout - forcing auth modal display')
        setForceShowAuth(true)
      }, 3000) // 3 second timeout for loading state

      return () => clearTimeout(loadingTimeout)
    }
  }, [loading, mounted])

  // Show loading spinner while checking authentication (but not if we're forcing auth display)
  if ((!mounted || loading) && !forceShowAuth) {
    return (
      <div className="min-h-screen bg-background font-sans antialiased">
        {/* Backdrop with subtle pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,28,0.03),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(236,237,238,0.02),transparent_70%)]" />
        </div>

        {/* Loading content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center justify-center text-center max-w-sm mx-auto"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-16"
            >
              <div className="flex flex-col items-center justify-center space-y-6">
                {/* Animated Logo Icon */}
                <motion.div
                  animate={{
                    rotate: 360,
                    scale: [1, 1.02, 1]
                  }}
                  transition={{
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="relative"
                >
                  {/* Outer glow ring */}
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      opacity: [0.1, 0.3, 0.1]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 w-16 h-16 border border-foreground/10 rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
                  />

                  <svg
                    viewBox="0 0 24 24"
                    className="h-16 w-16 text-foreground relative z-10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <motion.circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="1"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M12 6L16 10L12 18L8 10L12 6Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="0.2"
                      strokeLinejoin="round"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 1, delay: 0.8, ease: "backOut" }}
                    />
                    <motion.path
                      d="M8 10L12 14L16 10"
                      stroke="currentColor"
                      strokeWidth="0.2"
                      fill="none"
                      opacity="0.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.5 }}
                      transition={{ duration: 1.2, delay: 1.2, ease: "easeInOut" }}
                    />
                  </svg>
                </motion.div>

                {/* Brand Name */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="text-center"
                >
                  <motion.h1
                    className="text-3xl font-bold tracking-wider text-foreground font-sans"
                    initial={{ letterSpacing: "0.3em", opacity: 0 }}
                    animate={{ letterSpacing: "0.15em", opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                  >
                    NEXUS
                  </motion.h1>
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "100%", opacity: 0.3 }}
                    transition={{ duration: 1, delay: 1 }}
                    className="h-px bg-foreground mt-3 mx-auto"
                  />
                </motion.div>
              </div>
            </motion.div>

            {/* Spinner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mb-8 flex justify-center"
            >
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 border-2 border-foreground/15 border-t-foreground rounded-full"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.2, 0.6, 0.2]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 w-12 h-12 border border-foreground/8 rounded-full"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.4, 0.1]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                  className="absolute inset-0 w-12 h-12 border border-foreground/5 rounded-full"
                />
              </div>
            </motion.div>

            {/* Loading text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-center"
            >
              <motion.p
                className="text-sm font-medium text-foreground/70 mb-4 font-sans tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                {!mounted ? 'Initializing...' : 'Checking authentication...'}
              </motion.p>

              <div className="flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-foreground/60 rounded-full"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 1, 0.3],
                      y: [0, -3, 0]
                    }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  // If user is authenticated, render children
  if (user && session) {
    return <>{children}</>
  }

  // If user chose guest mode, render children without auth
  if (isGuestMode) {
    return (
      <>
        {children}
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
      </>
    )
  }

  // Show auth modal with option to continue as guest
  // CRITICAL FIX: Also show auth modal if forceShowAuth is true (timeout fallback)
  return (
    <>
      {children}
      <AuthModal
        isOpen={true}
        onClose={() => {
          setIsGuestMode(true)
          setForceShowAuth(false) // Reset the force flag
        }}
        onGuestMode={() => {
          setIsGuestMode(true)
          setForceShowAuth(false) // Reset the force flag
        }}
        onShowAuth={() => setShowAuthModal(true)}
      />
    </>
  )
}

export default AuthGuard
