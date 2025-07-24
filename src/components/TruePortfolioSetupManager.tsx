import React, { useEffect, useState, useRef } from 'react';
import { useTruePortfolio } from '../utils/TruePortfolioContext';
import { TruePortfolioSetup } from './TruePortfolioSetup';
import { WelcomeMessageModal } from './WelcomeMessageModal';
import { useAuth } from '../context/AuthContext';
import { SupabaseService } from '../services/supabaseService';

const USER_NAME_LOCAL_KEY = 'user_name';
const WELCOME_COMPLETE_LOCAL_KEY = 'welcome_complete';

interface TruePortfolioSetupManagerProps {
  userName: string;
  setUserName: React.Dispatch<React.SetStateAction<string>>;
}

export const TruePortfolioSetupManager: React.FC<TruePortfolioSetupManagerProps> = ({
  userName,
  setUserName
}) => {
  // TEMPORARILY DISABLED: True Portfolio setup banner
  return null;

  const { user } = useAuth();
  const { yearlyStartingCapitals } = useTruePortfolio();
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState<boolean>(() => localStorage.getItem(WELCOME_COMPLETE_LOCAL_KEY) === 'true');
  const [isCapitalDataLoaded, setIsCapitalDataLoaded] = useState(false);

  // Early return if user is not authenticated
  if (!user) {
    return null;
  }

  // Removed trade checking logic - banner now only depends on capital data

  // Effect to load user name and welcome status on initial mount
  useEffect(() => {
    const storedUserName = localStorage.getItem(USER_NAME_LOCAL_KEY);
    if (storedUserName) {
      setUserName(storedUserName);
    }
    const storedWelcomeStatus = localStorage.getItem(WELCOME_COMPLETE_LOCAL_KEY);
    if (storedWelcomeStatus === 'true') {
      setHasCompletedWelcome(true);
    }
  }, [setUserName]);

  // CRITICAL FIX: Track when capital data has finished loading to prevent race conditions
  useEffect(() => {
    // Mark capital data as loaded after a short delay to ensure context has hydrated
    const timer = setTimeout(() => {
      setIsCapitalDataLoaded(true);
    }, 1000); // 1 second delay to ensure TruePortfolioContext has loaded

    return () => clearTimeout(timer);
  }, [yearlyStartingCapitals]); // Re-run when capital data changes

  // Check if initial setup is needed (yearly starting capital not set)
  // SIMPLIFIED: Only depends on capital data, ignores trade status
  useEffect(() => {
    if (
      isCapitalDataLoaded && // Wait for capital data to load
      yearlyStartingCapitals.length === 0 &&
      !isWelcomeModalOpen
    ) {
      console.log('🎉 User needs True Portfolio setup - showing setup modal');
      setIsSetupModalOpen(true);
    } else if (yearlyStartingCapitals.length > 0) {
      console.log('👤 User has capital data - skipping True Portfolio setup');
    }
  }, [yearlyStartingCapitals, isWelcomeModalOpen, isCapitalDataLoaded]);

  // Handles closing the initial setup modal and opening the welcome message
  const handleSetupComplete = (name: string) => {
    setUserName(name);
    localStorage.setItem(USER_NAME_LOCAL_KEY, name);
    setIsSetupModalOpen(false);
    // Only show welcome message if it hasn't been completed before
    if (!hasCompletedWelcome) {
      setIsWelcomeModalOpen(true);
      localStorage.setItem(WELCOME_COMPLETE_LOCAL_KEY, 'true');
      setHasCompletedWelcome(true);
    }
  };

  // Don't render anything while capital data is still loading
  if (!isCapitalDataLoaded) {
    return null;
  }

  return (
    <>
      <TruePortfolioSetup
        isOpen={isSetupModalOpen}
        onOpenChange={setIsSetupModalOpen}
        onSetupComplete={handleSetupComplete} // New prop for callback
        userName={userName}
        setUserName={setUserName}
      />
      <WelcomeMessageModal
        isOpen={isWelcomeModalOpen}
        onOpenChange={setIsWelcomeModalOpen}
        userName={userName}
      />
    </>
  );
};
