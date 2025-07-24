import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface PositionStatusCellProps {
  value: "Open" | "Closed" | "Partial";
  onSave: (value: "Open" | "Closed" | "Partial") => void;
}

/**
 * PositionStatusCell - Position status dropdown cell component (extracted from original)
 * 
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 */
export const PositionStatusCell: React.FC<PositionStatusCellProps> = React.memo(function PositionStatusCell({ value, onSave }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="flat"
          color={
            value === "Open" ? "primary" :
            value === "Closed" ? "success" : "warning"
          }
          className="min-w-[90px] h-7 capitalize"
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
          {value}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Position status selection"
        selectionMode="single"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as "Open" | "Closed" | "Partial";
          onSave(selected);
          setIsOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        autoFocus
      >
        <DropdownItem key="Open" textValue="Open">Open</DropdownItem>
        <DropdownItem key="Closed" textValue="Closed">Closed</DropdownItem>
        <DropdownItem key="Partial" textValue="Partial">Partial</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
});
