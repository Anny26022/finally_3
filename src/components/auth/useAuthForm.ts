import { useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getAuthErrorMessage, type ProcessedAuthError } from '../../services/authService'
import { AuthToastHelper } from './AuthToastHelper'

export interface AuthFormData {
  email: string
  password: string
  confirmPassword?: string
  firstName?: string
  lastName?: string
}

export interface AuthFormState {
  data: AuthFormData
  isLoading: boolean
  error: ProcessedAuthError | null
  success: string
  showPassword: boolean
  showConfirmPassword: boolean
}

export interface AuthFormActions {
  updateField: (field: keyof AuthFormData, value: string) => void
  setShowPassword: (show: boolean) => void
  setShowConfirmPassword: (show: boolean) => void
  clearMessages: () => void
  resetForm: () => void
  handleSignIn: () => Promise<boolean>
  handleSignUp: () => Promise<boolean>
  handleForgotPassword: () => Promise<boolean>
  handleResendVerification: () => Promise<boolean>
}

const initialFormData: AuthFormData = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: ''
}

const initialState: AuthFormState = {
  data: initialFormData,
  isLoading: false,
  error: null,
  success: '',
  showPassword: false,
  showConfirmPassword: false
}

/**
 * Custom hook for authentication form management
 * Centralizes form state, validation, and API calls
 */
export const useAuthForm = (): [AuthFormState, AuthFormActions] => {
  const [state, setState] = useState<AuthFormState>(initialState)
  const { signIn, signUp, resetPassword, resendVerification } = useAuth()

  // Update individual form fields
  const updateField = useCallback((field: keyof AuthFormData, value: string) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value },
      error: null, // Clear error when user starts typing
      success: ''
    }))
  }, [])

  // Toggle password visibility
  const setShowPassword = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showPassword: show }))
  }, [])

  const setShowConfirmPassword = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showConfirmPassword: show }))
  }, [])

  // Clear error and success messages
  const clearMessages = useCallback(() => {
    setState(prev => ({ ...prev, error: null, success: '' }))
  }, [])

  // Reset entire form
  const resetForm = useCallback(() => {
    setState(initialState)
  }, [])

  // Validation helpers
  const validateEmail = (email: string): ProcessedAuthError | null => {
    if (!email.trim()) {
      return {
        code: 'REQUIRED_FIELD',
        message: 'Email is required',
        isRetryable: true
      }
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        code: 'INVALID_EMAIL',
        message: 'Please enter a valid email address',
        isRetryable: true
      }
    }
    
    return null
  }

  const validatePassword = (password: string): ProcessedAuthError | null => {
    if (!password) {
      return {
        code: 'REQUIRED_FIELD',
        message: 'Password is required',
        isRetryable: true
      }
    }
    
    if (password.length < 6) {
      return {
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long',
        isRetryable: true
      }
    }
    
    return null
  }

  const validatePasswordMatch = (password: string, confirmPassword: string): ProcessedAuthError | null => {
    if (password !== confirmPassword) {
      return {
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match',
        isRetryable: true
      }
    }
    return null
  }

  // Authentication handlers
  const handleSignIn = useCallback(async (): Promise<boolean> => {
    const { email, password } = state.data

    // ENHANCED VALIDATION: Check for empty values first
    if (!email || !email.trim()) {
      const emptyEmailError: ProcessedAuthError = {
        code: 'INVALID_EMAIL',
        message: 'Email is required',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: emptyEmailError }))
      AuthToastHelper.showError(emptyEmailError)
      return false
    }

    if (!password || !password.trim()) {
      const emptyPasswordError: ProcessedAuthError = {
        code: 'WEAK_PASSWORD',
        message: 'Password is required',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: emptyPasswordError }))
      AuthToastHelper.showError(emptyPasswordError)
      return false
    }

    // Validate inputs
    const emailError = validateEmail(email)
    if (emailError) {
      setState(prev => ({ ...prev, error: emailError }))
      AuthToastHelper.showError(emailError)
      return false
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setState(prev => ({ ...prev, error: passwordError }))
      AuthToastHelper.showError(passwordError)
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, success: '' }))

    try {
      // CRITICAL FIX: Pass object format that AuthService expects
      const result = await signIn({ email, password })

      if (result.error) {
        // FIXED: Handle AuthService error format properly
        const errorMessage = typeof result.error === 'string' ? result.error : result.error.message
        const processedError = getAuthErrorMessage({ message: errorMessage } as any)
        setState(prev => ({ ...prev, error: processedError, isLoading: false }))
        AuthToastHelper.showError(processedError)
        return false
      }

      setState(prev => ({ ...prev, isLoading: false }))
      AuthToastHelper.signInSuccess()
      return true
    } catch (error) {
      const processedError: ProcessedAuthError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred during sign in',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: processedError, isLoading: false }))
      AuthToastHelper.showError(processedError)
      return false
    }
  }, [state.data, signIn])

  const handleSignUp = useCallback(async (): Promise<boolean> => {
    const { email, password, confirmPassword, firstName, lastName } = state.data

    // Validate inputs
    const emailError = validateEmail(email)
    if (emailError) {
      setState(prev => ({ ...prev, error: emailError }))
      AuthToastHelper.showError(emailError)
      return false
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setState(prev => ({ ...prev, error: passwordError }))
      AuthToastHelper.showError(passwordError)
      return false
    }

    const passwordMatchError = validatePasswordMatch(password, confirmPassword || '')
    if (passwordMatchError) {
      setState(prev => ({ ...prev, error: passwordMatchError }))
      AuthToastHelper.showError(passwordMatchError)
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, success: '' }))

    try {
      // CRITICAL FIX: Pass object format that AuthService expects
      const { error } = await signUp({ email, password, firstName, lastName })

      if (error) {
        // FIXED: Proper error handling - error is already a string from AuthContext
        const processedError = getAuthErrorMessage({ message: error } as any)
        setState(prev => ({ ...prev, error: processedError, isLoading: false }))
        AuthToastHelper.showError(processedError)
        return false
      }

      const successMessage = `✅ Account created successfully!\n\n📧 Please check your email (${email}) for a verification link.\n\n⚠️ You must verify your email before you can sign in.\n\n💡 Check your spam folder if you don't see the email within a few minutes.`
      setState(prev => ({ 
        ...prev, 
        success: successMessage, 
        isLoading: false,
        data: { ...prev.data, password: '', confirmPassword: '' }
      }))
      AuthToastHelper.signUpSuccess(email)
      return true
    } catch (error) {
      const processedError: ProcessedAuthError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred during sign up',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: processedError, isLoading: false }))
      AuthToastHelper.showError(processedError)
      return false
    }
  }, [state.data, signUp])

  const handleForgotPassword = useCallback(async (): Promise<boolean> => {
    const { email } = state.data

    const emailError = validateEmail(email)
    if (emailError) {
      setState(prev => ({ ...prev, error: emailError }))
      AuthToastHelper.showError(emailError)
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, success: '' }))

    try {
      const { error } = await resetPassword(email)

      if (error) {
        // FIXED: Proper error handling - error is already a string from AuthContext
        const processedError = getAuthErrorMessage({ message: error } as any)
        setState(prev => ({ ...prev, error: processedError, isLoading: false }))
        AuthToastHelper.showError(processedError)
        return false
      }

      const successMessage = 'If this email exists, a reset link was sent.'
      setState(prev => ({ ...prev, success: successMessage, isLoading: false }))
      AuthToastHelper.passwordResetSent()
      return true
    } catch (error) {
      const processedError: ProcessedAuthError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred during password reset',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: processedError, isLoading: false }))
      AuthToastHelper.showError(processedError)
      return false
    }
  }, [state.data, resetPassword])

  const handleResendVerification = useCallback(async (): Promise<boolean> => {
    const { email } = state.data

    if (!email) {
      const error: ProcessedAuthError = {
        code: 'REQUIRED_FIELD',
        message: 'Please enter your email address first',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error }))
      AuthToastHelper.showError(error)
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, success: '' }))

    try {
      const { error } = await resendVerification(email)

      if (error) {
        const processedError: ProcessedAuthError = {
          code: 'RESEND_ERROR',
          message: error,
          isRetryable: true
        }
        setState(prev => ({ ...prev, error: processedError, isLoading: false }))
        AuthToastHelper.showError(processedError)
        return false
      }

      const successMessage = 'Verification email sent! Check your inbox.'
      setState(prev => ({ ...prev, success: successMessage, isLoading: false }))
      AuthToastHelper.verificationEmailSent()
      return true
    } catch (error) {
      const processedError: ProcessedAuthError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred while resending verification',
        isRetryable: true
      }
      setState(prev => ({ ...prev, error: processedError, isLoading: false }))
      AuthToastHelper.showError(processedError)
      return false
    }
  }, [state.data, resendVerification])

  const actions: AuthFormActions = {
    updateField,
    setShowPassword,
    setShowConfirmPassword,
    clearMessages,
    resetForm,
    handleSignIn,
    handleSignUp,
    handleForgotPassword,
    handleResendVerification
  }

  return [state, actions]
}
