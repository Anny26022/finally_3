import React, { useState } from 'react';
import { GapDownAnalysisButton } from './GapDownAnalysisButton';
import GapDownAnalysisModal from './GapDownAnalysisModalNew';
import { useTruePortfolio } from '../utils/TruePortfolioContext';

export const GapDownAnalysisWrapper: React.FC = () => {
  const [isGapDownAnalysisOpen, setIsGapDownAnalysisOpen] = useState(false);

  // WORLD-CLASS FIX: Only get portfolio data (trades will be loaded by modal when opened)
  const { portfolioSize, getPortfolioSize } = useTruePortfolio();

  return (
    <>
      {/* Gap Down Analysis Button - positioned on the right */}
      <GapDownAnalysisButton
        onOpenAnalysis={() => setIsGapDownAnalysisOpen(true)}
        position="bottom-right"
      />

      {/* WORLD-CLASS FIX: Modal will load trades internally when opened */}
      <GapDownAnalysisModal
        isOpen={isGapDownAnalysisOpen}
        onOpenChange={setIsGapDownAnalysisOpen}
        portfolioSize={portfolioSize}
        getPortfolioSize={getPortfolioSize}
      />
    </>
  );
};
