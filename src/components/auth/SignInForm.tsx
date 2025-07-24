import React, { useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import { useAuthForm } from './useAuthForm'

interface SignInFormProps {
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
  onSwitchToForgotPassword?: () => void
  onResendVerification?: () => void
  autoFocus?: boolean
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
  onResendVerification,
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

    const success = await actions.handleSignIn()
    if (success && onSuccess) {
      onSuccess()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      const form = e.target.closest('form')
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input[type="email"], input[type="password"]'))
        const currentIndex = inputs.indexOf(e.target)
        const isLastInput = currentIndex === inputs.length - 1

        if (isLastInput) {
          form.requestSubmit()
        } else {
          const nextInput = inputs[currentIndex + 1] as HTMLInputElement
          nextInput?.focus()
        }
      }
    }
  }

  const handleResendClick = async () => {
    const success = await actions.handleResendVerification()
    if (success && onResendVerification) {
      onResendVerification()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="space-y-3"
      noValidate
      autoComplete="off"
      data-testid="signin-form"
      role="form"
      aria-label="Sign in form"
    >
      {/* REMOVED: Inline error display to prevent duplication with toast notifications */}
      {/* Error actions only - no duplicate error message */}
      {state.error && state.error.code === 'EMAIL_NOT_CONFIRMED' && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-center">
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleResendClick}
              disabled={state.isLoading || !state.data.email}
              className="text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline disabled:opacity-50 font-medium"
            >
              📧 Resend Verification Email
            </button>
          </div>
        </div>
      )}

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

      {/* Password Field */}
      <div className="relative">
        <input
          type={state.showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={state.data.password}
          onChange={(e) => actions.updateField('password', e.target.value)}
          required
          autoComplete="current-password"
          aria-label="Password"
          aria-describedby="password-help"
          className="w-full px-3 py-2 pr-8 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        />
        <button
          type="button"
          onClick={() => actions.setShowPassword(!state.showPassword)}
          tabIndex={-1}
          aria-label={state.showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300"
        >
          <Icon icon={state.showPassword ? 'mdi:eye-off' : 'mdi:eye'} className="text-sm" />
        </button>
      </div>

      {/* Forgot Password Link */}
      {onSwitchToForgotPassword && (
        <div className="text-center">
          <button
            type="button"
            onClick={onSwitchToForgotPassword}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors underline focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
          >
            Forgot your password?
          </button>
        </div>
      )}

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
          'Sign In'
        )}
      </button>

      {/* Navigation Links */}
      <div className="text-center">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          {onSwitchToSignUp && (
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-black dark:text-white underline hover:no-underline transition-colors focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
            >
              Sign up
            </button>
          )}
        </p>
      </div>
    </form>
  )
}
