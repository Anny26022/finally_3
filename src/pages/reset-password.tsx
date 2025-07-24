import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Input, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const ResetPasswordPage: React.FC = () => {
  const history = useHistory();
  const { user, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);

  // Handle password reset session from URL
  useEffect(() => {
    const handlePasswordResetSession = async () => {
      try {
        // Debug: Log the current URL
        console.log('🔐 Reset password page - Current URL:', window.location.href);
        console.log('🔐 Reset password page - Hash:', window.location.hash);
        console.log('🔐 Reset password page - Search:', window.location.search);

        // Wait a moment for Supabase to process any redirects
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if we have tokens in the URL hash (from password reset email)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);

        // Check for errors first
        const error = hashParams.get('error') || searchParams.get('error');
        const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        if (error) {
          console.log('🔐 Reset password page - Error in URL:', { error, errorCode, errorDescription });

          if (errorCode === 'otp_expired') {
            setError('This password reset link has expired. Please request a new password reset.');
          } else if (error === 'access_denied') {
            setError('Access denied. Please request a new password reset.');
          } else {
            setError(`Reset link error: ${errorDescription || error}. Please request a new password reset.`);
          }
          return;
        }

        // Try hash first, then search params
        let accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        let type = hashParams.get('type') || searchParams.get('type');

        console.log('🔐 Reset password page - Parsed params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        if (type === 'recovery' && accessToken) {
          console.log('🔐 Reset password page - Setting session with recovery tokens');

          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });

          if (error) {
            console.error('❌ Error setting session:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
            return;
          }

          if (data.session && data.session.user) {
            console.log('✅ Session set successfully for user:', data.session.user.email);
            setIsValidSession(true);
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.error('❌ No session or user after setting session');
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
        } else {
          console.log('🔐 Reset password page - No recovery tokens found, checking existing session');

          // Try multiple approaches to get the session
          let sessionFound = false;

          // Method 1: Check existing session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (session && session.user) {
            console.log('✅ Found existing session for user:', session.user.email);
            setIsValidSession(true);
            sessionFound = true;
          }

          // Method 2: If no session, try to refresh
          if (!sessionFound) {
            console.log('🔐 Attempting to refresh session...');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshData.session && refreshData.session.user) {
              console.log('✅ Session refreshed for user:', refreshData.session.user.email);
              setIsValidSession(true);
              sessionFound = true;
            }
          }

          // Method 3: Listen for auth state changes (in case Supabase is still processing)
          if (!sessionFound) {
            console.log('🔐 Waiting for auth state change...');

            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
              console.log('🔐 Auth state change:', event, session?.user?.email);

              if (event === 'SIGNED_IN' && session && session.user) {
                console.log('✅ User signed in via auth state change:', session.user.email);
                setIsValidSession(true);
                sessionFound = true;
                subscription.unsubscribe();
              }
            });

            // Wait up to 5 seconds for auth state change
            setTimeout(() => {
              subscription.unsubscribe();
              if (!sessionFound) {
                console.log('❌ No session found after waiting');
                setError('Invalid or expired reset link. Please request a new password reset.');
              }
            }, 5000);
          }

          if (error && !sessionFound) {
            console.error('❌ Session error:', error);
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
        }
      } catch (err) {
        console.error('Error handling password reset session:', err);
        setError('An error occurred. Please try again.');
      }
    };

    handlePasswordResetSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!isValidSession) {
      setError('Invalid session. Please request a new password reset.');
      return;
    }

    setIsLoading(true);

    try {
      // Use Supabase's updateUser method as per documentation
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess('Password reset successful! Redirecting to sign in...');
        setTimeout(() => {
          history.push('/'); // Redirect to home/sign-in
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking session
  if (!isValidSession && !error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl font-sans">
        <div className="relative w-full max-w-sm z-10">
          <div className="relative bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl p-8">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 text-center">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl font-sans">
      <div className="relative w-full max-w-sm z-10">
        <div className="relative bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <Icon icon="lucide:key" className="w-12 h-12 text-gray-700 dark:text-gray-300 mb-4" />
            <h2 className="text-3xl font-black tracking-tight mb-2 text-center text-gray-900 dark:text-white leading-tight">
              Reset your password
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-center text-base font-medium mb-1">
              Create a new password to access your account.
            </p>
          </div>

          {isValidSession ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Password</span>}
                type="password"
                value={password}
                onValueChange={setPassword}
                required
                size="md"
                variant="bordered"
                className="bg-white/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-600 focus:border-black dark:focus:border-white text-gray-900 dark:text-white"
                placeholder="Enter your new password"
              />
              <Input
                label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Confirm Password</span>}
                type="password"
                value={confirmPassword}
                onValueChange={setConfirmPassword}
                required
                size="md"
                variant="bordered"
                className="bg-white/90 dark:bg-gray-800/90 border border-gray-300 dark:border-gray-600 focus:border-black dark:focus:border-white text-gray-900 dark:text-white"
                placeholder="Confirm your new password"
              />

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm font-semibold text-center mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-600 dark:text-green-400 text-sm font-semibold text-center mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                  {success}
                </div>
              )}

              <Button
                color="default"
                type="submit"
                className="w-full mt-2 bg-black dark:bg-white text-white dark:text-black font-extrabold text-base tracking-tight shadow-md rounded-xl hover:bg-gray-900 dark:hover:bg-gray-200 transition-all duration-200 py-2"
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Updating Password...' : 'Reset Password'}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <div className="text-red-600 dark:text-red-400 text-sm font-semibold mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                {error}
              </div>

              <div className="space-y-3">
                <Button
                  color="default"
                  onClick={() => history.push('/')}
                  className="w-full bg-black dark:bg-white text-white dark:text-black font-semibold text-base tracking-tight shadow-md rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 py-2"
                >
                  Request New Password Reset
                </Button>

                <Button
                  color="default"
                  onClick={() => history.push('/')}
                  className="w-full bg-gray-600 dark:bg-gray-400 text-white dark:text-black font-medium text-sm tracking-tight shadow-md rounded-xl hover:bg-gray-700 dark:hover:bg-gray-500 transition-all duration-200 py-2"
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage; 