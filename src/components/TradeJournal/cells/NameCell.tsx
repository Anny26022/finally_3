import React from 'react';
import { createPortal } from 'react-dom';

export interface NameCellProps {
  value: string;
  onSave: (value: string) => void;
}

// CSV URL for stock names
const csvUrl = '/name_sector_industry.csv';

/**
 * NameCell - Stock name cell with autocomplete functionality (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Autocomplete with stock names from CSV
 * - Fuzzy matching and suggestions
 * - Keyboard navigation (Arrow keys, Enter, Escape, Tab)
 * - Click outside to close
 * - Validation with confirmation dialogs
 */
export const NameCell: React.FC<NameCellProps> = React.memo(function NameCell({ value, onSave }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [filtered, setFiltered] = React.useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Update editValue when value prop changes, but only when not editing
  React.useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Move stockNames state and effect here
  const [stockNames, setStockNames] = React.useState<string[]>([]);
  React.useEffect(() => {
    async function loadStockNames() {
      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const Papa = (await import('papaparse')).default;
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const names = (results.data as any[]).map(row => row['Stock Name']).filter(Boolean);
          setStockNames(names);
        }
      });
    }
    loadStockNames();
  }, []);

  // Function to find closest matching stock name
  const findClosestMatch = (input: string): string | null => {
    if (!input || !stockNames.length) return null;

    const inputLower = input.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // First try exact prefix match
    const exactPrefixMatch = stockNames.find(name =>
      name.toLowerCase().startsWith(inputLower)
    );
    if (exactPrefixMatch) return exactPrefixMatch;

    // Then try contains match
    const containsMatch = stockNames.find(name =>
      name.toLowerCase().includes(inputLower)
    );
    if (containsMatch) return containsMatch;

    // Finally try fuzzy match
    for (const name of stockNames) {
      const nameLower = name.toLowerCase();
      let score = 0;
      let inputIndex = 0;

      // Calculate similarity score
      for (let i = 0; i < nameLower.length && inputIndex < inputLower.length; i++) {
        if (nameLower[i] === inputLower[inputIndex]) {
          score++;
          inputIndex++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = name;
      }
    }

    // Only return match if it's reasonably similar
    return bestScore > (inputLower.length / 2) ? bestMatch : null;
  };

  React.useEffect(() => {
    if (isEditing && editValue) {
      const matches = stockNames.filter(n =>
        n.toLowerCase().includes(editValue.toLowerCase())
      );
      setFiltered(matches.slice(0, 10));
      setShowDropdown(matches.length > 0);
      setSelectedIndex(-1);
    } else {
      setShowDropdown(false);
    }
  }, [editValue, isEditing, stockNames]);

  // Ensure input stays focused when dropdown is shown
  React.useEffect(() => {
    if (isEditing && inputRef.current && showDropdown) {
      inputRef.current.focus();
    }
  }, [isEditing, showDropdown]);

  // Auto-start editing when focused via tab navigation
  const handleAutoEdit = React.useCallback(() => {
    if (!isEditing) {
      setIsEditing(true);
      setEditValue(value);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select all text for easy replacement
        }
      }, 50);
    }
  }, [isEditing, value]);

  const handleSave = (val?: string) => {
    const finalValue = val ?? editValue;

    // Allow empty values to be saved (clearing the field)
    if (!finalValue.trim()) {
      onSave(''); // Save empty string
      setIsEditing(false);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    // Check if the value exists in stockNames
    const exactMatch = stockNames.find(
      name => name.toLowerCase() === finalValue.toLowerCase()
    );

    if (exactMatch) {
      onSave(exactMatch); // Use the exact case from database
    } else {
      // Try to find closest match
      const closestMatch = findClosestMatch(finalValue);
      if (closestMatch) {
        const confirmed = window.confirm(
          `"${finalValue}" not found. Did you mean "${closestMatch}"?`
        );
        if (confirmed) {
          onSave(closestMatch);
        } else {
          // Revert to previous value if user declines suggestion
           setEditValue(value);
        }
      } else {
         const addNew = window.confirm(`"${finalValue}" is not a valid stock name. Do you want to add it?`);
         if(addNew){
          onSave(finalValue.toUpperCase());
         } else {
          setEditValue(value); // Revert to previous value
         }
      }
    }
    setIsEditing(false);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = document.getElementById(`stock-suggestion-${selectedIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  // Update dropdown position on scroll/resize to prevent clipping
  React.useEffect(() => {
    if (!showDropdown || !inputRef.current || !dropdownRef.current) return;

    const updatePosition = () => {
      if (inputRef.current && dropdownRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const dropdown = dropdownRef.current;

        dropdown.style.top = `${rect.bottom + 2}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${Math.max(220, rect.width)}px`;
      }
    };

    // Update position immediately
    updatePosition();

    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDropdown]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setIsEditing(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) {
      // Allow normal typing when dropdown is not shown
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        setShowDropdown(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = prev + 1;
          const newIndex = next >= filtered.length ? 0 : next;
          // Scroll to selected item
          setTimeout(() => {
            const selectedElement = dropdownRef.current?.querySelector(`[data-index="${newIndex}"]`);
            selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => {
          const next = prev - 1;
          const newIndex = next < 0 ? filtered.length - 1 : next;
          // Scroll to selected item
          setTimeout(() => {
            const selectedElement = dropdownRef.current?.querySelector(`[data-index="${newIndex}"]`);
            selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 0);
          return newIndex;
        });
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (selectedIndex >= 0 && filtered[selectedIndex]) {
          handleSave(filtered[selectedIndex]);
        } else if (filtered.length === 1) {
          handleSave(filtered[0]);
        } else {
          handleSave();
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(false);
        setSelectedIndex(-1);
        setIsEditing(false);
        break;
      case 'Tab':
        if (selectedIndex >= 0 && filtered[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          handleSave(filtered[selectedIndex]);
        }
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(filtered.length - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 5, filtered.length - 1));
        break;
      case 'PageUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 5, 0));
        break;
    }
  };

  if (isEditing) {
    return (
      <div className="relative min-w-[220px]">
        <input
          ref={inputRef}
          type="text"
          className="w-full min-w-[220px] px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={(e) => {
            // Don't close if focus is moving to the dropdown
            if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
              setTimeout(() => handleSave(), 150);
            }
          }}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        {showDropdown && createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[99999] min-w-[220px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto overflow-x-auto"
            style={{
              top: inputRef.current ? inputRef.current.getBoundingClientRect().bottom + 2 : 0,
              left: inputRef.current ? inputRef.current.getBoundingClientRect().left : 0,
              width: inputRef.current ? Math.max(220, inputRef.current.getBoundingClientRect().width) : 220,
            }}
            role="listbox"
            tabIndex={-1}
            onMouseDown={(e) => {
              // Prevent input from losing focus when clicking dropdown
              e.preventDefault();
            }}
          >
            {filtered.map((name, i) => (
              <div
                key={name}
                data-index={i}
                id={`stock-suggestion-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                className={`px-3 py-1.5 text-sm cursor-pointer whitespace-nowrap ${
                  i === selectedIndex
                    ? 'bg-blue-100 dark:bg-blue-900'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-800'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSave(name);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={(e) => {
                  e.preventDefault();
                  handleSave(name);
                }}
              >
                {name}
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  return (
    <div
      className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-text"
      onClick={() => setIsEditing(true)}
      onFocus={handleAutoEdit}
      tabIndex={0}
    >
      {value || <span className="text-gray-400">Stock name</span>}
    </div>
  );
});
