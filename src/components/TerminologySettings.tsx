import React from 'react';
import { Card, CardBody, CardHeader, RadioGroup, Radio, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTerminology, TerminologyType } from '../context/TerminologyContext';

export const TerminologySettings: React.FC = () => {
  const { terminology, setTerminology, isLoading } = useTerminology();

  const handleTerminologyChange = (value: string) => {
    setTerminology(value as TerminologyType);
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-6">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
            <span className="text-sm text-default-500">Loading terminology settings...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:type" className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Column Terminology</h3>
            <p className="text-sm text-default-500">Choose your preferred terminology for pyramid and exit columns</p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <RadioGroup
          value={terminology}
          onValueChange={handleTerminologyChange}
          className="gap-4"
        >
          <Radio value="pyramid" className="max-w-none">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Pyramid & Exit (Current)</span>
                <Chip size="sm" color="primary" variant="flat">Default</Chip>
              </div>
              <div className="text-sm text-default-500">
                Uses traditional trading terminology
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Chip size="sm" variant="bordered">P1, P2</Chip>
                <Chip size="sm" variant="bordered">E1, E2, E3</Chip>
              </div>
              <div className="text-xs text-default-400 mt-1">
                P = Pyramid entries, E = Exit positions
              </div>
            </div>
          </Radio>

          <Radio value="buysell" className="max-w-none">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Buy & Sell (Alternative)</span>
                <Chip size="sm" color="success" variant="flat">New</Chip>
              </div>
              <div className="text-sm text-default-500">
                Uses intuitive buy/sell terminology
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Chip size="sm" variant="bordered" color="success">B1, B2</Chip>
                <Chip size="sm" variant="bordered" color="danger">S1, S2, S3</Chip>
              </div>
              <div className="text-xs text-default-400 mt-1">
                B = Additional buys, S = Sell positions
              </div>
            </div>
          </Radio>
        </RadioGroup>

        <div className="mt-6 p-4 bg-default-50 dark:bg-default-100 rounded-lg">
          <div className="flex items-start gap-2">
            <Icon icon="lucide:info" className="w-4 h-4 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-default-700 mb-1">What changes?</p>
              <p className="text-default-600">
                This setting only changes the column headers and labels in your trade journal. 
                Your existing trade data remains unchanged and will work with both terminologies.
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
