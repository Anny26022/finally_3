import React from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { SupabaseService } from "../../../services/supabaseService";

export interface ProficiencyGrowthAreasCellProps {
  value: string;
  onSave: (value: string) => void;
}

// Default proficiency growth areas options - EXACT MATCH with original
const GROWTH_AREAS_OPTIONS = [
  'Booked Early',
  "Didn't Book Loss",
  'FOMO',
  'Illiquid Stock',
  'Illogical SL',
  'Lack of Patience',
  'Late Entry',
  'Momentum-less stock',
  'Overconfidence',
  'Overtrading',
  'Poor Exit',
  'Poor Po Size',
  'Poor Sector',
  'Poor Stock',
  'Shifted SL Suickly',
  'Too Early Entry',
  'Too Tight SL'
];

const GROWTH_AREAS_LOCAL_KEY = 'custom_growth_areas_options';

// Helper functions for backward compatibility
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
 * ProficiencyGrowthAreasCell - Growth areas dropdown cell with custom options (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Default growth areas options (Entry Timing, Exit Strategy, Risk Management, etc.)
 * - Custom option management (add/delete)
 * - Persistent storage via Supabase
 * - Multi-select support (comma-separated values)
 */
export const ProficiencyGrowthAreasCell: React.FC<ProficiencyGrowthAreasCellProps> = React.memo(function ProficiencyGrowthAreasCell({ value, onSave }) {
  const [customOptions, setCustomOptions] = React.useState<string[]>([]);
  const [availableDefaultOptions, setAvailableDefaultOptions] = React.useState<string[]>(GROWTH_AREAS_OPTIONS);
  const [isOpen, setIsOpen] = React.useState(false);
  const hasLoadedRef = React.useRef(false);
  const allOptions = React.useMemo(() => [
    ...availableDefaultOptions,
    ...customOptions
  ], [customOptions, availableDefaultOptions]);

  // Parse selected values (comma-separated)
  const selectedValues = React.useMemo(() => {
    if (!value || !value.trim()) return [];
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }, [value]);

  // 🚀 PERFORMANCE FIX: Use pre-fetched data instead of making requests
  React.useEffect(() => {
    if (hasLoadedRef.current) return; // Prevent multiple loads
    hasLoadedRef.current = true;

    // Use default options
    setAvailableDefaultOptions(GROWTH_AREAS_OPTIONS);
    setCustomOptions([]);
  }, []); // Run once on mount

  const handleAddOption = async (newValue: string) => {
    if (!newValue || !newValue.trim()) return;

    const trimmedValue = newValue.trim();
    if (allOptions.some(o => o.toLowerCase() === trimmedValue.toLowerCase())) {
      // If it's an existing option, just select it
      const newSelectedValues = [...selectedValues, trimmedValue];
      onSave(newSelectedValues.join(', '));
      return;
    }

    try {
      // Get current active preferences
      const currentActiveOptions = await SupabaseService.getMiscData('active_growth_areas_options');

      if (currentActiveOptions && Array.isArray(currentActiveOptions)) {
        // Add to active preferences and save
        const updatedActiveOptions = [...currentActiveOptions, trimmedValue];
        await SupabaseService.setMiscData('active_growth_areas_options', updatedActiveOptions);

        // Update local state to match
        setAvailableDefaultOptions(updatedActiveOptions);
        setCustomOptions([]);

        // Notify other components to refresh
        window.dispatchEvent(new CustomEvent('tagPreferencesUpdated'));
      } else {
        // Legacy fallback
        const newCustomOptions = [...customOptions, trimmedValue];
        setCustomOptions(newCustomOptions);
        saveMiscData(GROWTH_AREAS_LOCAL_KEY, newCustomOptions);
      }

      // Select the new option
      const newSelectedValues = [...selectedValues, trimmedValue];
      onSave(newSelectedValues.join(', '));
    } catch (error) {
      // Still select the option locally even if save failed
      const newSelectedValues = [...selectedValues, trimmedValue];
      onSave(newSelectedValues.join(', '));
    }
  };

  const handleDeleteCustomOption = async (optionToDelete: string) => {
    const confirmMessage = `Are you sure you want to permanently delete "${optionToDelete}"? This will remove it from all growth areas dropdowns.`;

    if (window.confirm(confirmMessage)) {
      try {
        // Get current active preferences
        const currentActiveOptions = await SupabaseService.getMiscData('active_growth_areas_options');

        if (currentActiveOptions && Array.isArray(currentActiveOptions)) {
          // Remove from active preferences and save
          const updatedActiveOptions = currentActiveOptions.filter(o => o !== optionToDelete);
          await SupabaseService.setMiscData('active_growth_areas_options', updatedActiveOptions);

          // Update local state to match
          setAvailableDefaultOptions(updatedActiveOptions);
          setCustomOptions([]);

          // GLOBAL CLEANUP: Clear this option from ALL trades
          await clearOptionFromAllTrades('proficiencyGrowthAreas', optionToDelete);

          // Notify other components to refresh
          window.dispatchEvent(new CustomEvent('tagPreferencesUpdated'));
        } else {
          // Legacy fallback
          const isDefaultOption = GROWTH_AREAS_OPTIONS.includes(optionToDelete);
          if (isDefaultOption) {
            const updatedDefaultOptions = availableDefaultOptions.filter(o => o !== optionToDelete);
            setAvailableDefaultOptions(updatedDefaultOptions);
            saveMiscData(`${GROWTH_AREAS_LOCAL_KEY}_defaults`, updatedDefaultOptions);
          } else {
            const updatedCustomOptions = customOptions.filter(o => o !== optionToDelete);
            setCustomOptions(updatedCustomOptions);
            saveMiscData(GROWTH_AREAS_LOCAL_KEY, updatedCustomOptions);
          }
        }

        // Remove from selected values if it was selected
        const newSelectedValues = selectedValues.filter(v => v !== optionToDelete);
        onSave(newSelectedValues.join(', '));
      } catch (error) {
      }
    }
  };

  const handleToggleOption = (option: string) => {
    const isSelected = selectedValues.includes(option);
    let newSelectedValues: string[];

    if (isSelected) {
      // Remove from selection
      newSelectedValues = selectedValues.filter(v => v !== option);
    } else {
      // Add to selection
      newSelectedValues = [...selectedValues, option];
    }

    onSave(newSelectedValues.join(', '));
  };

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="flat"
          color="default"
          className="min-w-[160px] h-7 justify-between"
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
          <span className="truncate">
            {selectedValues.length > 0
              ? selectedValues.length === 1
                ? selectedValues[0]
                : `${selectedValues.length} selected`
              : 'Select areas'
            }
          </span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Growth areas selection"
        selectionMode="multiple"
        selectedKeys={selectedValues}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys) as string[];
          onSave(selected.join(', '));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        autoFocus
        className="max-h-64 overflow-y-auto"
        closeOnSelect={false}
      >
        {/* Clear all option */}
        <DropdownItem
          key="__clear_all__"
          textValue="Clear all"
          className="text-gray-500 border-b border-divider"
          onAction={() => {
            onSave('');
          }}
        >
          <span className="italic">Clear all selections</span>
        </DropdownItem>

        {/* Available options */}
        {allOptions.map((option) => (
          <DropdownItem
            key={option}
            textValue={option}
            className="group"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Icon
                  icon={selectedValues.includes(option) ? "lucide:check-square" : "lucide:square"}
                  className="w-4 h-4"
                />
                <span>{option}</span>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteCustomOption(option);
                }}
                className="text-red-500 hover:text-red-700 ml-2 opacity-70 hover:opacity-100"
                title="Delete this growth area option"
              >
                <Icon icon="lucide:trash-2" className="w-3 h-3" />
              </button>
            </div>
          </DropdownItem>
        ))}

        {/* Add new growth area - Match original styling */}
        <DropdownItem
          key="__add_new_growth_area__"
          textValue="Add new growth area"
          className="border-t border-divider text-primary"
          onAction={() => {
            const newOption = prompt('Enter new growth area:');
            if (newOption) {
              handleAddOption(newOption);
            }
          }}
        >
          <div className="flex items-center gap-2">
            <Icon icon="lucide:plus" className="w-3 h-3" />
            <span>Add new growth area...</span>
          </div>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
});
