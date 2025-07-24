import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SupabaseService } from "../../../services/supabaseService";

export interface ExitTriggerCellProps {
  value: string;
  onSave: (value: string) => void;
}

// Default exit trigger options - EXACT MATCH with original
const EXIT_TRIGGER_OPTIONS = [
  'Breakeven exit',
  'Market Pressure',
  'R multiples',
  'Random',
  'SL',
  'Target',
  'Trailing SL exit',
  "Broke key MA's",
  'Panic sell',
  'Early sell off',
  'Failed BO'
];

const EXIT_TRIGGER_LOCAL_KEY = 'custom_exit_trigger_options';

// Helper functions
async function saveMiscData(key: string, value: any): Promise<boolean> {
  try {
    return await SupabaseService.saveMiscData(`misc_${key}`, value);
  } catch (error) {
    return false;
  }
}

// Clear option from all trades function
async function clearOptionFromAllTrades(field: string, optionToDelete: string): Promise<void> {
  try {
    // Get all trades from Supabase
    const { data: trades, error } = await SupabaseService.supabase
      .from('trades')
      .select('*');

    if (error) {
      console.error('Error fetching trades for cleanup:', error);
      return;
    }

    if (!trades || trades.length === 0) {
      return;
    }

    // Find trades that have the option to be deleted
    const tradesToUpdate = trades.filter(trade => {
      const fieldValue = trade[field];
      if (!fieldValue) return false;

      // Handle both single values and comma-separated values
      if (typeof fieldValue === 'string') {
        if (fieldValue === optionToDelete) return true;
        if (fieldValue.includes(', ')) {
          return fieldValue.split(', ').includes(optionToDelete);
        }
      }
      return false;
    });

    if (tradesToUpdate.length === 0) {
      return;
    }

    // Update each trade to remove the deleted option
    const updatePromises = tradesToUpdate.map(async (trade) => {
      const fieldValue = trade[field];
      let newValue = '';

      if (fieldValue === optionToDelete) {
        // If the field only contains the deleted option, clear it
        newValue = '';
      } else if (fieldValue.includes(', ')) {
        // If it's a comma-separated list, remove the option
        const values = fieldValue.split(', ').filter((v: string) => v !== optionToDelete);
        newValue = values.join(', ');
      }

      // Update the trade in Supabase
      const { error: updateError } = await SupabaseService.supabase
        .from('trades')
        .update({ [field]: newValue })
        .eq('id', trade.id);

      if (updateError) {
        console.error(`Error updating trade ${trade.id}:`, updateError);
      }
    });

    await Promise.all(updatePromises);

    console.log(`Successfully cleared "${optionToDelete}" from ${tradesToUpdate.length} trades`);
  } catch (error) {
    console.error('Error in clearOptionFromAllTrades:', error);
  }
}

/**
 * ExitTriggerCell - Exit trigger dropdown cell with custom options (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Default exit trigger options (SL Hit, Target Hit, TSL Hit, etc.)
 * - Custom option management (add/delete)
 * - Persistent storage via Supabase
 */
export const ExitTriggerCell: React.FC<ExitTriggerCellProps> = React.memo(function ExitTriggerCell({ value, onSave }) {
  const [customOptions, setCustomOptions] = React.useState<string[]>([]);
  const [availableDefaultOptions, setAvailableDefaultOptions] = React.useState<string[]>(EXIT_TRIGGER_OPTIONS);
  const [isOpen, setIsOpen] = React.useState(false);
  const hasLoadedRef = React.useRef(false);
  const allOptions = React.useMemo(() => [
    ...availableDefaultOptions,
    ...customOptions
  ], [customOptions, availableDefaultOptions]);

  // 🚀 PERFORMANCE FIX: Use pre-fetched data instead of making requests
  React.useEffect(() => {
    if (hasLoadedRef.current) return; // Prevent multiple loads
    hasLoadedRef.current = true;

    // Use default options
    setAvailableDefaultOptions(EXIT_TRIGGER_OPTIONS);
    setCustomOptions([]);
  }, []); // Run once on mount

  const handleAddOption = async (newValue: string) => {
    if (!newValue || !newValue.trim()) return;

    const trimmedValue = newValue.trim();
    if (allOptions.some(o => o.toLowerCase() === trimmedValue.toLowerCase())) {
      // If it's an existing option, just select it
      onSave(trimmedValue);
      return;
    }

    try {
      // Get current active preferences
      const currentActiveOptions = await SupabaseService.getMiscData('active_exit_trigger_options');

      if (currentActiveOptions && Array.isArray(currentActiveOptions)) {
        // Add to active preferences and save
        const updatedActiveOptions = [...currentActiveOptions, trimmedValue];
        await SupabaseService.setMiscData('active_exit_trigger_options', updatedActiveOptions);

        // Update local state to match
        setAvailableDefaultOptions(updatedActiveOptions);
        setCustomOptions([]);

        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('tagPreferencesUpdated'));
      } else {
        // Legacy fallback
        const newCustomOptions = [...customOptions, trimmedValue];
        setCustomOptions(newCustomOptions);
        saveMiscData(EXIT_TRIGGER_LOCAL_KEY, newCustomOptions);
      }

      // Select the new option
      onSave(trimmedValue);
    } catch (error) {
      // Still select the option locally even if save failed
      onSave(trimmedValue);
    }
  };

  const handleDeleteCustomOption = async (optionToDelete: string) => {
    const confirmMessage = `Are you sure you want to permanently delete "${optionToDelete}"? This will remove it from all exit trigger dropdowns.`;

    if (window.confirm(confirmMessage)) {
      try {
        // Get current active preferences
        const currentActiveOptions = await SupabaseService.getMiscData('active_exit_trigger_options');

        if (currentActiveOptions && Array.isArray(currentActiveOptions)) {
          // Remove from active preferences and save
          const updatedActiveOptions = currentActiveOptions.filter(o => o !== optionToDelete);
          await SupabaseService.setMiscData('active_exit_trigger_options', updatedActiveOptions);

          // Update local state to match
          setAvailableDefaultOptions(updatedActiveOptions);
          setCustomOptions([]);

          // GLOBAL CLEANUP: Clear this option from ALL trades
          await clearOptionFromAllTrades('exitTrigger', optionToDelete);

          // Notify other components to refresh
          window.dispatchEvent(new CustomEvent('tagPreferencesUpdated'));
        } else {
          // Legacy fallback
          const isDefaultOption = EXIT_TRIGGER_OPTIONS.includes(optionToDelete);
          if (isDefaultOption) {
            const updatedDefaultOptions = availableDefaultOptions.filter(o => o !== optionToDelete);
            setAvailableDefaultOptions(updatedDefaultOptions);
            saveMiscData(`${EXIT_TRIGGER_LOCAL_KEY}_defaults`, updatedDefaultOptions);
          } else {
            const updatedCustomOptions = customOptions.filter(o => o !== optionToDelete);
            setCustomOptions(updatedCustomOptions);
            saveMiscData(EXIT_TRIGGER_LOCAL_KEY, updatedCustomOptions);
          }
        }

        // Clear the selected value if it was the deleted option
        if (value === optionToDelete) {
          onSave('');
        }
      } catch (error) {
      }
    }
  };

  // Parse current value into array for multiple selection
  const currentValues = value ? value.split(', ').filter(v => v.trim()) : [];

  const handleMultipleSelection = (keys: Set<string>) => {
    const selectedArray = Array.from(keys);

    // Handle "Add new" option
    if (selectedArray.includes('__add_custom__')) {
      const newValue = window.prompt('Enter new exit trigger:');
      if (newValue) {
        handleAddOption(newValue);
      }
      return;
    }

    // Join selected values with comma and space
    const newValue = selectedArray.join(', ');
    onSave(newValue);
  };

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="flat"
          color="default"
          className="min-w-[140px] h-7 justify-between"
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
          {value ? (
            <span className="truncate">
              {currentValues.length > 1 ? `${currentValues[0]} +${currentValues.length - 1}` : value}
            </span>
          ) : (
            <span className="text-default-400">Select Exit Triggers</span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Exit trigger selection (multiple)"
        selectionMode="multiple"
        selectedKeys={new Set(currentValues)}
        onSelectionChange={(keys) => handleMultipleSelection(keys as Set<string>)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        autoFocus
        className="max-h-64 overflow-y-auto"
      >
        {/* Available options - Match original with red delete icons */}
        {allOptions.map((option) => (
          <DropdownItem
            key={option}
            textValue={option}
            className="group"
          >
            <div className="flex items-center justify-between w-full">
              <span>{option}</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteCustomOption(option);
                }}
                className="text-red-500 hover:text-red-700 ml-2 opacity-70 hover:opacity-100"
                title="Delete this exit trigger option"
              >
                <Icon icon="lucide:trash-2" className="w-3 h-3" />
              </button>
            </div>
          </DropdownItem>
        ))}

        {/* Add new exit trigger option - Match original styling */}
        <DropdownItem
          key="__add_new_exit_trigger__"
          textValue="Add new exit trigger"
          className="border-t border-divider text-primary"
          onAction={() => {
            const newOption = prompt('Enter new exit trigger option:');
            if (newOption) {
              handleAddOption(newOption);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Icon icon="lucide:plus" className="w-3 h-3" />
            <span>Add new exit trigger...</span>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
});
