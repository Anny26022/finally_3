import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTruePortfolio } from '../utils/TruePortfolioContext';

export const DuplicateCleanupTool: React.FC = () => {
  const { cleanupDuplicates } = useTruePortfolio();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    yearlyCapitals: { before: number; after: number };
    capitalChanges: { before: number; after: number };
    monthlyOverrides: { before: number; after: number };
  } | null>(null);

  const handleCleanup = async () => {
    setIsLoading(true);
    try {
      const cleanupResults = await cleanupDuplicates();
      setResults(cleanupResults);
      // Debug logging removed for production
    } catch (error) {
      // Debug logging removed for production
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex gap-3">
        <Icon icon="lucide:trash-2" className="text-2xl text-danger" />
        <div className="flex flex-col">
          <p className="text-md font-semibold">Duplicate Cleanup Tool</p>
          <p className="text-small text-default-500">Remove duplicate entries</p>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <p className="text-sm text-default-600">
            This tool will remove duplicate entries from:
          </p>
          <ul className="text-sm text-default-600 space-y-1 ml-4">
            <li>• Yearly starting capitals</li>
            <li>• Capital changes</li>
            <li>• Monthly overrides</li>
          </ul>
          
          {results && (
            <div className="bg-success-50 dark:bg-success-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium text-success-700 dark:text-success-300 mb-2">
                ✅ Cleanup Results:
              </p>
              <div className="text-xs text-success-600 dark:text-success-400 space-y-1">
                <div>Yearly Capitals: {results.yearlyCapitals.before} → {results.yearlyCapitals.after}</div>
                <div>Capital Changes: {results.capitalChanges.before} → {results.capitalChanges.after}</div>
                <div>Monthly Overrides: {results.monthlyOverrides.before} → {results.monthlyOverrides.after}</div>
              </div>
            </div>
          )}
          
          <Button
            color="danger"
            variant="solid"
            startContent={<Icon icon="lucide:trash-2" />}
            onClick={handleCleanup}
            isLoading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Cleaning up...' : 'Clean Up Duplicates'}
          </Button>
          
          <p className="text-xs text-default-500">
            ⚠️ This action cannot be undone. Make sure you have a backup if needed.
          </p>
        </div>
      </CardBody>
    </Card>
  );
};
