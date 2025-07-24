import React, { useEffect, useRef } from 'react'
import { useAuthForm } from './useAuthForm'

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onSwitchToSignIn?: () => void
  onSwitchToSignUp?: () => void
  autoFocus?: boolean
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSuccess,
  onSwitchToSignIn,
  onSwitchToSignUp,
  autoFocus = false
}) => {
  const [state, actions] = useAuthForm()
  const emailInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus email field when component mounts
  useEffect(() => {
    if (autoFocus && emailInputRef.current) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const success = await actions.handleForgotPassword()
    if (success && onSuccess) {
      onSuccess()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      const form = e.target.closest('form')
      if (form) {
        form.requestSubmit()
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="space-y-3"
      noValidate
      autoComplete="off"
      data-testid="forgot-password-form"
      role="form"
      aria-label="Password reset form"
    >
      {/* REMOVED: Inline error display to prevent duplication with toast notifications */}

      {/* Success Message - Keep this as it's informational, not an error */}
      {state.success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-center">
          <p className="text-xs text-green-600 dark:text-green-400 leading-relaxed">
            ✅ {state.success}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-4 text-center">
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {/* Email Field */}
      <input
        ref={emailInputRef}
        type="email"
        placeholder="Email"
        value={state.data.email}
        onChange={(e) => actions.updateField('email', e.target.value)}
        required
        autoComplete="email"
        aria-label="Email address"
        aria-describedby="email-help"
        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
      />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={state.isLoading}
        className="w-full py-2 px-4 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
      >
        {state.isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
          </div>
        ) : (
          'Send Reset Email'
        )}
      </button>

      {/* Navigation Links */}
      <div className="text-center space-y-1">
        {onSwitchToSignIn && (
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors underline focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
          >
            ← Back to sign in
          </button>
        )}
        {onSwitchToSignUp && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-black dark:text-white underline hover:no-underline transition-colors focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
            >
              Sign up
            </button>
          </p>
        )}
      </div>
    </form>
  )
}
