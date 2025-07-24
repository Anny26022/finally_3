import React from 'react';
import { Card, CardBody, RadioGroup, Radio, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTerminology, TerminologyType } from '../context/TerminologyContext';

export const TerminologySettingsCompact: React.FC = () => {
  const { terminology, setTerminology, isLoading } = useTerminology();

  const handleTerminologyChange = async (value: string) => {
    await setTerminology(value as TerminologyType);
  };

  if (isLoading) {
    return (
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:loader-2" className="w-4 h-4 animate-spin" />
            <span className="text-sm text-default-500">Loading terminology settings...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-default-50 dark:bg-default-100">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <Icon icon="lucide:type" className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="mb-2">
              <h4 className="text-sm font-semibold">Column Terminology</h4>
            </div>
            <p className="text-xs text-default-500 mb-3">
              Choose your preferred terminology for pyramid and exit columns
            </p>
            
            <RadioGroup
              value={terminology}
              onValueChange={handleTerminologyChange}
              orientation="horizontal"
              className="gap-4"
              size="sm"
            >
              <Radio value="pyramid" className="flex-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Pyramid & Exit</span>
                  </div>
                  <div className="flex gap-1">
                    <Chip size="sm" variant="bordered" className="text-xs">P1, P2</Chip>
                    <Chip size="sm" variant="bordered" className="text-xs">E1, E2, E3</Chip>
                  </div>
                </div>
              </Radio>

              <Radio value="buysell" className="flex-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Buy & Sell</span>
                  </div>
                  <div className="flex gap-1">
                    <Chip size="sm" variant="bordered" className="text-xs">B1, B2</Chip>
                    <Chip size="sm" variant="bordered" className="text-xs">S1, S2, S3</Chip>
                  </div>
                </div>
              </Radio>
            </RadioGroup>

            <div className="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-md">
              <div className="flex items-start gap-2">
                <Icon icon="lucide:info" className="w-3 h-3 text-primary mt-0.5" />
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  Changes apply immediately to all column headers. Your data remains unchanged.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
