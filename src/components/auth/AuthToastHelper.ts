import { addToast } from '@heroui/react'
import type { ProcessedAuthError } from '../../services/authService'

// Standardized toast configuration
const TOAST_BASE_CONFIG = {
  variant: 'flat' as const,
  radius: 'lg' as const,
  classNames: {
    base: 'flex items-center w-full max-w-[320px] min-w-[220px] p-2 pr-6 rounded-[12px] shadow-md border border-white/30 dark:border-black/30 bg-white/10 dark:bg-black/10 backdrop-blur-lg transition-all duration-200 relative gap-1',
    title: 'text-xs font-semibold',
    description: 'text-xs'
  }
}

// Toast helper functions for authentication
export const AuthToastHelper = {
  /**
   * Show error toast for authentication failures
   */
  showError: (error: ProcessedAuthError) => {
    const iconMap = {
      INVALID_CREDENTIALS: 'lucide:alert-circle',
      EMAIL_NOT_CONFIRMED: 'lucide:mail-warning',
      USER_EXISTS: 'lucide:user-x',
      WEAK_PASSWORD: 'lucide:shield-alert',
      INVALID_EMAIL: 'lucide:mail-x',
      SIGNUP_DISABLED: 'lucide:user-x',
      RATE_LIMITED: 'lucide:clock',
      SESSION_MISSING: 'lucide:key',
      UNKNOWN_ERROR: 'lucide:alert-triangle'
    }

    const colorMap = {
      INVALID_CREDENTIALS: 'danger' as const,
      EMAIL_NOT_CONFIRMED: 'warning' as const,
      USER_EXISTS: 'danger' as const,
      WEAK_PASSWORD: 'danger' as const,
      INVALID_EMAIL: 'danger' as const,
      SIGNUP_DISABLED: 'danger' as const,
      RATE_LIMITED: 'warning' as const,
      SESSION_MISSING: 'warning' as const,
      UNKNOWN_ERROR: 'danger' as const
    }

    const titleMap = {
      INVALID_CREDENTIALS: 'Authentication Failed',
      EMAIL_NOT_CONFIRMED: 'Email Not Verified',
      USER_EXISTS: 'Account Already Exists',
      WEAK_PASSWORD: 'Weak Password',
      INVALID_EMAIL: 'Invalid Email',
      SIGNUP_DISABLED: 'Registration Disabled',
      RATE_LIMITED: 'Rate Limited',
      SESSION_MISSING: 'Session Expired',
      UNKNOWN_ERROR: 'Unexpected Error'
    }

    const icon = iconMap[error.code as keyof typeof iconMap] || 'lucide:alert-circle'
    const color = colorMap[error.code as keyof typeof colorMap] || 'danger'
    const title = titleMap[error.code as keyof typeof titleMap] || 'Error'

    addToast({
      title,
      description: error.message.replace(/\n/g, ' '),
      color,
      ...TOAST_BASE_CONFIG
    })
  },

  /**
   * Show success toast for authentication success
   */
  showSuccess: (title: string, description: string) => {
    addToast({
      title,
      description,
      color: 'success',
      ...TOAST_BASE_CONFIG
    })
  },

  /**
   * Show info toast for authentication info
   */
  showInfo: (title: string, description: string) => {
    addToast({
      title,
      description,
      color: 'primary',
      ...TOAST_BASE_CONFIG
    })
  },

  /**
   * Specific toast helpers for common auth scenarios
   */
  signInSuccess: () => {
    AuthToastHelper.showSuccess(
      'Welcome Back!',
      'You have been signed in successfully.'
    )
  },

  signUpSuccess: (email: string) => {
    AuthToastHelper.showSuccess(
      'Account Created',
      `Please check your email (${email}) for a verification link.`
    )
  },

  passwordResetSent: () => {
    AuthToastHelper.showInfo(
      'Reset Email Sent',
      'If this email exists, a reset link was sent.'
    )
  },

  verificationEmailSent: () => {
    AuthToastHelper.showSuccess(
      'Verification Email Sent',
      'Check your inbox for the verification email.'
    )
  },

  passwordMismatch: () => {
    AuthToastHelper.showError({
      code: 'PASSWORD_MISMATCH',
      message: 'Passwords do not match',
      isRetryable: true
    })
  },

  weakPassword: () => {
    AuthToastHelper.showError({
      code: 'WEAK_PASSWORD',
      message: 'Password must be at least 6 characters long',
      isRetryable: true
    })
  }
}
