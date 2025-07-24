/**
 * Cell Components - Extracted from original trade-journal.tsx
 * 
 * These components maintain their exact original names and functionality
 * for seamless integration with the refactored architecture.
 * 
 * NAMING CONVENTION:
 * All component names match exactly with the original implementation
 * to ensure backward compatibility and easy migration.
 */

// Core editable cell component
export { EditableCell } from './EditableCell';

// Dropdown-based cell components
export { BuySellCell } from './BuySellCell';
export { PositionStatusCell } from './PositionStatusCell';
export { PlanFollowedCell } from './PlanFollowedCell';

// Text input cell components
export { NameCell } from './NameCell';
export { NotesCell } from './NotesCell';

// Dropdown with custom options
export { SetupCell } from './SetupCell';
export { ExitTriggerCell } from './ExitTriggerCell';
export { ProficiencyGrowthAreasCell } from './ProficiencyGrowthAreasCell';

// Special purpose cells
export { CMPCell } from './CMPCell';
export { StockCell } from './StockCell';

// Type exports for external usage
export type { EditableCellProps } from './EditableCell';
export type { BuySellCellProps } from './BuySellCell';
export type { PositionStatusCellProps } from './PositionStatusCell';
export type { PlanFollowedCellProps } from './PlanFollowedCell';
export type { NameCellProps } from './NameCell';
export type { NotesCellProps } from './NotesCell';
export type { SetupCellProps } from './SetupCell';
export type { ExitTriggerCellProps } from './ExitTriggerCell';
export type { ProficiencyGrowthAreasCellProps } from './ProficiencyGrowthAreasCell';
export type { CMPCellProps } from './CMPCell';
export type { StockCellProps } from './StockCell';
