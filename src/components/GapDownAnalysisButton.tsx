import React, { useMemo } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Trade } from '../types/trade';

interface GapDownAnalysisButtonProps {
  onOpenAnalysis: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const GapDownAnalysisButton: React.FC<GapDownAnalysisButtonProps> = ({
  onOpenAnalysis,
  position = 'bottom-left'
}) => {
  // Temporarily disabled
  return null;

  // Filter for risky open positions only (SL only, no TSL)
  const riskyPositions = useMemo(() =>
    trades.filter(t =>
      (t.positionStatus === 'Open' || t.positionStatus === 'Partial') &&
      t.openQty > 0 &&
      (!t.tsl || t.tsl <= (t.sl || 0))
    ), [trades]
  );

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const hasRiskyPositions = riskyPositions.length > 0;

  return (
    <div className={`fixed ${positionClasses[position]} z-40`}>
      <Tooltip
        content={hasRiskyPositions
          ? `Risk Assessment (${riskyPositions.length})`
          : "All protected"
        }
        placement="top"
        size="sm"
      >
        <Button
          isIconOnly
          variant="flat"
          size="sm"
          className={`w-8 h-8 min-w-8 rounded-lg transition-all duration-300 backdrop-blur-sm border-0 ${
            hasRiskyPositions
              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default'
          }`}
          onPress={() => {
            if (hasRiskyPositions) {
              onOpenAnalysis();
            }
          }}
          isDisabled={!hasRiskyPositions}
        >
          <Icon
            icon={hasRiskyPositions ? "lucide:alert-triangle" : "lucide:shield-check"}
            className="w-4 h-4"
          />
        </Button>
      </Tooltip>
    </div>
  );
};
