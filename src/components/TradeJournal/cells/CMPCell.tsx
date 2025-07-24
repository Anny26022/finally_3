import React from 'react';
import { Input, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

export interface CMPCellProps {
  value: number;
  isAutoFetched?: boolean;
  onSave: (value: number) => void;
}

/**
 * CMPCell - Current Market Price cell with auto-fetch indicator (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Price input with currency formatting
 * - Auto-fetch indicator (robot icon)
 * - Manual override capability
 * - Keyboard navigation support
 */
export const CMPCell: React.FC<CMPCellProps> = React.memo(function CMPCell({
  value,
  isAutoFetched = false,
  onSave
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(value || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update editValue when value prop changes, but only when not editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value || ''));
    }
  }, [value, isEditing]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const numValue = Number(editValue);
    if (!isNaN(numValue)) {
      onSave(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(String(value || ''));
      setIsEditing(false);
    }
  };

  const handleFocus = () => {
    // Only allow editing when price fetching failed or value was manually entered
    // Don't allow editing when price was successfully auto-fetched
    if (!isEditing && isAutoFetched !== true) {
      setIsEditing(true);
    }
  };

  // Helper function for currency formatting
  const formatCurrency = (val: number) => {
    if (val === 0) return '0';
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <motion.div
      className="relative flex items-center gap-1"
      initial={false}
      animate={{ height: "auto" }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Input
              ref={inputRef}
              type="number"
              value={editValue}
              onValueChange={setEditValue}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              size="sm"
              variant="flat"
              classNames={{
                base: "w-full max-w-[120px]",
                input: "text-right font-medium text-small py-0 dark:text-white",
                inputWrapper: "h-7 min-h-unit-7 bg-content1 dark:bg-gray-900"
              }}
              step="0.05"
              min={0}
              startContent={<span className="text-xs text-gray-500">₹</span>}
            />
          </motion.div>
        ) : (
          <Tooltip
            content={
              <div className="text-xs">
                <div className="font-medium">Current Market Price</div>
                <div className="text-default-400">
                  {isAutoFetched === false
                    ? "Manually entered - click to edit"
                    : isAutoFetched === true
                      ? "Auto-fetched from market data - not editable"
                      : "Click to enter manually"
                  }
                </div>
              </div>
            }
            placement="top"
            delay={500}
          >
            <div
              onClick={handleFocus}
              className={`
                py-1 px-2 text-right rounded-md transition-colors
                flex items-center justify-end gap-1 whitespace-nowrap
                ${isAutoFetched === false
                  ? 'border-l-2 border-warning cursor-pointer hover:bg-default-100 dark:hover:bg-default-800'
                  : isAutoFetched === true
                    ? 'border-l-2 border-success cursor-not-allowed opacity-75'
                    : 'cursor-pointer hover:bg-default-100 dark:hover:bg-default-800'
                }
              `}
            >
              <span className="font-medium">
                {value > 0 ? `₹${formatCurrency(value)}` : '-'}
              </span>
              {isAutoFetched === false && (
                <Icon
                  icon="lucide:edit-3"
                  className="w-3 h-3 text-warning opacity-60"
                />
              )}
              {isAutoFetched === true && (
                <Icon
                  icon="lucide:refresh-cw"
                  className="w-3 h-3 text-success opacity-60"
                />
              )}
            </div>
          </Tooltip>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
