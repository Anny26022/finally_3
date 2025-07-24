import React from 'react';
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTerminology, TerminologyType } from '../context/TerminologyContext';

export const TerminologyToggle: React.FC = () => {
  const { terminology, setTerminology, isLoading, debugPersistence } = useTerminology();

  const handleTerminologyChange = async (key: string | number) => {
    await setTerminology(key as TerminologyType);

    // Debug: Verify persistence after change
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        debugPersistence();
      }, 100);
    }
  };

  if (isLoading) {
    return (
      <Button
        isIconOnly
        variant="light"
        size="sm"
        isLoading
        className="w-8 h-8 min-w-8"
      />
    );
  }

  const currentLabel = terminology === 'buysell' ? 'B/S' : 'P/E';
  const currentColor = terminology === 'buysell' ? 'success' : 'primary';

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          variant="light"
          size="sm"
          className="w-6 h-6 min-w-6 rounded p-0.5 hover:bg-primary/10 transition"
          isIconOnly
        >
          <span className="text-xs font-medium text-primary">
            {currentLabel}
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Column terminology selection"
        selectedKeys={[terminology]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0];
          if (selectedKey) {
            handleTerminologyChange(selectedKey);
          }
        }}
        className="min-w-64"
      >
        <DropdownItem
          key="pyramid"
          textValue="Pyramid & Exit - Traditional terminology"
          startContent={<Icon icon="lucide:layers" className="w-4 h-4 text-primary" />}
          endContent={
            <div className="flex gap-1">
              <Chip size="sm" variant="bordered" className="text-xs">P1, P2</Chip>
              <Chip size="sm" variant="bordered" className="text-xs">E1, E2, E3</Chip>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="font-medium">Pyramid & Exit</span>
            <span className="text-xs text-default-500">Traditional terminology</span>
          </div>
        </DropdownItem>
        
        <DropdownItem
          key="buysell"
          textValue="Buy & Sell - Intuitive terminology"
          startContent={<Icon icon="lucide:trending-up" className="w-4 h-4 text-success" />}
          endContent={
            <div className="flex gap-1">
              <Chip size="sm" variant="bordered" color="success" className="text-xs">B1, B2</Chip>
              <Chip size="sm" variant="bordered" color="danger" className="text-xs">S1, S2, S3</Chip>
            </div>
          }
        >
          <div className="flex flex-col">
            <span className="font-medium">Buy & Sell</span>
            <span className="text-xs text-default-500">Intuitive terminology</span>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};
