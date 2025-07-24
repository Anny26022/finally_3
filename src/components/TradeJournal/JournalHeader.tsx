import React from 'react';
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
  Tooltip
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import { DebouncedInput } from '../DebouncedInput';
import { ProcessingProgressCompact } from '../ProcessingProgress';

interface JournalHeaderProps {
  // Search and filter state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;

  // Column visibility
  visibleColumns: Set<string>;
  setVisibleColumns: (columns: Set<string>) => void;

  // Action handlers - match original exactly (no Gap Analysis)
  onAddTrade: () => void;
  onImportTrades: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;

  // Stats masking
  isStatsMasked: boolean;
  toggleStatsMask: () => void;

  // Chart viewer
  onOpenUniversalChartViewer: () => void;

  // Loading states
  isLoading?: boolean;
  isRecalculating?: boolean;

  // ✅ NEW: Progress tracking
  progress?: number;
  stage?: string;
  isComplete?: boolean;
}

/**
 * JournalHeader - Extracted header component containing search, filters, and action buttons
 * 
 * ARCHITECTURAL BENEFITS:
 * - Single responsibility: Only handles header UI and user interactions
 * - Isolated state: Search and filter changes only re-render this component
 * - Reusable: Can be used in different contexts (fullscreen, modal, etc.)
 * - Testable: Easy to unit test individual header functionality
 */
export const JournalHeader: React.FC<JournalHeaderProps> = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  visibleColumns,
  setVisibleColumns,
  onAddTrade,
  onImportTrades,
  onExportCSV,
  onExportExcel,
  isStatsMasked,
  toggleStatsMask,
  onOpenUniversalChartViewer,
  isLoading = false,
  isRecalculating = false
}) => {
  // Column options for visibility toggle - match allColumns exactly
  const columnOptions = [
    { key: "tradeNo", label: "Trade No" },
    { key: "date", label: "Date" },
    { key: "name", label: "Stock Name" },
    { key: "setup", label: "Setup" },
    { key: "buySell", label: "Buy/Sell" },
    { key: "entry", label: "Entry" },
    { key: "avgEntry", label: "Avg Entry" },
    { key: "sl", label: "SL" },
    { key: "slPercent", label: "SL %" },
    { key: "tsl", label: "TSL" },
    { key: "cmp", label: "CMP" },
    { key: "initialQty", label: "Initial Qty" },
    { key: "pyramid1Price", label: "Pyramid 1 Price" },
    { key: "pyramid1Qty", label: "Pyramid 1 Qty" },
    { key: "pyramid1Date", label: "Pyramid 1 Date" },
    { key: "pyramid2Price", label: "Pyramid 2 Price" },
    { key: "pyramid2Qty", label: "Pyramid 2 Qty" },
    { key: "pyramid2Date", label: "Pyramid 2 Date" },
    { key: "positionSize", label: "Position Size" },
    { key: "allocation", label: "Allocation" },
    { key: "exit1Price", label: "Exit 1 Price" },
    { key: "exit1Qty", label: "Exit 1 Qty" },
    { key: "exit1Date", label: "Exit 1 Date" },
    { key: "exit2Price", label: "Exit 2 Price" },
    { key: "exit2Qty", label: "Exit 2 Qty" },
    { key: "exit2Date", label: "Exit 2 Date" },
    { key: "exit3Price", label: "Exit 3 Price" },
    { key: "exit3Qty", label: "Exit 3 Qty" },
    { key: "exit3Date", label: "Exit 3 Date" },
    { key: "openQty", label: "Open Qty" },
    { key: "exitedQty", label: "Exited Qty" },
    { key: "avgExitPrice", label: "Avg Exit Price" },
    { key: "stockMove", label: "Stock Move" },
    { key: "openHeat", label: "Open Heat" },
    { key: "rewardRisk", label: "Reward:Risk" },
    { key: "holdingDays", label: "Holding Days" },
    { key: "positionStatus", label: "Position Status" },
    { key: "realisedAmount", label: "Realised Amount" },
    { key: "plRs", label: "P/L ₹" },
    { key: "pfImpact", label: "PF Impact" },
    { key: "cummPf", label: "Cumm PF" },
    { key: "planFollowed", label: "Plan Followed" },
    { key: "exitTrigger", label: "Exit Trigger" },
    { key: "proficiencyGrowthAreas", label: "Growth Areas" },
    { key: "chartAttachments", label: "Charts" },
    { key: "actions", label: "Actions" },
    { key: "unrealizedPL", label: "Unrealized P/L" },
    { key: "notes", label: "Notes" }
  ];

  return (
    <div className="flex flex-col gap-4 mb-6">
      <AnimatePresence>
        <div className="flex flex-row justify-between items-center gap-4 w-full">
          {/* Search and Filter Section */}
          <div className="flex items-center gap-3 flex-1">
            <DebouncedInput
              className="max-w-[300px]"
              placeholder="Search trades..."
              startContent={<Icon icon="lucide:search" className="text-default-400 dark:text-default-300" />}
              value={searchQuery}
              onChange={setSearchQuery}
              size="sm"
              variant="bordered"
              debounceMs={300}
              isClearable={true}
            />
            
            {/* Status Filter */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  size="sm"
                  className="bg-default-100 dark:bg-gray-900 text-foreground dark:text-white min-w-[100px] h-7 text-xs"
                  endContent={<Icon icon="lucide:chevron-down" className="text-sm dark:text-gray-400" />}
                >
                  Status: {statusFilter || "All"}
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Status filter"
                selectionMode="single"
                selectedKeys={statusFilter ? [statusFilter] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setStatusFilter(selected === statusFilter ? "" : selected);
                }}
              >
                <DropdownItem key="">All</DropdownItem>
                <DropdownItem key="Open">Open</DropdownItem>
                <DropdownItem key="Partial">Partial</DropdownItem>
                <DropdownItem key="Closed">Closed</DropdownItem>
              </DropdownMenu>
            </Dropdown>

            {/* Column Visibility Toggle */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  size="sm"
                  className="bg-default-100 dark:bg-gray-900 text-foreground dark:text-white h-7 text-xs"
                  startContent={<Icon icon="lucide:columns" className="text-sm" />}
                >
                  Columns
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Column visibility"
                selectionMode="multiple"
                selectedKeys={visibleColumns}
                onSelectionChange={(keys) => setVisibleColumns(new Set(keys as Set<string>))}
                className="max-h-[400px] overflow-y-auto"
              >
                {/* Select All / Deselect All Controls */}
                <DropdownItem
                  key="select-all"
                  className="dark:text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:bg-primary/10 dark:hover:bg-primary/20"
                  startContent={
                    <Icon
                      icon={visibleColumns.size === columnOptions.length ? "lucide:check-square-2" : "lucide:square"}
                      className={`text-sm transition-all duration-200 group-hover:scale-110 ${
                        visibleColumns.size === columnOptions.length ? "text-primary" : "text-default-400"
                      }`}
                    />
                  }
                  onPress={() => {
                    // Add haptic feedback
                    if (navigator.vibrate) {
                      navigator.vibrate(15);
                    }

                    const allColumnKeys = columnOptions.map(col => col.key);
                    setVisibleColumns(new Set(allColumnKeys));

                    // Visual feedback
                    const element = document.querySelector('[data-key="select-all"]');
                    if (element) {
                      element.classList.add('animate-pulse');
                      setTimeout(() => element.classList.remove('animate-pulse'), 200);
                    }
                  }}
                >
                  Select All
                </DropdownItem>
                <DropdownItem
                  key="deselect-all"
                  className="dark:text-white border-b border-divider mb-1 pb-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:bg-default/10 dark:hover:bg-default/20"
                  startContent={
                    <Icon
                      icon={visibleColumns.size <= 3 ? "lucide:square" : "lucide:minus-square"}
                      className={`text-sm transition-all duration-200 group-hover:scale-110 ${
                        visibleColumns.size <= 3 ? "text-default-400" : "text-default-500"
                      }`}
                    />
                  }
                  onPress={() => {
                    // Add haptic feedback
                    if (navigator.vibrate) {
                      navigator.vibrate(15);
                    }

                    // Keep essential columns visible
                    const essentialColumns = ["tradeNo", "date", "name"];
                    setVisibleColumns(new Set(essentialColumns));

                    // Visual feedback
                    const element = document.querySelector('[data-key="deselect-all"]');
                    if (element) {
                      element.classList.add('animate-pulse');
                      setTimeout(() => element.classList.remove('animate-pulse'), 200);
                    }
                  }}
                >
                  Deselect All
                </DropdownItem>

                {/* Column Options */}
                {columnOptions.map((column) => (
                  <DropdownItem key={column.key}>
                    {column.label}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
          </div>

          {/* Action Buttons Section - Match original exactly */}
          <div className="flex items-center gap-0.5">
            <motion.div className="flex items-center gap-0.5">
              {/* Stats Mask Toggle */}
              <Tooltip content={isStatsMasked ? "Show figures" : "Hide figures"}>
                <Button
                  isIconOnly
                  variant="light"
                  onPress={toggleStatsMask}
                  className={`w-6 h-6 min-w-6 rounded p-0.5 transition-all duration-200 ${
                    isStatsMasked
                      ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 hover:bg-warning-200 dark:hover:bg-warning-900/50'
                      : 'hover:bg-default-100 dark:hover:bg-default-800 text-default-600 dark:text-default-400'
                  }`}
                >
                  <Icon
                    icon={isStatsMasked ? "lucide:eye" : "lucide:eye-off"}
                    className="w-3 h-3"
                  />
                </Button>
              </Tooltip>

              {/* Universal Chart Viewer */}
              <Tooltip content="Browse All Chart Images">
                <Button
                  isIconOnly
                  variant="light"
                  onPress={onOpenUniversalChartViewer}
                  className="w-6 h-6 min-w-6 rounded p-0.5 hover:bg-primary/10 transition"
                >
                  <Icon icon="lucide:images" className="w-3 h-3" />
                </Button>
              </Tooltip>

              {/* Add Trade - PRIMARY COLOR like original */}
              <Button
                isIconOnly
                color="primary"
                variant="light"
                onPress={onAddTrade}
                className="w-6 h-6 min-w-6 rounded p-0.5 hover:bg-primary/10 transition"
              >
                <Icon icon="lucide:plus" className="w-3 h-3" />
              </Button>
            </motion.div>

            {/* Import Button */}
            <Tooltip content="Import CSV/Excel">
              <Button
                isIconOnly
                variant="light"
                className="w-6 h-6 min-w-6 rounded p-0.5 hover:bg-primary/10 transition"
                onPress={onImportTrades}
              >
                <Icon icon="lucide:upload" className="w-3 h-3" />
              </Button>
            </Tooltip>

            {/* Export Dropdown */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant="light"
                  className="w-6 h-6 min-w-6 rounded p-0.5 hover:bg-primary/10 transition"
                >
                  <Icon icon="lucide:download" className="w-3 h-3" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Export options"
                onAction={(key) => {
                  if (key === 'csv') onExportCSV();
                  else if (key === 'xlsx') onExportExcel();
                }}
              >
                <DropdownItem key="csv" textValue="Export as CSV" startContent={<Icon icon="lucide:file-text" />}>
                  Export as CSV
                </DropdownItem>
                <DropdownItem key="xlsx" textValue="Export as Excel" startContent={<Icon icon="lucide:file-spreadsheet" />}>
                  Export as Excel
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </AnimatePresence>
    </div>
  );
};
