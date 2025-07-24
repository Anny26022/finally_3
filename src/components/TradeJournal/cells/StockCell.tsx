import React from 'react';
import { EditableCell } from './EditableCell';

export interface StockCellProps {
  name: string;
  setup: string;
  onSave: (field: "name" | "setup", value: string | number) => void;
}

/**
 * StockCell - Stock name cell component (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 */
export const StockCell: React.FC<StockCellProps> = ({ name, setup, onSave }) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="max-w-[200px]">
        <EditableCell
          value={name}
          onSave={(value) => onSave("name", value)}
        />
      </div>
    </div>
  );
};
