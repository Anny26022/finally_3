import React, { useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import { useAuthForm } from './useAuthForm'

interface SignUpFormProps {
  onSuccess?: () => void
  onSwitchToSignIn?: () => void
  onSwitchToForgotPassword?: () => void
  autoFocus?: boolean
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onSwitchToSignIn,
  onSwitchToForgotPassword,
  autoFocus = false
}) => {
  const [state, actions] = useAuthForm()
  const firstNameInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus first name field when component mounts
  useEffect(() => {
    if (autoFocus && firstNameInputRef.current) {
      const timer = setTimeout(() => {
        firstNameInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const success = await actions.handleSignUp()
    if (success && onSuccess) {
      onSuccess()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      const form = e.target.closest('form')
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input[type="email"], input[type="password"], input[type="text"]'))
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

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="space-y-3"
      noValidate
      autoComplete="off"
      data-testid="signup-form"
      role="form"
      aria-label="Sign up form"
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

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={firstNameInputRef}
          type="text"
          placeholder="First"
          value={state.data.firstName || ''}
          onChange={(e) => actions.updateField('firstName', e.target.value)}
          autoComplete="given-name"
          aria-label="First name"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        />
        <input
          type="text"
          placeholder="Last"
          value={state.data.lastName || ''}
          onChange={(e) => actions.updateField('lastName', e.target.value)}
          autoComplete="family-name"
          aria-label="Last name"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        />
      </div>

      {/* Email Field */}
      <input
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
          autoComplete="new-password"
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

      {/* Confirm Password Field */}
      <div className="relative">
        <input
          type={state.showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirm Password"
          value={state.data.confirmPassword || ''}
          onChange={(e) => actions.updateField('confirmPassword', e.target.value)}
          required
          autoComplete="new-password"
          aria-label="Confirm Password"
          aria-describedby="confirm-password-help"
          className="w-full px-3 py-2 pr-8 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm focus:outline-none focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        />
        <button
          type="button"
          onClick={() => actions.setShowConfirmPassword(!state.showConfirmPassword)}
          tabIndex={-1}
          aria-label={state.showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:text-gray-600 dark:focus:text-gray-300"
        >
          <Icon icon={state.showConfirmPassword ? 'mdi:eye-off' : 'mdi:eye'} className="text-sm" />
        </button>
      </div>

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
          'Sign Up'
        )}
      </button>

      {/* Navigation Links */}
      <div className="text-center space-y-1">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          {onSwitchToSignIn && (
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-black dark:text-white underline hover:no-underline transition-colors focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
            >
              Sign in
            </button>
          )}
        </p>
        {onSwitchToForgotPassword && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Forgot your password?{' '}
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-black dark:text-white underline hover:no-underline transition-colors focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 rounded px-1 py-0.5"
            >
              Reset it
            </button>
          </p>
        )}
      </div>
    </form>
  )
}
