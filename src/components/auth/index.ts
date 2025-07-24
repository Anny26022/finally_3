// Main authentication modal component
export { AuthModal } from './AuthModal'

// Individual form components
export { SignInForm } from './SignInForm'
export { SignUpForm } from './SignUpForm'
export { ForgotPasswordForm } from './ForgotPasswordForm'

// Utility components
export { SocialAuthButtons } from './SocialAuthButtons'

// Custom hooks
export { useAuthForm } from './useAuthForm'
export type { AuthFormData, AuthFormState, AuthFormActions } from './useAuthForm'

// Helper utilities
export { AuthToastHelper } from './AuthToastHelper'

// Re-export existing components for backward compatibility
export { AuthGuard } from './AuthGuard'
