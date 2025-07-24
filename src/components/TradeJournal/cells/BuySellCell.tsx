import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface BuySellCellProps {
  value: "Buy" | "Sell";
  onSave: (value: "Buy" | "Sell") => void;
}

/**
 * BuySellCell - Buy/Sell dropdown cell component (extracted from original)
 * 
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 */
export const BuySellCell: React.FC<BuySellCellProps> = React.memo(function BuySellCell({ value, onSave }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant={value === "Buy" ? "flat" : "bordered"}
          color={value === "Buy" ? "success" : "danger"}
          className="min-w-[80px] h-7"
          endContent={<Icon icon="lucide:chevron-down" className="w-3.5 h-3.5" />}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault(); // Let global handler manage tab navigation
            } else if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            // Auto-open dropdown when focused via tab navigation
            setTimeout(() => setIsOpen(true), 100);
          }}
        >
          {value}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Buy/Sell selection"
        selectionMode="single"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as "Buy" | "Sell";
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
        <DropdownItem key="Buy" textValue="Buy">Buy</DropdownItem>
        <DropdownItem key="Sell" textValue="Sell">Sell</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
});
