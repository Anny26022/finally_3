import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface PlanFollowedCellProps {
  value: boolean;
  onSave: (value: boolean) => void;
}

/**
 * PlanFollowedCell - Plan followed dropdown cell (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Yes/No dropdown selection
 * - Color-coded display (green for Yes, red for No)
 * - Keyboard navigation support
 */
export const PlanFollowedCell: React.FC<PlanFollowedCellProps> = React.memo(function PlanFollowedCell({ value, onSave }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="flat"
          color={value ? "success" : "danger"}
          className="min-w-[80px] h-7"
          endContent={<Icon icon="lucide:chevron-down" className="w-3.5 h-3.5" />}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
            } else if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setTimeout(() => setIsOpen(true), 100);
          }}
        >
          {value ? 'Yes' : 'No'}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Plan followed selection"
        selectionMode="single"
        selectedKeys={[value ? 'true' : 'false']}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as string;
          onSave(selected === 'true');
          setIsOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        autoFocus
      >
        <DropdownItem key="true" textValue="Yes">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:check" className="w-4 h-4 text-green-600" />
            <span>Yes</span>
          </div>
        </DropdownItem>
        <DropdownItem key="false" textValue="No">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:x" className="w-4 h-4 text-red-600" />
            <span>No</span>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
});
