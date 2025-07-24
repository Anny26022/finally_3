import React, { useState } from 'react'
import { Icon } from '@iconify/react'
import { useAuth } from '../../context/AuthContext'
import { AuthToastHelper } from './AuthToastHelper'
import { getAuthErrorMessage } from '../../services/authService'

interface SocialAuthButtonsProps {
  onSuccess?: () => void
  disabled?: boolean
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onSuccess,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const { signInWithProvider } = useAuth()

  const handleSocialAuth = async (provider: 'twitter' | 'google') => {
    setIsLoading(true)

    try {
      const { error } = await signInWithProvider(provider)

      if (error) {
        // FIXED: Proper error handling - error is already a string from AuthContext
        const processedError = getAuthErrorMessage({ message: error } as any)
        AuthToastHelper.showError(processedError)
      } else {
        AuthToastHelper.signInSuccess()
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error) {
      AuthToastHelper.showError({
        code: 'SOCIAL_AUTH_ERROR',
        message: `Failed to sign in with ${provider}. Please try again.`,
        isRetryable: true
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-4">
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white dark:bg-black px-2 text-gray-500 dark:text-gray-400">
            OR CONTINUE WITH
          </span>
        </div>
      </div>

      {/* Social Auth Buttons */}
      <div className="mt-4 space-y-2">
        {/* Continue with X (Twitter) */}
        <button
          type="button"
          onClick={() => handleSocialAuth('twitter')}
          disabled={disabled || isLoading}
          className="w-full flex items-center justify-center px-3 py-2 border border-gray-200 dark:border-gray-700 rounded text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-300 rounded-full animate-spin mr-2" />
          ) : (
            <Icon icon="mdi:twitter" className="w-4 h-4 mr-2" />
          )}
          Continue with X
        </button>

        {/* Continue with Google */}
        <button
          type="button"
          onClick={() => handleSocialAuth('google')}
          disabled={disabled || isLoading}
          className="w-full flex items-center justify-center px-3 py-2 border border-gray-200 dark:border-gray-700 rounded text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-all"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-300 rounded-full animate-spin mr-2" />
          ) : (
            <Icon icon="mdi:google" className="w-4 h-4 mr-2" />
          )}
          Continue with Google
        </button>
      </div>
    </div>
  )
}
