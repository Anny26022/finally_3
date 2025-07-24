import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { SocialAuthButtons } from './SocialAuthButtons'
import '../../styles/auth-performance.css'

type AuthMode = 'signin' | 'signup' | 'forgot-password'

interface AuthModalProps {
  isOpen?: boolean
  onClose?: () => void
  onGuestMode?: () => void
  onShowAuth?: () => void
}

/**
 * Refactored AuthModal - Controller component managing modal state and mode switching
 * PERFORMANCE OPTIMIZED: Form state is isolated to individual components
 * BUG FIXED: Removed unsafe type casting in error handling
 * MAINTAINABLE: Single responsibility principle with clear component separation
 */
export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  onClose,
  onGuestMode,
  onShowAuth
}) => {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [isReady, setIsReady] = useState(false)

  // Prevent initial render stutter
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Mode switching handlers
  const switchToSignIn = () => setMode('signin')
  const switchToSignUp = () => setMode('signup')
  const switchToForgotPassword = () => setMode('forgot-password')

  // Success handlers
  const handleAuthSuccess = () => {
    // Authentication successful, modal will be closed by parent component
    // or user will be redirected based on auth state changes
  }

  const handleSignUpSuccess = () => {
    // After successful signup, switch to signin mode
    setMode('signin')
  }

  const handleForgotPasswordSuccess = () => {
    // After password reset email sent, switch to signin mode
    setMode('signin')
  }

  // Optimized animation variants with GPU acceleration
  const containerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.98,
      y: 10,
      filter: "blur(4px)"
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.25,
        ease: [0.25, 0.46, 0.45, 0.94],
        filter: { duration: 0.15 }
      }
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      y: -10,
      filter: "blur(4px)",
      transition: {
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Render the appropriate form based on current mode
  const renderForm = () => {
    switch (mode) {
      case 'signin':
        return (
          <SignInForm
            onSuccess={handleAuthSuccess}
            onSwitchToSignUp={switchToSignUp}
            onSwitchToForgotPassword={switchToForgotPassword}
            autoFocus={isReady}
          />
        )
      case 'signup':
        return (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={switchToSignIn}
            onSwitchToForgotPassword={switchToForgotPassword}
            autoFocus={isReady}
          />
        )
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onSuccess={handleForgotPasswordSuccess}
            onSwitchToSignIn={switchToSignIn}
            onSwitchToSignUp={switchToSignUp}
            autoFocus={isReady}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Optimized Background Overlay with Strong Blur */}
      <motion.div
        className="auth-modal-backdrop absolute inset-0 bg-black/15"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isReady ? "visible" : "hidden"}
        exit="exit"
        className="auth-modal-container relative w-full max-w-sm z-10"
        data-loading={!isReady}
      >
        {/* Optimized Card with GPU acceleration */}
        <div className="auth-modal-card relative bg-white/98 dark:bg-black/98 border border-gray-200/30 dark:border-gray-700/30 rounded-xl shadow-xl overflow-hidden">
          {/* Content */}
          <div className="p-6">
            {/* Minimal Header */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center mb-4">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-black dark:text-white"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M8 12h8M12 8v8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-black dark:text-white">
                {mode === 'signin' && 'Welcome back'}
                {mode === 'signup' && 'Create account'}
                {mode === 'forgot-password' && 'Reset password'}
              </h2>
            </div>

            {/* Render appropriate form */}
            {renderForm()}

            {/* Social Authentication - Only show for signin and signup */}
            {mode !== 'forgot-password' && (
              <SocialAuthButtons
                onSuccess={handleAuthSuccess}
                disabled={false}
              />
            )}

            {/* Guest Mode Option */}
            {onGuestMode && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
                <button
                  onClick={onGuestMode}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Continue as Guest
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Limited features available
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
