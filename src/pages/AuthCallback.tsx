import React, { useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner, Button } from '@heroui/react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'

export const AuthCallback: React.FC = () => {
  const history = useHistory()
  const location = useLocation()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check URL parameters for errors first
        const searchParams = new URLSearchParams(location.search)
        const hashParams = new URLSearchParams(location.hash.substring(1))

        const error = searchParams.get('error') || hashParams.get('error')
        const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const expiresIn = hashParams.get('expires_in')
        const tokenType = hashParams.get('token_type')

        if (error) {
          setError(errorDescription || error)
          setStatus('error')
          return
        }

        // Handle implicit flow with access token in hash
        if (accessToken) {
          try {
            // Set the session manually using the tokens from the URL
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            })

            if (setSessionError) {
              // Don't return here, fall through to session check
            } else if (data.session) {
              setStatus('success')
              setTimeout(() => {
                history.replace('/')
              }, 1500)
              return
            }
          } catch (setSessionError) {
            // Continue to session check
          }
        }

        // Handle any URL that might contain session info
        // This covers cases where Supabase automatically processes the callback
        if (window.location.hash || window.location.search) {
          // Give Supabase more time to automatically process the callback
          await new Promise(resolve => setTimeout(resolve, 3000))
        }

        // Fallback: Check for existing session with retries
        let session = null
        let sessionError = null

        // Try multiple times to get the session
        for (let attempt = 1; attempt <= 5; attempt++) {
          const result = await supabase.auth.getSession()
          sessionError = result.error
          session = result.data.session

          if (session) {
            setStatus('success')

            // Check for next parameter (for password reset redirects)
            const nextUrl = searchParams.get('next')
            const redirectUrl = nextUrl || '/'

            setTimeout(() => {
              history.replace(redirectUrl)
            }, 1500)
            return
          }

          if (sessionError) {
            console.error('Session error on attempt', attempt, ':', sessionError)
          }

          // Wait before next attempt
          if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        // If we get here, no session was found after all attempts
        if (sessionError) {
          setError(sessionError.message)
        } else {
          setError('Authentication failed - no session established')
        }
        setStatus('error')
      } catch (error) {
        setError('An unexpected error occurred during authentication')
        setStatus('error')
      }
    }

    handleAuthCallback()
  }, [location.search, location.hash, history])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background font-sans antialiased">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,28,0.03),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(236,237,238,0.02),transparent_70%)]" />
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center justify-center text-center max-w-sm mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mb-8"
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <motion.div
                  animate={{
                    rotate: 360,
                    scale: [1, 1.05, 1]
                  }}
                  transition={{
                    rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8 text-foreground"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <motion.circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 1.5, ease: "easeInOut" }}
                    />
                    <motion.path
                      d="M12 6L16 10L12 18L8 10L12 6Z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      strokeLinejoin="round"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.5, ease: "backOut" }}
                    />
                    <motion.path
                      d="M8 10L12 14L16 10"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      fill="none"
                      opacity="0.7"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.7 }}
                      transition={{ duration: 1, delay: 1, ease: "easeInOut" }}
                    />
                  </svg>
                </motion.div>
                <span className="text-2xl font-bold tracking-tight text-foreground font-sans">NEXUS</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mb-6"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 border-2 border-foreground/20 border-t-foreground rounded-full"
                />
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.8, 0.3]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 w-12 h-12 border border-foreground/10 rounded-full"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <p className="text-sm font-medium text-foreground/80 mb-2 font-sans">Completing authentication...</p>
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-foreground rounded-full"
                    animate={{
                      scale: [1, 1.4, 1],
                      opacity: [0.4, 1, 0.4],
                      y: [0, -2, 0]
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
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

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background font-sans antialiased">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.08),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.05),transparent_50%)]" />
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <div className="w-20 h-20 bg-success/10 dark:bg-success/5 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-success/20">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Icon icon="lucide:check-circle" className="w-10 h-10 text-success" />
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <h1 className="text-2xl font-bold text-foreground mb-2 font-sans">
                Authentication Successful!
              </h1>
              <p className="text-foreground/70 mb-4 font-sans">
                Redirecting you to the application...
              </p>

              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-success rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(239,68,68,0.05),transparent_50%)]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="text-center max-w-md mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-danger/10 dark:bg-danger/5 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-danger/20">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <Icon icon="lucide:alert-circle" className="w-10 h-10 text-danger" />
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2 font-sans">
              Authentication Failed
            </h1>
            <p className="text-foreground/70 mb-6 font-sans">
              {error || 'An error occurred during authentication'}
            </p>

            <Button
              color="primary"
              variant="solid"
              size="lg"
              onPress={() => history.replace('/')}
              startContent={<Icon icon="lucide:home" className="w-4 h-4" />}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300"
            >
              Return to Home
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
