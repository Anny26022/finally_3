import React from 'react';
import { Input } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";

export interface EditableCellProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: "text" | "number" | "price" | "date" | "select";
  colorValue?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  tradeId?: string;
  field?: string;
}

/**
 * EditableCell - Core editable cell component (extracted from original)
 * 
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 */
export const EditableCell: React.FC<EditableCellProps> = React.memo(function EditableCell({
  value,
  onSave,
  type = "text",
  colorValue = false,
  min,
  max,
  options,
  tradeId,
  field
}) {
  const [isEditing, setIsEditing] = React.useState(false);

  // Format date as dd-mm-yyyy for display and editing
  const formatDateForDisplay = (dateStr: string) => {
    try {
      if (!dateStr || dateStr.trim() === '') return '';

      // If already in DD-MM-YYYY format, return as is
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        return dateStr;
      }

      // Handle other formats
      let date: Date;
      if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('-').map(Number);
        date = new Date(year, month - 1, day);
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('.').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(dateStr);
      }

      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
    } catch (e) {
      return '';
    }
  };

  // Convert dd-mm-yyyy to yyyy-mm-dd for the native date input
  const convertToISODate = (displayDate: string) => {
    try {
      if (!displayDate || displayDate.trim() === '') return '';
      const parts = displayDate.split('-');
      if (parts.length !== 3) return '';
      const [day, month, year] = parts;
      if (!day || !month || !year || day === 'undefined' || month === 'undefined' || year === 'undefined') return '';
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch (e) {
      return '';
    }
  };

  // Convert yyyy-mm-dd to ISO string
  const convertToFullISO = (dateStr: string) => {
    try {
      return new Date(dateStr).toISOString();
    } catch (e) {
      return '';
    }
  };

  const getInitialEditValue = React.useCallback(() => {
    if (type === 'date') {
      if (!value || value === '' || value === null || value === undefined) {
        return '';
      }
      return formatDateForDisplay(value as string);
    }
    return String(value ?? '');
  }, [type, value]);

  const [editValue, setEditValue] = React.useState(() => getInitialEditValue());
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Track editing state with ref to prevent unwanted updates during editing
  const isEditingRef = React.useRef(false);

  // Update the ref when editing state changes
  React.useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  // Update editValue when value prop changes, but only when not editing
  React.useEffect(() => {
    // Only update if not currently editing and the value has actually changed
    if (!isEditing && !isEditingRef.current) {
      const newEditValue = getInitialEditValue();
      if (newEditValue !== editValue) {
        setEditValue(newEditValue);
      }
    }
  }, [value, type, isEditing, getInitialEditValue, editValue]);

  const handleSave = () => {
    // Update refs and state to exit editing mode
    isEditingRef.current = false;
    setIsEditing(false);

    if (type === "number" || type === "price") {
      onSave(Number(editValue));
    } else if (type === "date") {
      if (editValue) {
        // Convert the dd-mm-yyyy to ISO string
        const isoDate = convertToFullISO(convertToISODate(editValue));
        onSave(isoDate);
      } else {
        onSave("");
      }
    } else {
      onSave(editValue);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Date selection completes editing
    isEditingRef.current = false;
    const isoDate = e.target.value; // yyyy-mm-dd
    if (isoDate) {
      const displayDate = formatDateForDisplay(isoDate);
      setEditValue(displayDate);
      onSave(convertToFullISO(isoDate));
    } else {
      setEditValue('');
      onSave('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(String(value));
    }
  };

  const getValueColor = () => {
    if (!colorValue || type !== "price") return "";
    const numValue = Number(value);
    return numValue < 0 ? "text-danger" : numValue > 0 ? "text-success" : "";
  };

  const handleFocus = () => {
    if (!isEditing) {
      // Update ref immediately to prevent race conditions
      isEditingRef.current = true;
      setEditValue(getInitialEditValue());
      setIsEditing(true);
    }
  };

  const inputTypeForHero = (): "text" | "number" | "date" => {
    if (type === "price") return "number";
    if (type === "select") return "text";
    return type as "text" | "number" | "date";
  };

  // Helper function for currency formatting (simplified version)
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <motion.div
      className="relative"
      initial={false}
      animate={{ height: "auto" }}
      transition={{ duration: 0.2 }}
      data-editable-cell={tradeId && field ? "true" : undefined}
      data-trade-id={tradeId}
      data-field={field}
      tabIndex={tradeId && field ? 0 : undefined}
    >
      <AnimatePresence mode="wait">
        {type === "date" ? (
          <input
            type="date"
            className="h-7 px-2 rounded-md bg-content1 dark:bg-gray-900 dark:text-white text-sm font-medium focus:outline-none hover:bg-content2 dark:hover:bg-gray-800 transition-colors cursor-pointer w-[130px]"
            value={convertToISODate(editValue)}
            onChange={handleDateChange}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                type={inputTypeForHero()}
                value={editValue}
                onValueChange={(value) => {
                  // Ensure ref is set during typing to prevent unwanted updates
                  isEditingRef.current = true;
                  setEditValue(value);
                }}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                size="sm"
                variant="flat"
                classNames={{
                  base: "w-full max-w-[160px]",
                  input: "text-right font-medium text-small py-0 dark:text-white",
                  inputWrapper: "h-7 min-h-unit-7 bg-content1 dark:bg-gray-900"
                }}

                step={type === "price" ? "0.05" : undefined}
                min={min !== undefined ? min : (type === "price" ? 0 : undefined)}
                max={max !== undefined ? max : undefined}
              />
            ) : (
              <motion.div
                className="py-1 px-2 rounded-md cursor-text hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors w-full max-w-[160px] border border-transparent hover:border-primary-200 dark:hover:border-primary-800 bg-primary-25/30 dark:bg-primary-900/5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  // Update ref immediately to prevent race conditions
                  isEditingRef.current = true;
                  setEditValue(getInitialEditValue());
                  setIsEditing(true);
                }}
                tabIndex={0}
                data-trade-id={tradeId}
                data-field={field}
                onFocus={handleFocus}
                onKeyDown={(e) => {
                  // Prevent default tab behavior since we handle it globally
                  if (e.key === 'Tab') {
                    e.preventDefault();
                  }
                  // Allow Enter to start editing
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFocus();
                  }
                }}
              >
                <div className="flex items-center gap-1">
                  <span className={`font-medium text-small whitespace-nowrap ${getValueColor()}`}>
                    {type === "price" ? `₹${formatCurrency(value as number)}` : String(value)}
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
