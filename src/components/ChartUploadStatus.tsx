import React from 'react';
import { Icon } from '@iconify/react';
import { Chip } from '@heroui/react';
import { ChartImage } from '../types/trade';
import { getChartUploadStatus } from '../utils/temporaryChartStorage';

interface ChartUploadStatusProps {
  chartImage?: ChartImage;
  className?: string;
}

/**
 * Visual indicator showing the status of chart uploads
 * - None: No chart uploaded
 * - Temporary: Chart uploaded but stored temporarily (will save when trade is saved)
 * - Saved: Chart saved to cloud storage
 */
export const ChartUploadStatus: React.FC<ChartUploadStatusProps> = ({
  chartImage,
  className = ''
}) => {
  const { status, message, icon } = getChartUploadStatus(chartImage);

  const getChipProps = () => {
    switch (status) {
      case 'none':
        return {
          color: 'default' as const,
          variant: 'flat' as const,
          className: 'text-gray-500'
        };
      case 'temporary':
        return {
          color: 'warning' as const,
          variant: 'flat' as const,
          className: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
        };
      case 'saved':
        return {
          color: 'success' as const,
          variant: 'flat' as const,
          className: 'text-green-600 bg-green-50 dark:bg-green-900/20'
        };
      default:
        return {
          color: 'default' as const,
          variant: 'flat' as const
        };
    }
  };

  const chipProps = getChipProps();

  return (
    <Chip
      {...chipProps}
      size="sm"
      startContent={<Icon icon={icon} className="w-3 h-3" />}
      className={`${chipProps.className} ${className}`}
    >
      {message}
    </Chip>
  );
};

export default ChartUploadStatus;
