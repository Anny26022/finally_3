import React from 'react';
import { Textarea, Button, Popover, PopoverTrigger, PopoverContent, useDisclosure } from "@heroui/react";

export interface NotesCellProps {
  value: string;
  onSave: (value: string) => void;
  isWrapEnabled?: boolean;
}

/**
 * NotesCell - Rich notes editing cell with popover (extracted from original)
 *
 * EXACT COPY from original trade-journal.tsx with no modifications
 * to ensure 100% compatibility and functionality preservation.
 *
 * Features:
 * - Rich popover editing experience
 * - Character count and performance warnings
 * - Text wrapping toggle support
 * - Save/Cancel functionality
 */
export const NotesCell: React.FC<NotesCellProps> = React.memo(function NotesCell({ value, onSave, isWrapEnabled = false }) {
  const {isOpen, onOpenChange, onClose, onOpen} = useDisclosure();
  const [editValue, setEditValue] = React.useState(value);

  // When opening the popover, ensure the edit value is up-to-date with the cell's value
  React.useEffect(() => {
    if (isOpen) {
      setEditValue(value);
    }
  }, [isOpen, value]);

  const handleSave = () => {
    onSave(editValue);
    onClose();
  };

  const handleCancel = () => {
    setEditValue(value); // Reset any changes
    onClose();
  };

  const displayText = React.useMemo(() => {
    if (!value) return null;

    if (isWrapEnabled && value.length > 200) {
      return `${value.substring(0, 200)}...`;
    }
    return value;
  }, [value, isWrapEnabled]);

  const cellContent = (
    <div
      onClick={onOpen}
      className={`p-2 text-sm rounded-md cursor-pointer hover:bg-default-100 dark:hover:bg-default-900/40 transition-colors ${
        isWrapEnabled ? 'w-full' : 'w-full max-w-[350px]'
      }`}
    >
      {value ? (
        isWrapEnabled ? (
          <p className="leading-relaxed break-words whitespace-pre-wrap max-h-[120px] overflow-y-auto">
            {displayText}
          </p>
        ) : (
          <div className="leading-relaxed notes-truncate">
            {displayText}
          </div>
        )
      ) : (
        <span className="text-default-500">Add a note...</span>
      )}
    </div>
  );

  return (
    <Popover placement="bottom-start" isOpen={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger>
        <div>
          {cellContent}
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="w-[320px] p-4">
          <h4 className="font-bold text-lg mb-3">Trade Review & Notes</h4>
          <Textarea
            label="Notes"
            placeholder="Enter your review, observations, or thoughts..."
            value={editValue}
            onValueChange={setEditValue}
            minRows={6}
            maxRows={12}
            maxLength={2000}
            description={
              <div className="flex justify-between items-center">
                <span className={editValue.length > 1800 ? "text-warning" : ""}>
                  {editValue.length}/2000 characters
                </span>
                {editValue.length > 1800 && (
                  <span className="text-warning text-xs">
                    Very long notes may affect table performance
                  </span>
                )}
              </div>
            }
            classNames={{
              input: "resize-y"
            }}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button size="sm" variant="flat" color="danger" onPress={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" color="primary" onPress={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to ensure re-render when wrap setting changes
  return (
    prevProps.value === nextProps.value &&
    prevProps.isWrapEnabled === nextProps.isWrapEnabled &&
    prevProps.onSave === nextProps.onSave
  );
});
