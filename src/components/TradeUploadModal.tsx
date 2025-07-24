import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Chip,
  Divider,
  ScrollShadow,
  addToast
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from 'xlsx'; // Excel support ONLY for Upstox format
import Papa from 'papaparse';
import { Trade } from "../types/trade";
import { v4 as uuidv4 } from 'uuid';
import {
  calcAvgEntry,
  calcPositionSize,
  calcAllocation,
  calcSLPercent,
  calcOpenQty,
  calcExitedQty,
  calcAvgExitPrice,
  calcStockMove,
  calcRewardRisk,
  calcHoldingDays,
  calcRealisedAmount,
  calcPFImpact,
  calcRealizedPL_FIFO
} from "../lib/calculations";
// Import broker-specific utilities
import { convertZerodhaToNexus, parseZerodhaData } from "../utils/zerodhaMapper";
import {
  isZerodhaPnLStatement,
  parseZerodhaCharges,
  distributeChargesAcrossMonths,
  ZerodhaChargesBreakdown
} from "../utils/zerodhaChargesParser";
import { updateChargesBreakdown } from "./tax-analytics";
import { processDhanCSV } from "../utils/dhanMapper";
import { processUpstoxExcel } from "../utils/upstoxMapper";
import {
  isUpstoxPnLStatement,
  parseUpstoxCharges,
  distributeUpstoxChargesAcrossMonths,
  UpstoxChargesBreakdown
} from "../utils/upstoxChargesParser";

interface TradeUploadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (trades: Trade[]) => void;
  portfolioSize?: number;
  getPortfolioSize?: (month: string, year: number) => number;
}

interface ParsedData {
  headers: string[];
  rows: any[][];
  fileName: string;
}

interface ColumnMapping {
  [key: string]: string; // Our field -> Their column
}

interface MappingConfidence {
  [key: string]: number; // Our field -> confidence score (0-100)
}

// Fields that should be imported from user data (manual input fields)
const USER_INPUT_FIELDS = [
  { key: 'tradeNo', label: 'Trade No.', required: false },
  { key: 'date', label: 'Date', required: true },
  { key: 'name', label: 'Stock Name', required: true },
  { key: 'setup', label: 'Setup', required: false },
  { key: 'buySell', label: 'Buy/Sell', required: false },
  { key: 'entry', label: 'Entry Price', required: false },
  { key: 'sl', label: 'Stop Loss', required: false },
  { key: 'tsl', label: 'Trailing SL', required: false },
  { key: 'initialQty', label: 'Initial Quantity', required: false },
  { key: 'pyramid1Price', label: 'Pyramid 1 Price', required: false },
  { key: 'pyramid1Qty', label: 'Pyramid 1 Qty', required: false },
  { key: 'pyramid1Date', label: 'Pyramid 1 Date', required: false },
  { key: 'pyramid2Price', label: 'Pyramid 2 Price', required: false },
  { key: 'pyramid2Qty', label: 'Pyramid 2 Qty', required: false },
  { key: 'pyramid2Date', label: 'Pyramid 2 Date', required: false },
  { key: 'exit1Price', label: 'Exit 1 Price', required: false },
  { key: 'exit1Qty', label: 'Exit 1 Qty', required: false },
  { key: 'exit1Date', label: 'Exit 1 Date', required: false },
  { key: 'exit2Price', label: 'Exit 2 Price', required: false },
  { key: 'exit2Qty', label: 'Exit 2 Qty', required: false },
  { key: 'exit2Date', label: 'Exit 2 Date', required: false },
  { key: 'exit3Price', label: 'Exit 3 Price', required: false },
  { key: 'exit3Qty', label: 'Exit 3 Qty', required: false },
  { key: 'exit3Date', label: 'Exit 3 Date', required: false },
  { key: 'planFollowed', label: 'Plan Followed', required: false },
  { key: 'exitTrigger', label: 'Exit Trigger', required: false },
  { key: 'proficiencyGrowthAreas', label: 'Growth Areas', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

// Fields that are auto-populated and should NOT be imported from user data
const AUTO_POPULATED_FIELDS = [
  'cmp',           // Fetched from API
  'avgEntry',      // Calculated from entry + pyramids
  'positionSize',  // Calculated from avgEntry * totalQty
  'allocation',    // Calculated from positionSize / portfolioSize
  'slPercent',     // Calculated from SL vs Entry
  'openQty',       // Calculated from total - exited
  'exitedQty',     // Calculated from exit quantities
  'avgExitPrice',  // Calculated from exit prices/quantities
  'stockMove',     // Calculated from price movement
  'openHeat',      // Calculated from portfolio context
  'rewardRisk',    // Calculated from risk/reward ratio
  'holdingDays',   // Calculated from dates
  'positionStatus', // Calculated from open/exited quantities
  'realisedAmount', // Calculated from exits
  'plRs',          // Calculated using FIFO/accounting method
  'pfImpact',      // Calculated from P/L vs portfolio
  'cummPf',        // Calculated cumulatively across trades
  'unrealizedPL'   // Calculated for open positions
];

// Our trade fields that can be mapped (only user input fields)
const MAPPABLE_FIELDS = USER_INPUT_FIELDS;

// Optimized parsing functions for performance
const parseFlexibleNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0;

  // Fast path for numbers
  if (typeof value === 'number') return value;

  let stringValue = String(value).trim();

  // Handle Excel errors and special values
  if (stringValue === '#DIV/0!' || stringValue === '#N/A' || stringValue === '#ERROR!' ||
      stringValue === '#VALUE!' || stringValue === '#REF!' || stringValue === '#NAME?') {
    return 0;
  }

  // Quick check for simple numbers
  if (/^\d+\.?\d*$/.test(stringValue)) {
    return parseFloat(stringValue);
  }

  // Only do complex cleaning if needed
  stringValue = stringValue
    .replace(/[₹$€£¥,\s%]/g, '') // Remove currency symbols, commas, spaces, percentage
    .replace(/["']/g, '') // Remove quotes
    .replace(/[^\d.-]/g, ''); // Keep only digits, dots, and minus signs

  // Handle decimal comma (European format)
  if (/\d+,\d{1,2}$/.test(stringValue)) {
    stringValue = stringValue.replace(',', '.');
  }

  const parsed = parseFloat(stringValue);
  return isNaN(parsed) ? 0 : parsed;
};

const parseFlexibleDate = (value: any): string | null => {
  if (!value) return null;

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  try {
    // Fast path: try direct Date parsing first
    let date = new Date(stringValue);

    // If direct parsing worked, validate and return
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString();
    }

    // Handle common CSV date formats only if direct parsing failed
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(stringValue)) {
      const [first, second, year] = stringValue.split('/').map(Number);
      // Assume DD/MM/YYYY if first > 12, otherwise MM/DD/YYYY
      if (first > 12) {
        date = new Date(year, second - 1, first);
      } else {
        date = new Date(year, first - 1, second);
      }
    } else if (/^\d{5}$/.test(stringValue)) {
      // Excel serial date
      const serialDate = parseInt(stringValue);
      date = new Date(1900, 0, serialDate - 1);
    }

    // Final validation
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString();
    }
  } catch (error) {
    // Silently fail for performance
  }

  return null;
};

export const TradeUploadModal: React.FC<TradeUploadModalProps> = ({
  isOpen,
  onOpenChange,
  onImport,
  portfolioSize = 100000,
  getPortfolioSize
}) => {
  // Upload functionality is now enabled
  const isUploadDisabled = false;
  const [step, setStep] = useState<'upload' | 'dateFormat' | 'mapping' | 'preview' | 'importing'>('upload');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [mappingConfidence, setMappingConfidence] = useState<MappingConfidence>({});
  const [previewTrades, setPreviewTrades] = useState<Trade[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [dataConsentGiven, setDataConsentGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateFormat, setSelectedDateFormat] = useState<string>('auto');
  const [showImportBanner, setShowImportBanner] = useState<boolean>(true);
  const [isZerodhaFormat, setIsZerodhaFormat] = useState<boolean>(false);
  const [isDhanFormat, setIsDhanFormat] = useState<boolean>(false);
  const [isUpstoxFormat, setIsUpstoxFormat] = useState<boolean>(false);

  // Date format options
  const dateFormatOptions = [
    { value: 'auto', label: 'Auto-detect (Recommended)', example: 'Various formats', description: 'Let the system automatically detect your date format' },
    { value: 'iso', label: 'ISO Format', example: '2024-01-15', description: 'Year-Month-Day with dashes' },
    { value: 'dmy_slash', label: 'DD/MM/YYYY', example: '15/01/2024', description: 'Day/Month/Year with slashes' },
    { value: 'mdy_slash', label: 'MM/DD/YYYY', example: '01/15/2024', description: 'Month/Day/Year with slashes (US format)' },
    { value: 'dmy_dash', label: 'DD-MM-YYYY', example: '15-01-2024', description: 'Day-Month-Year with dashes' },
    { value: 'dmy_dot', label: 'DD.MM.YYYY', example: '15.01.2024', description: 'Day.Month.Year with dots' },
    { value: 'dmy_text_full', label: 'DD MMM YYYY', example: '24 Jul 2024', description: 'Day Month Year with text month' },
    { value: 'dmy_text_short', label: 'DD MMM YY', example: '24 Jul 24', description: 'Day Month Year (2-digit year) with text month' },
    { value: 'dmy_text_no_year', label: 'DD MMM', example: '24 Jul', description: 'Day Month only (current year assumed)' },
    { value: 'mdy_text_full', label: 'MMM DD, YYYY', example: 'Jul 24, 2024', description: 'Month Day, Year with text month (US format)' },
    { value: 'mdy_text_short', label: 'MMM DD YY', example: 'Jul 24 24', description: 'Month Day Year (2-digit year) with text month' },
  ];

  // Month name mappings for text-based dates
  const monthNames = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8, 'sept': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  // Robust date parsing function to handle various date formats and convert to DD-MM-YYYY
  const parseDate = useCallback((dateStr: string, formatHint?: string, passedTradeYear?: number): string | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const cleanDateStr = String(dateStr).trim();
    if (!cleanDateStr) return null;

    const format = formatHint || selectedDateFormat;



    let parsedDate: Date;



    // Helper function to convert Date object to ISO format for database storage
    const formatToTradeJournal = (date: Date): string => {
      if (isNaN(date.getTime())) return null;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      // Return ISO format (YYYY-MM-DD) for database compatibility
      return `${year}-${month}-${day}`;
    };

    // Helper function to get default year (from trade year or current year)
    const getDefaultYear = (): number => {
      const defaultYear = passedTradeYear || new Date().getFullYear();
      console.log(`🎯 getDefaultYear: passedTradeYear=${passedTradeYear}, defaultYear=${defaultYear}`);
      // Ensure year is reasonable (between 2000 and current year + 5)
      const currentYear = new Date().getFullYear();
      if (defaultYear < 2000 || defaultYear > currentYear + 5) {
        console.log(`⚠️ Year ${defaultYear} out of range, using current year: ${currentYear}`);
        return currentYear;
      }
      console.log(`✅ Using year: ${defaultYear}`);
      return defaultYear;
    };

    // If user specified a specific format, try that first
    if (format !== 'auto') {
      try {
        let parsedDate: Date;

        switch (format) {
          case 'iso': {
            // YYYY-MM-DD
            const parts = cleanDateStr.split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
              parsedDate = new Date(part1, part2 - 1, part3);
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'dmy_slash':
          case 'dmy_dash':
          case 'dmy_dot': {
            // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
            const parts = cleanDateStr.split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
              parsedDate = new Date(part3, part2 - 1, part1);
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'mdy_slash': {
            // MM/DD/YYYY
            const parts = cleanDateStr.split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
              parsedDate = new Date(part3, part1 - 1, part2);
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'dmy_text_full': {
            // DD MMM YYYY (e.g., "24 Jul 2024")
            const parts = cleanDateStr.split(/\s+/);
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const monthName = parts[1].toLowerCase();
              const year = parseInt(parts[2], 10);
              const month = monthNames[monthName as keyof typeof monthNames];
              if (month !== undefined) {
                parsedDate = new Date(year, month, day);
              } else {
                parsedDate = new Date(cleanDateStr);
              }
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'dmy_text_short': {
            // DD MMM YY (e.g., "24 Jul 24")
            const parts = cleanDateStr.split(/\s+/);
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const monthName = parts[1].toLowerCase();
              let year = parseInt(parts[2], 10);
              // Convert 2-digit year to 4-digit (assume 2000s for all trade data)
              if (year < 100) {
                if (year <= 30) {
                  year += 2000; // 00-30 -> 2000-2030
                } else {
                  year += 2000; // 31-99 -> 2031-2099
                }
              }
              const month = monthNames[monthName as keyof typeof monthNames];
              if (month !== undefined) {
                parsedDate = new Date(year, month, day);
              } else {
                parsedDate = new Date(cleanDateStr);
              }
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'dmy_text_no_year': {
            // DD MMM (e.g., "24 Jul") - assume current year
            const parts = cleanDateStr.split(/\s+/);
            if (parts.length === 2) {
              const day = parseInt(parts[0], 10);
              const monthName = parts[1].toLowerCase();
              const year = new Date().getFullYear(); // Use current year
              const month = monthNames[monthName as keyof typeof monthNames];
              if (month !== undefined) {
                parsedDate = new Date(year, month, day);
              } else {
                parsedDate = new Date(cleanDateStr);
              }
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'mdy_text_full': {
            // MMM DD, YYYY (e.g., "Jul 24, 2024")
            const parts = cleanDateStr.replace(',', '').split(/\s+/);
            if (parts.length === 3) {
              const monthName = parts[0].toLowerCase();
              const day = parseInt(parts[1], 10);
              const year = parseInt(parts[2], 10);
              const month = monthNames[monthName as keyof typeof monthNames];
              if (month !== undefined) {
                parsedDate = new Date(year, month, day);
              } else {
                parsedDate = new Date(cleanDateStr);
              }
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          case 'mdy_text_short': {
            // MMM DD YY (e.g., "Jul 24 24")
            const parts = cleanDateStr.split(/\s+/);
            if (parts.length === 3) {
              const monthName = parts[0].toLowerCase();
              const day = parseInt(parts[1], 10);
              let year = parseInt(parts[2], 10);
              // Convert 2-digit year to 4-digit (assume 2000s for all trade data)
              if (year < 100) {
                if (year <= 30) {
                  year += 2000; // 00-30 -> 2000-2030
                } else {
                  year += 2000; // 31-99 -> 2031-2099
                }
              }
              const month = monthNames[monthName as keyof typeof monthNames];
              if (month !== undefined) {
                parsedDate = new Date(year, month, day);
              } else {
                parsedDate = new Date(cleanDateStr);
              }
            } else {
              parsedDate = new Date(cleanDateStr);
            }
            break;
          }
          default:
            parsedDate = new Date(cleanDateStr);
        }

        if (!isNaN(parsedDate.getTime())) {
          return formatToTradeJournal(parsedDate);
        }
      } catch (error) {
        }
    }

    // Fallback to auto-detection if specific format fails or auto is selected
    // Try parsing as-is first (for ISO dates)
    parsedDate = new Date(cleanDateStr);
    if (!isNaN(parsedDate.getTime())) {
      // If the parsed date has year 2001 and we have a passed year, it means the date was incomplete
      if (parsedDate.getFullYear() === 2001 && passedTradeYear && passedTradeYear !== 2001) {
        parsedDate.setFullYear(passedTradeYear);
      }
      return formatToTradeJournal(parsedDate);
    }

    // Try text-based date formats first (more specific)
    // Handle formats like "24-Jul-24", "15-Aug-24" from the template
    const dashTextParts = cleanDateStr.split('-');
    if (dashTextParts.length === 3) {
      const [dayPart, monthPart, yearPart] = dashTextParts;
      const monthName = monthPart.toLowerCase();

      if (monthNames[monthName as keyof typeof monthNames] !== undefined) {
        const month = monthNames[monthName as keyof typeof monthNames];
        const day = parseInt(dayPart, 10);
        let year = parseInt(yearPart, 10);

        // Handle 2-digit years - always assume 2000s for trade data
        if (year < 100) {
          if (year <= 30) {
            year += 2000; // 00-30 -> 2000-2030
          } else {
            year += 2000; // 31-99 -> 2031-2099
          }
        }

        parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          return formatToTradeJournal(parsedDate);
        }
      }
    }

    // Handle dates without year - DD-MM or DD-MMM format
    if (dashTextParts.length === 2) {
      const [dayPart, monthPart] = dashTextParts;
      const monthName = monthPart.toLowerCase();

      // Check if second part is a month name (DD-MMM format like "15-Jan")
      if (monthNames[monthName as keyof typeof monthNames] !== undefined) {
        const month = monthNames[monthName as keyof typeof monthNames];
        const day = parseInt(dayPart, 10);
        const year = getDefaultYear();
        console.log(`🔍 DD-MMM format: "${cleanDateStr}" -> day=${day}, month=${month}, year=${year}`);
        parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          const result = formatToTradeJournal(parsedDate);
          console.log(`✅ DD-MMM result: "${result}"`);
          return result;
        }
      }

      // Check if second part is numeric month (DD-MM format like "15-01")
      const monthNum = parseInt(monthPart, 10);
      if (monthNum >= 1 && monthNum <= 12) {
        const day = parseInt(dayPart, 10);
        const year = getDefaultYear();

        parsedDate = new Date(year, monthNum - 1, day);
        if (!isNaN(parsedDate.getTime()) && day >= 1 && day <= 31) {
          return formatToTradeJournal(parsedDate);
        }
      }
    }

    const textParts = cleanDateStr.split(/\s+/);
    if (textParts.length >= 2) {
      const firstPart = textParts[0];
      const secondPart = textParts[1];

      // Check if second part looks like a month name (DD MMM format like "29 April")
      const monthName = secondPart.toLowerCase();
      if (monthNames[monthName as keyof typeof monthNames] !== undefined) {
        const month = monthNames[monthName as keyof typeof monthNames];
        const day = parseInt(firstPart, 10);

        if (textParts.length === 3) {
          // DD MMM YYYY or DD MMM YY
          let year = parseInt(textParts[2], 10);
          if (year < 100) {
            if (year <= 30) {
              year += 2000; // 00-30 -> 2000-2030
            } else {
              year += 2000; // 31-99 -> 2031-2099
            }
          }

          parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return formatToTradeJournal(parsedDate);
          }
        } else if (textParts.length === 2) {
          // DD MMM (use provided trade year or current year)
          const year = getDefaultYear();
          parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return formatToTradeJournal(parsedDate);
          }
        }
      }

      // Check if first part looks like a month name (MMM DD format like "April 29")
      const firstMonthName = firstPart.toLowerCase();
      if (monthNames[firstMonthName as keyof typeof monthNames] !== undefined) {
        const month = monthNames[firstMonthName as keyof typeof monthNames];
        const day = parseInt(secondPart.replace(',', ''), 10);

        if (textParts.length === 3) {
          // MMM DD, YYYY or MMM DD YY
          let year = parseInt(textParts[2], 10);
          if (year < 100) {
            if (year <= 30) {
              year += 2000; // 00-30 -> 2000-2030
            } else {
              year += 2000; // 31-99 -> 2031-2099
            }
          }

          parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return formatToTradeJournal(parsedDate);
          }
        } else if (textParts.length === 2) {
          // MMM DD (use provided trade year or current year)
          const year = getDefaultYear();
          parsedDate = new Date(year, month, day);
          if (!isNaN(parsedDate.getTime())) {
            return formatToTradeJournal(parsedDate);
          }
        }
      }


    }

    // Try numeric date formats
    const parts = cleanDateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [part1, part2, part3] = parts.map(p => parseInt(p, 10));

      // If year is clearly identifiable (4 digits)
      if (part3 > 1900) {
        // DD/MM/YYYY format (try first - more common internationally)
        parsedDate = new Date(part3, part2 - 1, part1);
        if (!isNaN(parsedDate.getTime()) && part1 <= 31 && part2 <= 12) {
          return formatToTradeJournal(parsedDate);
        }

        // MM/DD/YYYY format (US format)
        parsedDate = new Date(part3, part1 - 1, part2);
        if (!isNaN(parsedDate.getTime()) && part2 <= 31 && part1 <= 12) {
          return formatToTradeJournal(parsedDate);
        }
      } else if (part1 > 1900) {
        // YYYY/MM/DD format
        parsedDate = new Date(part1, part2 - 1, part3);
        if (!isNaN(parsedDate.getTime()) && part3 <= 31 && part2 <= 12) {
          return formatToTradeJournal(parsedDate);
        }
      }
    }

    console.log(`❌ parseDate failed to parse: "${dateStr}" with passedTradeYear: ${passedTradeYear}`);
    return null;
  }, [selectedDateFormat]);

  // Function to recalculate all auto-populated fields for a trade
  // NOTE: CMP will be auto-fetched from API when trade name is set, not imported from CSV
  const recalculateTradeFields = useCallback((trade: Trade): Trade => {
    // Get portfolio size for the trade date
    const tradeDate = new Date(trade.date);
    const month = tradeDate.toLocaleString('default', { month: 'short' });
    const year = tradeDate.getFullYear();
    const tradePortfolioSize = getPortfolioSize ? getPortfolioSize(month, year) : portfolioSize;

    // Gather all entry lots (initial + pyramids)
    const allEntries = [
      { price: trade.entry, qty: trade.initialQty },
      ...(trade.pyramid1Price && trade.pyramid1Qty ? [{ price: trade.pyramid1Price, qty: trade.pyramid1Qty }] : []),
      ...(trade.pyramid2Price && trade.pyramid2Qty ? [{ price: trade.pyramid2Price, qty: trade.pyramid2Qty }] : [])
    ].filter(e => e.price > 0 && e.qty > 0);

    // Gather all exit lots with dates
    const allExits = [
      ...(trade.exit1Price && trade.exit1Qty ? [{
        price: trade.exit1Price,
        qty: trade.exit1Qty,
        date: trade.exit1Date || trade.date
      }] : []),
      ...(trade.exit2Price && trade.exit2Qty ? [{
        price: trade.exit2Price,
        qty: trade.exit2Qty,
        date: trade.exit2Date || trade.date
      }] : []),
      ...(trade.exit3Price && trade.exit3Qty ? [{
        price: trade.exit3Price,
        qty: trade.exit3Qty,
        date: trade.exit3Date || trade.date
      }] : [])
    ].filter(e => e.price > 0 && e.qty > 0);

    // Calculate derived values
    const totalInitialQty = allEntries.reduce((sum, e) => sum + e.qty, 0);
    const avgEntry = calcAvgEntry(allEntries);
    const positionSize = calcPositionSize(avgEntry, totalInitialQty);
    const allocation = calcAllocation(positionSize, tradePortfolioSize);
    const slPercent = calcSLPercent(trade.sl, trade.entry);

    const exitedQty = allExits.reduce((sum, e) => sum + e.qty, 0);
    const openQty = Math.max(0, totalInitialQty - exitedQty);
    const avgExitPrice = calcAvgExitPrice(allExits);

    // Determine position status
    let positionStatus: 'Open' | 'Closed' | 'Partial' = trade.positionStatus || 'Open';
    if (exitedQty === 0) {
      positionStatus = 'Open';
    } else if (exitedQty >= totalInitialQty) {
      positionStatus = 'Closed';
    } else {
      positionStatus = 'Partial';
    }

    const stockMove = calcStockMove(
      avgEntry,
      avgExitPrice,
      trade.cmp,
      openQty,
      exitedQty,
      positionStatus,
      trade.buySell
    );

    const rewardRisk = calcRewardRisk(
      trade.cmp || avgExitPrice || trade.entry,
      trade.entry,
      trade.sl,
      positionStatus,
      avgExitPrice,
      openQty,
      exitedQty,
      trade.buySell
    );

    const holdingDays = calcHoldingDays(
      trade.date,
      allExits.length > 0 ? allExits[allExits.length - 1].date : trade.date
    );

    const realisedAmount = calcRealisedAmount(exitedQty, avgExitPrice);

    // Calculate P/L using FIFO method
    const entryLotsForFifo = allEntries.map(e => ({ price: e.price, qty: e.qty }));
    const exitLotsForFifo = allExits.map(e => ({ price: e.price, qty: e.qty }));
    const plRs = exitedQty > 0 ? calcRealizedPL_FIFO(entryLotsForFifo, exitLotsForFifo, trade.buySell as 'Buy' | 'Sell') : 0;

    // Note: PF Impact calculation in upload modal uses entry date portfolio size
    // This is acceptable for initial calculation as accounting method-specific
    // recalculation will happen in the main trade processing pipeline
    const pfImpact = calcPFImpact(plRs, tradePortfolioSize);

    return {
      ...trade,
      avgEntry,
      positionSize,
      allocation,
      slPercent,
      openQty,
      exitedQty,
      avgExitPrice,
      stockMove,
      rewardRisk,
      holdingDays,
      positionStatus,
      realisedAmount,
      plRs,
      pfImpact,
      cummPf: 0, // This would need to be calculated across all trades
      openHeat: 0 // This would need portfolio context
    };
  }, [portfolioSize, getPortfolioSize]);

  // Enhanced Zerodha format detection function with unique identifiers
  const detectZerodhaFormat = useCallback((headers: string[]): boolean => {
    console.log('🔍 ZERODHA DETECTION - Raw headers:', headers);

    // Convert headers to lowercase for case-insensitive comparison
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    console.log('🔍 ZERODHA DETECTION - Lowercase headers:', lowerHeaders);

    // Unique Zerodha identifiers - these are specific to Zerodha format
    const zerodhaUniqueHeaders = [
      'trade_type',  // Zerodha specific
      'trade_id',    // Zerodha specific
      'order_id',    // Zerodha specific
      'isin',        // Zerodha includes this
      'series'       // Zerodha specific
    ];

    // Required Zerodha headers
    const requiredZerodhaHeaders = [
      'symbol',
      'trade_date',
      'quantity',
      'price'
    ];

    // Check for unique Zerodha identifiers first
    const uniqueMatches = zerodhaUniqueHeaders.filter(unique =>
      lowerHeaders.some(header =>
        header.includes(unique) ||
        header.includes(unique.replace('_', ' ')) ||
        header.includes(unique.replace('_', ''))
      )
    );

    // Check for required headers
    const requiredMatches = requiredZerodhaHeaders.filter(required =>
      lowerHeaders.some(header =>
        header.includes(required) ||
        header.includes(required.replace('_', ' ')) ||
        header.includes(required.replace('_', ''))
      )
    );

    // Must have at least 2 unique identifiers AND 3 required headers
    const hasUniqueIdentifiers = uniqueMatches.length >= 2;
    const hasRequiredHeaders = requiredMatches.length >= 3;

    const isZerodhaFormat = hasUniqueIdentifiers && hasRequiredHeaders;

    console.log('🔍 ZERODHA DETECTION RESULT:', {
      originalHeaders: headers,
      lowerHeaders: lowerHeaders,
      uniqueMatches: uniqueMatches,
      requiredMatches: requiredMatches,
      hasUniqueIdentifiers,
      hasRequiredHeaders,
      isZerodhaFormat
    });

    return isZerodhaFormat;
  }, []);

  // Enhanced Dhan format detection function with unique identifiers
  const detectDhanFormat = useCallback((headers: string[]): boolean => {
    console.log('🔍 DHAN DETECTION - Raw headers:', headers);

    // Convert headers to lowercase for case-insensitive comparison
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    console.log('🔍 DHAN DETECTION - Lowercase headers:', lowerHeaders);

    // Unique Dhan identifiers - these are specific to Dhan format
    const dhanUniqueHeaders = [
      'buy/sell',      // Dhan specific format
      'quantity/lot',  // Dhan specific format
      'trade price',   // Dhan specific format (with space)
      'trade value',   // Dhan specific format
      'status'         // Dhan includes status column
    ];

    // Required Dhan headers
    const requiredDhanHeaders = [
      'date',
      'time',
      'name',
      'exchange'
    ];

    // Check for unique Dhan identifiers
    const uniqueMatches = dhanUniqueHeaders.filter(unique =>
      lowerHeaders.some(header => {
        // Exact match
        if (header === unique) return true;
        // Handle specific Dhan variations
        if (unique === 'buy/sell' && (header.includes('buy/sell') || header === 'buy/sell')) return true;
        if (unique === 'quantity/lot' && (header.includes('quantity/lot') || header === 'quantity/lot')) return true;
        if (unique === 'trade price' && (header.includes('trade price') || header === 'trade price')) return true;
        if (unique === 'trade value' && (header.includes('trade value') || header === 'trade value')) return true;
        if (unique === 'status' && header === 'status') return true;
        return false;
      })
    );

    // Check for required headers
    const requiredMatches = requiredDhanHeaders.filter(required =>
      lowerHeaders.some(header => header.includes(required))
    );

    // Must have at least 3 unique identifiers AND 3 required headers
    const hasUniqueIdentifiers = uniqueMatches.length >= 3;
    const hasRequiredHeaders = requiredMatches.length >= 3;

    const isDhanFormat = hasUniqueIdentifiers && hasRequiredHeaders;

    console.log('🔍 DHAN DETECTION RESULT:', {
      originalHeaders: headers,
      lowerHeaders: lowerHeaders,
      uniqueMatches: uniqueMatches,
      requiredMatches: requiredMatches,
      hasUniqueIdentifiers,
      hasRequiredHeaders,
      isDhanFormat: isDhanFormat
    });

    return isDhanFormat;
  }, []);

  // Enhanced Upstox format detection function for Excel files
  const detectUpstoxFormat = useCallback((fileName: string): boolean => {
    const lowerFileName = fileName.toLowerCase().trim();

    // Upstox file naming patterns
    const upstoxPatterns = [
      /trade_\d+_\d+_eq\.xlsx?$/i,     // trade_553498_1920_eq.xlsx
      /upstox.*trade.*\.xlsx?$/i,       // upstox_trade_report.xlsx
      /trade.*upstox.*\.xlsx?$/i,       // trade_report_upstox.xlsx
      /upstox.*\.xlsx?$/i,              // upstox.xlsx
      /realized[Pp]n[Ll].*\.xlsx?$/i,   // realizedPnL_1920_553498.xlsx
      /.*_\d+_\d+.*\.xlsx?$/i           // Any file with _numbers_numbers pattern
    ];

    const matchesPattern = upstoxPatterns.some(pattern => pattern.test(lowerFileName));
    const isExcelFile = lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls');

    return matchesPattern && isExcelFile;
  }, []);

  // Smart column mapping based on header similarity AND data content validation
  const generateSmartMapping = useCallback((headers: string[]): { mapping: ColumnMapping; confidence: MappingConfidence } => {
    const mapping: ColumnMapping = {};
    const confidence: MappingConfidence = {};

    // Helper function to check if a column has meaningful data
    const hasValidData = (columnIndex: number): boolean => {
      if (!parsedData || columnIndex >= headers.length) return true; // Default to true

      const columnName = headers[columnIndex];

      // For optional fields that are commonly empty, always return true
      const optionalFields = [
        'Setup', 'TSL (₹)', 'CMP (₹)', 'P2 Price (₹)', 'P2 Qty', 'P2 Date',
        'E3 Price (₹)', 'E3 Qty', 'E3 Date', 'Open Qty', 'Exit Trigger',
        'Growth Areas', 'Notes', 'Charts'
      ];

      if (optionalFields.some(field => columnName.includes(field))) {
        console.log(`✅ Allowing empty optional field: ${columnName}`);
        return true;
      }

      // Check first 10 rows to see if column has any data (more thorough check)
      const sampleRows = parsedData.rows.slice(0, 10);
      let nonEmptyCount = 0;

      for (const row of sampleRows) {
        const value = row[columnIndex];
        if (value !== null && value !== undefined && String(value).trim() !== '' &&
            String(value).trim() !== '#DIV/0!' && String(value).trim() !== '#N/A') {
          nonEmptyCount++;
        }
      }

      // Column should have data in at least 1 row to be considered valid (very lenient)
      const isValid = nonEmptyCount >= 1;
      if (!isValid) {
        console.log(`📊 Column ${headers[columnIndex]} has no valid data (${nonEmptyCount}/${sampleRows.length} rows)`);
      }
      return isValid;
    };

    // Helper function to validate if column data matches expected field type
    const validateFieldDataType = (field: string, columnIndex: number): boolean => {
      if (!parsedData || columnIndex >= headers.length) return true; // Default to true if no data

      const columnHeader = headers[columnIndex].toLowerCase();

      // Only prevent very specific wrong mappings that we know cause issues
      if (field === 'cmp' && (columnHeader.includes('r:r') || columnHeader.includes('reward'))) {
        return false;
      }

      if (field === 'rewardRisk' && (columnHeader.includes('cmp') && !columnHeader.includes('r:r'))) {
        return false;
      }

      // For all other cases, be extremely permissive
      return true;
    };

    // Enhanced similarity mapping - ONLY for user input fields (auto-populated fields excluded)
    // Special handling for ambiguous "Date" columns by considering context
    const similarityMap: { [key: string]: string[] } = {
      'tradeNo': ['trade no', 'trade number', 'trade id', 'id', 'sr no', 'serial', 'trade #', '#', 'trade no.'],
      'date': ['date', 'entry date', 'trade date', 'timestamp', 'entry dt', 'dt'],
      'name': ['name', 'stock', 'symbol', 'stock name', 'company', 'scrip', 'ticker', 'instrument'],
      'setup': ['setup', 'strategy', 'pattern', 'setup type', 'trade setup', 'setup name'],
      'buySell': ['buy/sell', 'buysell', 'side', 'action', 'transaction type', 'buy sell', 'direction', 'buy/ sell'],
      'entry': ['entry', 'entry price', 'buy price', 'price', 'entry rate', 'buy rate', 'entry (₹)'],
      'avgEntry': ['avg entry', 'average entry', 'avg. entry', 'avg entry (₹)', 'average entry price', 'avg entry price'],
      'sl': ['sl', 'stop loss', 'stoploss', 'stop', 'sl price', 'stop price', 'sl (₹)'],
      'tsl': ['tsl', 'trailing sl', 'trailing stop', 'trail sl', 'trailing stop loss', 'tsl (₹)'],
      'cmp': ['cmp', 'current price', 'market price', 'ltp', 'last traded price', 'cmp (₹)', 'current market price'],
      'initialQty': ['qty', 'quantity', 'initial qty', 'shares', 'units', 'volume', 'size', 'initial qty', 'base qty', 'initial qty'],
      'positionSize': ['position size', 'pos size', 'pos. size', 'position value', 'trade size'],
      'allocation': ['allocation', 'allocation %', 'allocation (%)', 'alloc', 'alloc %'],
      'slPercent': ['sl %', 'sl percent', 'stop loss %', 'stop loss percent', 'sl percentage', 'sl%', 'sl per', 'stop loss per', 'stoploss %', 'stoploss percent'],
      'pyramid1Price': ['pyramid 1 price', 'p1 price', 'p-1 price', 'pyramid1 price', 'pyr1 price', 'pyramid-1 price', 'pyramid-1 price (₹)', 'p1 price (₹)', 'P1 Price (₹)'],
      'pyramid1Qty': ['pyramid 1 qty', 'p1 qty', 'p-1 qty', 'pyramid1 qty', 'pyr1 qty', 'p-1\nqty', 'p-1 qty', 'P1 Qty'],
      'pyramid1Date': ['pyramid 1 date', 'p1 date', 'p-1 date', 'pyramid1 date', 'pyr1 date', 'p-1\ndate', 'p-1 date', 'P1 Date'],
      'pyramid2Price': ['pyramid 2 price', 'p2 price', 'p-2 price', 'pyramid2 price', 'pyr2 price', 'pyramid-2\nprice', 'pyramid-2 price', 'pyramid-2 price (₹)', 'p2 price (₹)', 'P2 Price (₹)'],
      'pyramid2Qty': ['pyramid 2 qty', 'p2 qty', 'p-2 qty', 'pyramid2 qty', 'pyr2 qty', 'p-2\nqty', 'p-2 qty', 'P2 Qty'],
      'pyramid2Date': ['pyramid 2 date', 'p2 date', 'p-2 date', 'pyramid2 date', 'pyr2 date', 'p-2\ndate', 'p-2 date', 'P2 Date'],
      'exit1Price': ['exit 1 price', 'e1 price', 'exit1 price', 'sell 1 price', 'exit price', 'exit-1\nprice', 'exit-1 price', 'exit-1 price (₹)', 'e1 price (₹)', 'E1 Price (₹)'],
      'exit1Qty': ['exit 1 qty', 'e1 qty', 'exit1 qty', 'sell 1 qty', 'exit qty', 'exit-1\nqty', 'exit-1 qty', 'E1 Qty'],
      'exit1Date': ['exit 1 date', 'e1 date', 'exit1 date', 'sell 1 date', 'exit date', 'e1date', 'e1dt', 'exit1dt', 'first exit date', 'exit date 1', 'E1 Date'],
      'exit2Price': ['exit 2 price', 'e2 price', 'exit2 price', 'sell 2 price', 'exit-2\nprice', 'exit-2 price', 'exit-2 price (₹)', 'e2 price (₹)', 'E2 Price (₹)'],
      'exit2Qty': ['exit 2 qty', 'e2 qty', 'exit2 qty', 'sell 2 qty', 'exit-2\nqty', 'exit-2 qty', 'E2 Qty'],
      'exit2Date': ['exit 2 date', 'e2 date', 'exit2 date', 'sell 2 date', 'e2date', 'e2dt', 'exit2dt', 'second exit date', 'exit date 2', 'E2 Date'],
      'exit3Price': ['exit 3 price', 'e3 price', 'exit3 price', 'sell 3 price', 'exit-3\nprice', 'exit-3 price', 'exit-3 price (₹)', 'e3 price (₹)', 'E3 Price (₹)'],
      'exit3Qty': ['exit 3 qty', 'e3 qty', 'exit3 qty', 'sell 3 qty', 'exit-3\nqty', 'exit-3 qty', 'E3 Qty'],
      'exit3Date': ['exit 3 date', 'e3 date', 'exit3 date', 'sell 3 date', 'e3date', 'e3dt', 'exit3dt', 'third exit date', 'exit date 3', 'E3 Date'],
      'openQty': ['open qty', 'open quantity', 'open qty', 'remaining qty', 'balance qty'],
      'exitedQty': ['exited qty', 'exited quantity', 'exited qty', 'sold qty', 'closed qty'],
      'avgExitPrice': ['avg exit', 'average exit', 'avg. exit', 'avg exit price', 'average exit price', 'avg. exit price'],
      'stockMove': ['stock move', 'stock move %', 'stock move (%)', 'price move', 'move %'],
      'openHeat': ['open heat', 'open heat %', 'open heat (%)', 'heat', 'heat %'],
      'rewardRisk': ['r:r', 'reward:risk', 'reward: risk', 'rr', 'risk reward', 'reward risk', 'reward:risk', 'reward : risk'],
      'holdingDays': ['holding days', 'days', 'hold days', 'duration', 'holding period'],
      'positionStatus': ['status', 'position status', 'trade status', 'pos status'],
      'realisedAmount': ['realised amount', 'realized amount', 'realised amt', 'realized amt', 'trade amount'],
      'plRs': ['p/l', 'p/l rs', 'p/l (₹)', 'realized p/l', 'realised p/l', 'realized p/l (₹)', 'profit loss', 'pnl'],
      'pfImpact': ['pf impact', 'pf impact %', 'pf impact (%)', 'portfolio impact', 'portfolio impact %'],
      'cummPf': ['cumm pf', 'cumm. pf', 'cumm pf %', 'cumm. pf (%)', 'cumulative pf', 'cumulative portfolio'],
      'planFollowed': ['plan followed', 'plan followed?', 'followed plan', 'plan \nfollowed?'],
      'exitTrigger': ['exit trigger', 'trigger', 'exit reason', 'exit trigger', 'exit cause', 'reason'],
      'proficiencyGrowthAreas': ['growth areas', 'proficiency', 'improvement areas', 'growth areas', 'areas', 'improvement'],
      'baseDuration': ['base duration', 'duration', 'time frame', 'holding period'],
      'notes': ['notes', 'comments', 'remarks', 'description', 'memo', 'observation', 'note']
    };

    // Function to calculate similarity score between two strings
    const calculateSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();

      // Exact match
      if (s1 === s2) return 100;

      // Contains match
      if (s1.includes(s2) || s2.includes(s1)) return 80;

      // Remove common separators, newlines, special characters, and currency symbols for better matching
      const clean1 = s1.replace(/[-_\s\n\r\/\(\)\.\?:₹%]/g, '');
      const clean2 = s2.replace(/[-_\s\n\r\/\(\)\.\?:₹%]/g, '');
      if (clean1 === clean2) return 95;
      if (clean1.includes(clean2) || clean2.includes(clean1)) return 85;

      // Handle multi-line headers by removing newlines and extra spaces
      const normalized1 = s1.replace(/\s+/g, ' ').replace(/\n/g, ' ');
      const normalized2 = s2.replace(/\s+/g, ' ').replace(/\n/g, ' ');
      if (normalized1 === normalized2) return 90;
      if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return 75;

      // Enhanced word-based matching with better tokenization and abbreviation handling
      const words1 = s1.split(/[-_\s\n\r\/\(\)\.\?:₹%]+/).filter(w => w.length > 0);
      const words2 = s2.split(/[-_\s\n\r\/\(\)\.\?:₹%]+/).filter(w => w.length > 0);

      // Handle common abbreviations and variations
      const normalizeWord = (word: string): string => {
        const abbrevMap: { [key: string]: string } = {
          'qty': 'quantity',
          'avg': 'average',
          'pos': 'position',
          'pf': 'portfolio',
          'cumm': 'cumulative',
          'realised': 'realized',
          'amt': 'amount',
          'rs': 'rupees',
          'sl': 'stoploss',
          'tsl': 'trailingstop',
          'cmp': 'currentprice',
          'pl': 'profitloss',
          'pnl': 'profitloss'
        };
        return abbrevMap[word] || word;
      };

      const normalizedWords1 = words1.map(normalizeWord);
      const normalizedWords2 = words2.map(normalizeWord);

      const commonWords = normalizedWords1.filter(word => normalizedWords2.includes(word));
      if (commonWords.length > 0) {
        const score = (commonWords.length / Math.max(normalizedWords1.length, normalizedWords2.length)) * 70;
        return Math.min(score, 85); // Cap at 85 to ensure exact matches get higher scores
      }

      // Partial word matching for compound words
      let partialMatches = 0;
      for (const word1 of normalizedWords1) {
        for (const word2 of normalizedWords2) {
          if (word1.length > 2 && word2.length > 2) {
            if (word1.includes(word2) || word2.includes(word1)) {
              partialMatches++;
              break;
            }
          }
        }
      }

      if (partialMatches > 0) {
        return (partialMatches / Math.max(normalizedWords1.length, normalizedWords2.length)) * 50;
      }

      return 0;
    };

    // Special context-aware mapping for ambiguous "Date" columns and duplicate "SL" columns
    const mapAmbiguousColumnsWithContext = () => {
      const dateColumns: Array<{header: string, index: number}> = [];
      const slColumns: Array<{header: string, index: number}> = [];

      // Find all "Date" and "SL" columns with their positions
      headers.forEach((header, index) => {
        const cleanHeader = header.toLowerCase().trim();
        if (cleanHeader === 'date') {
          dateColumns.push({ header, index });
        }
        if (cleanHeader === 'sl') {
          slColumns.push({ header, index });
        }
      });

      // Handle multiple "Date" columns
      if (dateColumns.length > 1) {
        dateColumns.forEach((dateCol, arrayIndex) => {
          const colIndex = dateCol.index;

          // Look at previous 2 columns for better context
          const prev1Col = colIndex > 0 ? headers[colIndex - 1]?.toLowerCase().trim() : '';
          const prev2Col = colIndex > 1 ? headers[colIndex - 2]?.toLowerCase().trim() : '';

          // Map based on context and position
          if (arrayIndex === 0 && colIndex < 10) {
            // First "Date" column early in the CSV is likely the main trade date
            if (!mapping['date']) {
              mapping['date'] = dateCol.header;
              confidence['date'] = 95;
            }
          } else {
            // Subsequent "Date" columns - check context with enhanced patterns
            if (prev1Col.includes('qty') && (prev2Col.includes('exit-1') || prev2Col.includes('e1') || prev1Col.includes('exit'))) {
              if (!mapping['exit1Date']) {
                mapping['exit1Date'] = dateCol.header;
                confidence['exit1Date'] = 90;
              }
            } else if (prev1Col.includes('qty') && (prev2Col.includes('exit-2') || prev2Col.includes('e2'))) {
              if (!mapping['exit2Date']) {
                mapping['exit2Date'] = dateCol.header;
                confidence['exit2Date'] = 90;
              }
            } else if (prev1Col.includes('qty') && (prev2Col.includes('exit-3') || prev2Col.includes('e3'))) {
              if (!mapping['exit3Date']) {
                mapping['exit3Date'] = dateCol.header;
                confidence['exit3Date'] = 90;
              }
            } else if (prev1Col.includes('qty') && prev2Col.includes('p-1')) {
              if (!mapping['pyramid1Date']) {
                mapping['pyramid1Date'] = dateCol.header;
                confidence['pyramid1Date'] = 90;
              }
            } else if (prev1Col.includes('qty') && prev2Col.includes('p-2')) {
              if (!mapping['pyramid2Date']) {
                mapping['pyramid2Date'] = dateCol.header;
                confidence['pyramid2Date'] = 90;
              }
            }
            // Enhanced context patterns for your specific CSV format
            else if (prev1Col.includes('e1') && prev1Col.includes('qty')) {
              if (!mapping['exit1Date']) {
                mapping['exit1Date'] = dateCol.header;
                confidence['exit1Date'] = 85;
              }
            } else if (prev1Col.includes('e2') && prev1Col.includes('qty')) {
              if (!mapping['exit2Date']) {
                mapping['exit2Date'] = dateCol.header;
                confidence['exit2Date'] = 85;
              }
            } else if (prev1Col.includes('e3') && prev1Col.includes('qty')) {
              if (!mapping['exit3Date']) {
                mapping['exit3Date'] = dateCol.header;
                confidence['exit3Date'] = 85;
              }
            }
            // Check for exact E1, E2, E3 date patterns
            else if (colIndex > 0 && headers[colIndex - 1]?.toLowerCase().includes('e1')) {
              if (!mapping['exit1Date']) {
                mapping['exit1Date'] = dateCol.header;
                confidence['exit1Date'] = 90;
              }
            } else if (colIndex > 0 && headers[colIndex - 1]?.toLowerCase().includes('e2')) {
              if (!mapping['exit2Date']) {
                mapping['exit2Date'] = dateCol.header;
                confidence['exit2Date'] = 90;
              }
            } else if (colIndex > 0 && headers[colIndex - 1]?.toLowerCase().includes('e3')) {
              if (!mapping['exit3Date']) {
                mapping['exit3Date'] = dateCol.header;
                confidence['exit3Date'] = 90;
              }
            }
            // Fallback: map remaining Date columns to exit dates in order
            else if (arrayIndex === 1 && !mapping['exit1Date']) {
              mapping['exit1Date'] = dateCol.header;
              confidence['exit1Date'] = 75;
            } else if (arrayIndex === 2 && !mapping['exit2Date']) {
              mapping['exit2Date'] = dateCol.header;
              confidence['exit2Date'] = 75;
            } else if (arrayIndex === 3 && !mapping['exit3Date']) {
              mapping['exit3Date'] = dateCol.header;
              confidence['exit3Date'] = 75;
            }
          }
        });
      }

      // Handle multiple "SL" columns - first one is stop loss, second might be something else
      if (slColumns.length > 1) {
        slColumns.forEach((slCol, arrayIndex) => {
          const colIndex = slCol.index;

          // Look at surrounding columns for context
          const prev1Col = colIndex > 0 ? headers[colIndex - 1]?.toLowerCase().trim() : '';
          const next1Col = colIndex < headers.length - 1 ? headers[colIndex + 1]?.toLowerCase().trim() : '';

          if (arrayIndex === 0) {
            // First SL column is likely the actual stop loss
            if (!mapping['sl']) {
              mapping['sl'] = slCol.header;
              confidence['sl'] = 95;
            }
          } else {
            // Subsequent SL columns might be something else - skip or handle differently
            // Don't map subsequent SL columns to avoid confusion
            console.log('Skipping duplicate SL column at index:', colIndex, 'with context:', prev1Col, next1Col);
          }
        });
      }
    };

    // Apply context-aware mapping for ambiguous columns first
    mapAmbiguousColumnsWithContext();

    // Enhanced direct mapping for specific known columns with variations
    const directMappings: { [key: string]: string } = {
      'E1 Date': 'exit1Date',
      'E2 Date': 'exit2Date',
      'E3 Date': 'exit3Date',
      'SL %': 'slPercent',
      // Add common variations
      'Exit 1 Date': 'exit1Date',
      'Exit 2 Date': 'exit2Date',
      'Exit 3 Date': 'exit3Date',
      'Exit1 Date': 'exit1Date',
      'Exit2 Date': 'exit2Date',
      'Exit3 Date': 'exit3Date',
      'E1Date': 'exit1Date',
      'E2Date': 'exit2Date',
      'E3Date': 'exit3Date',
      'SL%': 'slPercent',
      'SL Percent': 'slPercent',
      'SL Per': 'slPercent',
      'Stop Loss %': 'slPercent',
      'Stop Loss Percent': 'slPercent'
    };

    Object.entries(directMappings).forEach(([columnName, fieldName]) => {
      // Try exact match first
      let columnIndex = headers.findIndex(h => h === columnName);

      // If exact match fails, try case-insensitive match
      if (columnIndex === -1) {
        columnIndex = headers.findIndex(h => h.toLowerCase().trim() === columnName.toLowerCase().trim());
      }

      // If still not found, try fuzzy matching for close variations
      if (columnIndex === -1) {
        columnIndex = headers.findIndex(h => {
          const cleanHeader = h.toLowerCase().replace(/[-_\s\n\r\/\(\)\.\?:₹%]/g, '');
          const cleanColumn = columnName.toLowerCase().replace(/[-_\s\n\r\/\(\)\.\?:₹%]/g, '');
          return cleanHeader === cleanColumn;
        });
      }

      console.log(`Looking for column "${columnName}" for field "${fieldName}": found at index ${columnIndex}`);

      if (columnIndex !== -1) {
        const actualColumnName = headers[columnIndex];
        const alreadyMappedField = mapping[fieldName];
        const columnAlreadyUsed = Object.values(mapping).includes(actualColumnName);

        console.log(`  - Field "${fieldName}" already mapped: ${alreadyMappedField ? 'YES to ' + alreadyMappedField : 'NO'}`);
        console.log(`  - Column "${actualColumnName}" already used: ${columnAlreadyUsed ? 'YES' : 'NO'}`);

        if (!mapping[fieldName] && !Object.values(mapping).includes(actualColumnName)) {
          mapping[fieldName] = actualColumnName;
          confidence[fieldName] = 100;
        }
      }
    });

    // Priority mapping: Map exact matches first, then similar matches
    const priorityFields = ['cmp', 'rewardRisk', 'setup', 'name']; // Fields that need exact matching first
    const regularFields = Object.keys(similarityMap).filter(field => !priorityFields.includes(field));

    // Process priority fields first with strict matching
    [...priorityFields, ...regularFields].forEach(field => {
      // Skip if already mapped by context-aware function
      if (mapping[field]) return;

      const keywords = similarityMap[field];
      if (!keywords) return;

      let bestMatch = '';
      let bestScore = 0;

      headers.forEach((header, headerIndex) => {
        keywords.forEach(keyword => {
          const score = calculateSimilarity(header, keyword);

          // Use different thresholds for different field types
          let threshold = 60; // Lower default threshold
          if (['setup', 'name', 'exitTrigger', 'proficiencyGrowthAreas', 'notes', 'baseDuration'].includes(field)) {
            threshold = 50; // Very low threshold for text fields
          } else if (['cmp', 'rewardRisk'].includes(field)) {
            threshold = 85; // Moderate threshold for fields that often get confused
          }

          if (score > bestScore && score >= threshold) {
            // Additional validation: check if this column actually has data and matches expected data type
            const hasData = hasValidData(headerIndex);
            const validDataType = validateFieldDataType(field, headerIndex);

            if (hasData && validDataType) {
              bestScore = score;
              bestMatch = header;
            }
          }
        });
      });

      if (bestMatch && !Object.values(mapping).includes(bestMatch)) {
        mapping[field] = bestMatch;
        confidence[field] = bestScore;
      }
    });

    return { mapping, confidence };
  }, [parsedData]);

  const handleFileUpload = useCallback(async (file: File) => {
    // Allow file upload without consent check - consent will be required after upload
    setError(null);

    setError(null); // Clear any previous errors
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        complete: async (results) => {
          try {
            if (results.errors && results.errors.length > 0) {
              }

            if (results.data && results.data.length > 0) {
              // Check if this is a Zerodha P&L statement FIRST (before any processing)
              const csvContent = results.data.map(row => (row as string[]).join(',')).join('\n');
              const isPnLStatement = isZerodhaPnLStatement(csvContent);

              if (isPnLStatement) {
                console.log('📊 Zerodha P&L Statement detected - processing charges');
                const chargesData = parseZerodhaCharges(csvContent);

                if (chargesData) {
                  // Show first toast immediately - Import success
                  addToast({
                    title: 'Charges Data Imported Successfully',
                    description: `Zerodha P&L charges (₹${chargesData.total.toFixed(2)}) have been parsed and are being processed.`,
                    color: 'success',
                    variant: 'solid',
                    radius: 'lg',
                    icon: <Icon icon="lucide:receipt" className="text-white text-base mr-2" />,
                    classNames: {
                      base: 'flex items-center w-full max-w-[400px] min-w-[300px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-success-500 transition-all duration-200 relative gap-2',
                      title: 'text-sm font-semibold text-white',
                      description: 'text-xs text-white/90'
                    }
                  });

                  // Show progress in modal
                  setError(null);
                  setStep('importing');
                  setImportProgress(50);

                  // Distribute charges across months and update tax analytics after a delay
                  setTimeout(async () => {
                    const currentYear = new Date().getFullYear().toString();
                    const distributedCharges = distributeChargesAcrossMonths(chargesData, currentYear);

                    // Update tax analytics component (this will trigger the second toast)
                    await updateChargesBreakdown(distributedCharges);

                    // Complete the progress
                    setImportProgress(100);

                    // Show final completion toast after database save
                    setTimeout(() => {
                      addToast({
                        title: 'Import Complete',
                        description: 'Navigate to Tax Analytics to view the imported charges breakdown.',
                        color: 'primary',
                        variant: 'solid',
                        radius: 'lg',
                        icon: <Icon icon="lucide:check-circle" className="text-white text-base mr-2" />,
                        classNames: {
                          base: 'flex items-center w-full max-w-[380px] min-w-[280px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-primary-500 transition-all duration-200 relative gap-2',
                          title: 'text-sm font-semibold text-white',
                          description: 'text-xs text-white/90'
                        }
                      });

                      // Close modal automatically after final toast
                      setTimeout(() => {
                        onOpenChange(false);
                        // Reset state
                        setStep('upload');
                        setParsedData(null);
                        setColumnMapping({});
                        setMappingConfidence({});
                        setPreviewTrades([]);
                        setImportProgress(0);
                        setIsZerodhaFormat(false);
                        setIsDhanFormat(false);
                        setIsUpstoxFormat(false);
                      }, 1500);
                    }, 1000);
                  }, 1000);

                  return; // Exit early for P&L statements
                } else {
                  setError('Failed to parse Zerodha P&L statement. Please check the file format.');
                  return;
                }
              }

              // Continue with regular CSV processing for non-P&L files
              const headers = results.data[0] as string[];
              const rows = results.data.slice(1) as any[][];

              // Filter out completely empty rows and clean headers
              const cleanHeaders = headers
                .filter(h => h && String(h).trim() !== '')
                .map(h => String(h)
                  .replace(/\n/g, ' ') // Replace newlines with spaces
                  .replace(/\r/g, ' ') // Replace carriage returns with spaces
                  .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                  .trim()
                );
              const cleanRows = rows.filter(row => {
                // Keep row if it has at least one non-empty, non-whitespace cell
                return row.some(cell =>
                  cell !== null &&
                  cell !== undefined &&
                  String(cell).trim() !== '' &&
                  String(cell).toLowerCase() !== 'stock name'
                );
              });

              if (cleanHeaders.length === 0) {
                setError('No valid columns found in the CSV file. Please check your file format.');
                return;
              }

              if (cleanRows.length === 0) {
                setError('No valid data rows found in the CSV file. Please check your file content.');
                return;
              }

              // COMPREHENSIVE DEBUGGING FOR BROKER DETECTION
              console.log('🚀 STARTING BROKER DETECTION');
              console.log('📁 File name:', file.name);
              console.log('📋 Raw headers:', headers);
              console.log('🧹 Clean headers:', cleanHeaders);
              console.log('📊 Total rows:', cleanRows.length);
              console.log('🔍 First few rows:', cleanRows.slice(0, 3));

              // Detect if this is a Zerodha tradebook format file
              console.log('🔍 Testing Zerodha format...');
              const isZerodha = detectZerodhaFormat(cleanHeaders);
              console.log('✅ Zerodha detection result:', isZerodha);
              setIsZerodhaFormat(isZerodha);

              // Detect if this is a Dhan tradebook format file
              console.log('🔍 Testing Dhan format...');
              const isDhan = detectDhanFormat(cleanHeaders);
              console.log('✅ Dhan detection result:', isDhan);
              setIsDhanFormat(isDhan);

              console.log('🎯 FINAL BROKER DETECTION RESULTS:', {
                fileName: file.name,
                isZerodha,
                isDhan,
                isUpstox: false, // CSV files are not Upstox format
                willUseRegularMapping: !isZerodha && !isDhan
              });

              setParsedData({
                headers: cleanHeaders,
                rows: cleanRows,
                fileName: file.name
              });

              // For Zerodha format, skip column mapping and go directly to preview
              if (isZerodha) {
                console.log('🎯 ZERODHA PROCESSING STARTED');
                console.log('📋 Headers for Zerodha:', cleanHeaders);
                console.log('📊 Rows for Zerodha:', cleanRows.length);

                try {
                  // Test if the import is working
                  console.log('🔍 Testing convertZerodhaToNexus function:', typeof convertZerodhaToNexus);

                  // Convert Zerodha data to Nexus trades
                  console.log('🔄 Calling convertZerodhaToNexus...');
                  const zerodhatrades = await convertZerodhaToNexus(cleanHeaders, cleanRows);
                  console.log('✅ convertZerodhaToNexus returned:', zerodhatrades.length, 'trades');

                  // Apply portfolio size calculations to the converted trades
                  console.log('🔄 Applying portfolio calculations...');
                  const processedTrades = zerodhatrades.map(trade => recalculateTradeFields(trade));
                  console.log('✅ Portfolio calculations complete');

                  setPreviewTrades(processedTrades);
                  setStep('preview');
                  console.log(`✅ ZERODHA PROCESSING COMPLETE: ${processedTrades.length} trades processed`);
                } catch (error) {
                  console.error('❌ ZERODHA PROCESSING FAILED:', error);
                  console.error('❌ Error stack:', error.stack);
                  setError(`Failed to process Zerodha file: ${error.message}`);
                  setIsZerodhaFormat(false); // Fall back to regular processing
                }
              } else if (isDhan) {
                console.log('🎯 DHAN PROCESSING STARTED');
                console.log('📋 Headers for Dhan:', cleanHeaders);
                console.log('📊 Rows for Dhan:', cleanRows.length);

                try {
                  // Show processing message for large datasets
                  if (cleanRows.length > 500) {
                    setError('Processing large Dhan dataset... Please wait.');
                    // Clear error after a moment to show it's processing
                    setTimeout(() => setError(null), 1000);
                  }

                  // Test if the import is working
                  console.log('🔍 Testing processDhanCSV function:', typeof processDhanCSV);

                  // Convert Dhan data to Nexus trades
                  console.log('🔄 Calling processDhanCSV...');
                  const dhanTrades = await processDhanCSV(cleanHeaders, cleanRows);
                  console.log('✅ processDhanCSV returned:', dhanTrades.length, 'trades');

                  // Apply portfolio size calculations to the converted trades
                  console.log('🔄 Applying portfolio calculations...');
                  const processedTrades = dhanTrades.map(trade => recalculateTradeFields(trade));
                  console.log('✅ Portfolio calculations complete');

                  setPreviewTrades(processedTrades);
                  setStep('preview');
                  console.log(`✅ DHAN PROCESSING COMPLETE: ${processedTrades.length} trades processed`);
                } catch (error) {
                  console.error('❌ DHAN PROCESSING FAILED:', error);
                  console.error('❌ Error stack:', error.stack);
                  setError(`Failed to process Dhan file: ${error.message}`);
                  setIsDhanFormat(false); // Fall back to regular processing
                }
              }

              // For non-broker formats, generate smart mapping and check for date columns
              if (!isZerodha && !isDhan) {
                console.log('🔄 REGULAR CSV PROCESSING - No broker format detected');
                console.log('📋 Generating smart mapping for headers:', cleanHeaders);

                // Regular CSV processing with column mapping
                const smartMapping = generateSmartMapping(cleanHeaders);
                console.log('✅ Smart mapping generated:', smartMapping);
                setColumnMapping(smartMapping.mapping);
                setMappingConfidence(smartMapping.confidence);

                // Check if there are any date columns mapped or dates without years
                const hasDateColumns = Object.keys(smartMapping.mapping).some(key => key.includes('Date') || key === 'date');

                // Check if any dates in the data lack years (need user input for year)
                const hasIncompleteYears = cleanRows.some(row => {
                  return Object.entries(smartMapping.mapping).some(([field, column]) => {
                  if (field.includes('Date') || field === 'date') {
                    const columnIndex = cleanHeaders.indexOf(column);
                    if (columnIndex !== -1 && row[columnIndex]) {
                      const dateValue = String(row[columnIndex]).trim();
                      // Check for dates without years: "29 April", "16/4", "21-Apr", etc.
                      return /^\d{1,2}[\s\-\/]\w+$/.test(dateValue) || // "29 April", "21-Apr"
                             /^\d{1,2}[\-\/]\d{1,2}$/.test(dateValue) || // "16/4", "21-4"
                             /^\w+[\s\-\/]\d{1,2}$/.test(dateValue); // "April 29", "Apr-21"
                    }
                  }
                  return false;
                  });
                });
              }

              // Don't auto-proceed to next step - stay on upload step so user can give consent
              // The user will manually proceed after giving consent
              console.log('File uploaded successfully, waiting for user consent');
            } else {
              setError('The CSV file appears to be empty or invalid. Please check your file.');
            }
          } catch (error) {
            setError('Failed to process the CSV file. Please check the file format and try again.');
          }
        },
        header: false,
        skipEmptyLines: true,
        transform: (value) => {
          // Minimal cleaning for performance
          if (typeof value === 'string') {
            return value.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          }
          return value;
        },
        dynamicTyping: false, // Disable automatic type conversion for better control
        fastMode: false, // Disable fast mode to properly handle quoted fields with commas
        delimiter: ',', // Explicitly set comma as delimiter
        quoteChar: '"', // Explicitly set quote character
        escapeChar: '"', // Explicitly set escape character
        error: (error) => {
          setError('CSV parsing failed: ' + error.message);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Excel files are ONLY supported for Upstox format
      const isUpstox = detectUpstoxFormat(file.name);

      if (isUpstox) {
        setIsUpstoxFormat(true);

        // First check if this is an Upstox charges/P&L file
        isUpstoxPnLStatement(file)
          .then(isPnLFile => {
            if (isPnLFile) {

              // Process Upstox charges file
              return parseUpstoxCharges(file)
                .then(chargesBreakdown => {
                  if (chargesBreakdown) {
                    // Save charges breakdown to tax data
                    // Get current year for distribution
                    const currentYear = new Date().getFullYear().toString();

                    // Create monthly distribution based on equal distribution
                    const monthlyTradeCounts: { [monthYear: string]: number } = {};
                    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                                   'July', 'August', 'September', 'October', 'November', 'December'];

                    // Distribute evenly across all months of current year
                    months.forEach(month => {
                      monthlyTradeCounts[month] = 1; // Equal weight for each month
                    });

                    // Distribute charges across months
                    const distributedCharges = distributeUpstoxChargesAcrossMonths(chargesBreakdown, monthlyTradeCounts);

                    // Create the charges data structure expected by updateChargesBreakdown
                    const chargesData = {
                      upstox: distributedCharges
                    };

                    updateChargesBreakdown(chargesData)
                      .then(() => {

                        // Show success message
                        addToast({
                          title: 'Upstox Charges Imported Successfully',
                          description: `Charges breakdown imported: ₹${chargesBreakdown.total.toFixed(2)} total charges`,
                          color: 'warning',
                          variant: 'solid',
                          radius: 'lg',
                          icon: <Icon icon="lucide:file-spreadsheet" className="text-white text-base mr-2" />,
                          classNames: {
                            base: 'flex items-center w-full max-w-[380px] min-w-[280px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-warning-500 transition-all duration-200 relative gap-2',
                            title: 'text-sm font-semibold text-white',
                            description: 'text-xs text-white/90'
                          }
                        });

                        // Close modal after success
                        setTimeout(() => {
                          onOpenChange(false);
                          setStep('upload');
                          setIsUpstoxFormat(false);
                        }, 2000);
                      })
                      .catch(error => {
                        setError('Failed to save charges breakdown: ' + error.message);
                      });
                  } else {
                    setError('Failed to parse Upstox charges from the file');
                  }
                })
                .catch(error => {
                  setError('Failed to parse Upstox charges: ' + error.message);
                });
            } else {
              // Process Upstox trade Excel file
              return processUpstoxExcel(file)
                .then(upstoxTrades => {
                  // Apply portfolio size calculations to the converted trades
                  const processedTrades = upstoxTrades.map(trade => recalculateTradeFields(trade));

                  setPreviewTrades(processedTrades);
                  setStep('preview');
                })
                .catch(error => {
                  setError(`Failed to process Upstox Excel file: ${error.message}`);
                  setIsUpstoxFormat(false); // Fall back to regular processing
                });
            }
          })
          .catch(error => {
            setError(`Failed to detect Upstox file type: ${error.message}`);
            setIsUpstoxFormat(false);
          });
      } else {
        setError('Excel files are only supported for Upstox format. For other brokers, please convert your Excel file to CSV format and try again.');
      }
    } else {
      setError('Unsupported file format. Only CSV files and Upstox Excel files are allowed.');
    }
  }, [generateSmartMapping, dataConsentGiven, detectZerodhaFormat, detectDhanFormat, detectUpstoxFormat, recalculateTradeFields]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];

    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      // Check if Excel file is Upstox format before processing
      const isUpstox = detectUpstoxFormat(file.name);
      if (isUpstox) {
        handleFileUpload(file);
      } else {
        setError('Excel files are only supported for Upstox format. For other brokers, please convert to CSV format.');
      }
    } else if (file) {
      setError('Only CSV files and Upstox Excel files are supported.');
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  // Helper function to check if a trade is completely blank
  const isTradeCompletelyBlank = useCallback((trade: Partial<Trade>) => {
    // Check essential fields that indicate a valid trade
    const essentialFields = [
      'name', 'entry', 'initialQty', 'date'
    ];

    // A trade is considered blank if all essential fields are empty/zero
    return essentialFields.every(field => {
      const value = trade[field as keyof Trade];
      if (typeof value === 'string') {
        return !value || value.trim() === '' || value.toLowerCase() === 'stock name';
      }
      if (typeof value === 'number') {
        return value === 0;
      }
      return !value;
    });
  }, []);

  // Generate preview trades based on mapping - optimized for speed
  const generatePreview = useCallback(() => {
    if (!parsedData) return;

    const trades: Trade[] = [];
    let validTradeCount = 0;

    // Only process first 10 rows for preview to keep it fast
    const previewRows = parsedData.rows.slice(0, 10);

    for (const row of previewRows) {
      if (trades.length >= 5) break;
      const trade: Partial<Trade> = {
        id: uuidv4(),
        tradeNo: '',
        date: new Date().toISOString(),
        name: '',
        setup: '',
        buySell: 'Buy',
        entry: 0,
        avgEntry: 0,
        sl: 0,
        tsl: 0,
        cmp: 0,
        initialQty: 0,
        pyramid1Price: 0,
        pyramid1Qty: 0,
        pyramid1Date: '',
        pyramid2Price: 0,
        pyramid2Qty: 0,
        pyramid2Date: '',
        positionSize: 0,
        allocation: 0,
        exit1Price: 0,
        exit1Qty: 0,
        exit1Date: '',
        exit2Price: 0,
        exit2Qty: 0,
        exit2Date: '',
        exit3Price: 0,
        exit3Qty: 0,
        exit3Date: '',
        openQty: 0,
        exitedQty: 0,
        avgExitPrice: 0,
        stockMove: 0,
        openHeat: 0,
        rewardRisk: 0,
        holdingDays: 0,
        positionStatus: 'Open',
        realisedAmount: 0,
        plRs: 0,
        pfImpact: 0,
        cummPf: 0,
        planFollowed: true,
        exitTrigger: '',
        proficiencyGrowthAreas: '',
        baseDuration: '',
        slPercent: 0,
        notes: '',
      };

      // Map values based on column mapping
      Object.entries(columnMapping).forEach(([field, column]) => {
        const columnIndex = parsedData.headers.indexOf(column);
        if (columnIndex !== -1 && row[columnIndex] !== undefined) {
          const value = row[columnIndex];



          // Type conversion based on field - ONLY for user input fields
          if (['entry', 'avgEntry', 'sl', 'tsl', 'cmp', 'pyramid1Price', 'pyramid2Price',
               'exit1Price', 'exit2Price', 'exit3Price', 'avgExitPrice', 'realisedAmount', 'plRs'].includes(field)) {
            // Enhanced number parsing for cross-platform compatibility
            const parsedNumber = parseFlexibleNumber(value);
            (trade as any)[field] = parsedNumber;
          } else if (['initialQty', 'pyramid1Qty', 'pyramid2Qty', 'exit1Qty', 'exit2Qty', 'exit3Qty',
                     'openQty', 'exitedQty', 'holdingDays'].includes(field)) {
            // Enhanced quantity parsing for cross-platform compatibility
            const parsedQuantity = parseFlexibleNumber(value);
            (trade as any)[field] = Math.round(parsedQuantity); // Quantities should be whole numbers
          } else if (['slPercent', 'allocation', 'stockMove', 'openHeat', 'pfImpact', 'cummPf', 'positionSize'].includes(field)) {
            // Enhanced percentage/decimal parsing
            const parsedPercent = parseFlexibleNumber(value);
            (trade as any)[field] = parsedPercent;
          } else if (field === 'buySell') {
            // Handle Buy/Sell field - normalize common variations
            const buySellValue = String(value || '').toLowerCase().trim();
            if (buySellValue === 'b' || buySellValue === 'buy' || buySellValue === 'long') {
              (trade as any)[field] = 'Buy';
            } else if (buySellValue === 's' || buySellValue === 'sell' || buySellValue === 'short') {
              (trade as any)[field] = 'Sell';
            } else {
              (trade as any)[field] = 'Buy'; // Default to Buy if unclear
            }
          } else if (field === 'planFollowed') {
            // Handle boolean fields
            const boolValue = String(value || '').toLowerCase();
            (trade as any)[field] = boolValue === 'true' || boolValue === 'yes' || boolValue === '1';
          } else if (field.includes('Date') && value) {
            // Enhanced date parsing with smart year assignment for pyramid/exit dates
            let tradeYear: number | undefined;

            // Get trade year from main date field for pyramid/exit dates, or use selected year
            if (['pyramid1Date', 'pyramid2Date', 'exit1Date', 'exit2Date', 'exit3Date'].includes(field)) {
              // First try to get year from the main trade date in the same row
              const mainDateField = columnMapping['date'];


              if (mainDateField) {
                const mainDateIndex = parsedData.headers.indexOf(mainDateField);
                if (mainDateIndex !== -1 && row[mainDateIndex]) {
                  const mainDateValue = String(row[mainDateIndex]).trim();
                  // Try to extract year from main date directly
                  if (/\d{4}/.test(mainDateValue)) {
                    const yearMatch = mainDateValue.match(/\d{4}/);
                    if (yearMatch) {
                      const extractedYear = parseInt(yearMatch[0], 10);
                      if (extractedYear >= 2000 && extractedYear <= new Date().getFullYear() + 5) {
                        tradeYear = extractedYear;
                      }
                    }
                  }

                  // If no year found in main date, parse it with current year
                  if (!tradeYear) {
                    const currentYear = new Date().getFullYear();
                    const mainDateParsed = parseDate(mainDateValue, undefined, currentYear);
                    if (mainDateParsed) {
                      // mainDateParsed is in ISO format (YYYY-MM-DD), so year is the first part
                      const [yearStr] = mainDateParsed.split('-');
                      tradeYear = parseInt(yearStr, 10);
                    }
                  }
                }
              }

              // Always fallback to current year if no valid year found
              if (!tradeYear || tradeYear < 2000) {
                tradeYear = new Date().getFullYear();
              }
            }

            const finalYear = tradeYear || new Date().getFullYear();
            const parsedDate = parseDate(value, undefined, finalYear);
            (trade as any)[field] = parsedDate || (() => {
              const today = new Date();
              const day = String(today.getDate()).padStart(2, '0');
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const year = today.getFullYear();
              return `${year}-${month}-${day}`; // ISO format for database
            })();
          } else if (field === 'positionStatus') {
            // Handle status field - normalize common variations
            const statusValue = String(value || '').toLowerCase().trim();
            if (statusValue === 'open' || statusValue === 'o') {
              (trade as any)[field] = 'Open';
            } else if (statusValue === 'closed' || statusValue === 'c') {
              (trade as any)[field] = 'Closed';
            } else if (statusValue === 'partial' || statusValue === 'p') {
              (trade as any)[field] = 'Partial';
            } else {
              (trade as any)[field] = statusValue || 'Open'; // Default to Open
            }
          } else if (field === 'rewardRisk') {
            // Handle R:R field - parse as decimal
            const rrValue = parseFlexibleNumber(value);
            (trade as any)[field] = rrValue;
          } else if (field === 'setup') {
            // Special handling for setup field - reject numeric values
            const setupValue = String(value || '').trim();
            // If the value looks like a number (price), don't use it for setup
            if (setupValue && !(/^\d+\.?\d*$/.test(setupValue))) {
              (trade as any)[field] = setupValue;
            } else {
              (trade as any)[field] = ''; // Leave empty if it's a numeric value
            }
          } else if (['name', 'exitTrigger', 'proficiencyGrowthAreas', 'notes', 'baseDuration'].includes(field)) {
            // Handle text fields - store as string, trim whitespace
            (trade as any)[field] = String(value || '').trim();
          } else {
            (trade as any)[field] = String(value || '');
          }
        }
      });

      // Only include non-blank trades in preview
      if (!isTradeCompletelyBlank(trade)) {
        validTradeCount++;
        trade.tradeNo = String(validTradeCount);
        trades.push(recalculateTradeFields(trade as Trade));
      }
    }

    setPreviewTrades(trades);
    setStep('preview');
  }, [parsedData, columnMapping, recalculateTradeFields, isTradeCompletelyBlank]);

  const handleImport = useCallback(async () => {
    // For broker formats (Zerodha, Dhan, Upstox), we don't need parsedData as they use previewTrades
    if (!parsedData && !isZerodhaFormat && !isDhanFormat && !isUpstoxFormat) return;

    setStep('importing');
    setImportProgress(0);
    setError(null);

    // Small delay to ensure UI updates before starting import
    await new Promise(resolve => setTimeout(resolve, 100));

    // CRITICAL FIX: For Zerodha format, use the already processed preview trades
    if (isZerodhaFormat && previewTrades.length > 0) {
      console.log('🎯 Importing Zerodha trades from preview data');
      setImportProgress(50);

      // Import the already processed Zerodha trades
      onImport(previewTrades);

      setImportProgress(100);

      // Small delay to show completion before closing
      setTimeout(() => {
        onOpenChange(false);

        // Reset state
        setStep('upload');
        setParsedData(null);
        setColumnMapping({});
        setMappingConfidence({});
        setPreviewTrades([]);
        setImportProgress(0);
        setIsZerodhaFormat(false);
        setIsDhanFormat(false);
        setIsUpstoxFormat(false);
      }, 1000);

      return;
    }

    // CRITICAL FIX: For Dhan format, use the already processed preview trades
    if (isDhanFormat && previewTrades.length > 0) {
      console.log('🎯 Importing Dhan trades from preview data');
      setImportProgress(50);

      // Import the already processed Dhan trades
      onImport(previewTrades);

      setImportProgress(100);

      // Show success toast for Dhan trade imports
      addToast({
        title: 'Dhan Trades Imported Successfully',
        description: `${previewTrades.length} trade${previewTrades.length > 1 ? 's' : ''} imported successfully from Dhan.`,
        color: 'success',
        variant: 'solid',
        radius: 'lg',
        icon: <Icon icon="lucide:trending-up" className="text-white text-base mr-2" />,
        classNames: {
          base: 'flex items-center w-full max-w-[380px] min-w-[280px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-success-500 transition-all duration-200 relative gap-2',
          title: 'text-sm font-semibold text-white',
          description: 'text-xs text-white/90'
        }
      });

      // Small delay to show completion before closing
      setTimeout(() => {
        onOpenChange(false);

        // Reset state
        setStep('upload');
        setParsedData(null);
        setColumnMapping({});
        setMappingConfidence({});
        setPreviewTrades([]);
        setImportProgress(0);
        setIsDhanFormat(false);
      }, 1500);

      return;
    }

    // CRITICAL FIX: For Upstox format, use the already processed preview trades
    if (isUpstoxFormat && previewTrades.length > 0) {
      console.log('🎯 Importing Upstox trades from preview data');
      setImportProgress(50);

      // Import the already processed Upstox trades
      onImport(previewTrades);

      setImportProgress(100);

      // Show success toast for Upstox trade imports
      addToast({
        title: 'Upstox Trades Imported Successfully',
        description: `${previewTrades.length} trade${previewTrades.length > 1 ? 's' : ''} imported successfully from Upstox Excel.`,
        color: 'warning',
        variant: 'solid',
        radius: 'lg',
        icon: <Icon icon="lucide:file-spreadsheet" className="text-white text-base mr-2" />,
        classNames: {
          base: 'flex items-center w-full max-w-[380px] min-w-[280px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-warning-500 transition-all duration-200 relative gap-2',
          title: 'text-sm font-semibold text-white',
          description: 'text-xs text-white/90'
        }
      });

      // Small delay to show completion before closing
      setTimeout(() => {
        onOpenChange(false);

        // Reset state
        setStep('upload');
        setParsedData(null);
        setColumnMapping({});
        setMappingConfidence({});
        setPreviewTrades([]);
        setImportProgress(0);
        setIsZerodhaFormat(false);
        setIsDhanFormat(false);
        setIsUpstoxFormat(false);
      }, 1500);

      return;
    }

    // Regular CSV processing for non-broker files
    const trades: Trade[] = [];
    const totalRows = parsedData.rows.length;
    let validTradeCount = 0;
    let skippedBlankTrades = 0;
    let dateParsingErrors: string[] = [];

    // Process in smaller chunks for better progress visibility
    const CHUNK_SIZE = 10; // Process 10 trades at a time for better progress updates
    const chunks = [];

    // Split rows into chunks
    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
      chunks.push(parsedData.rows.slice(i, i + CHUNK_SIZE));
    }

    // Process chunks with yielding to prevent UI freezing
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      // Update progress at the start of each chunk
      const initialProgress = (chunkIndex / chunks.length) * 100;
      setImportProgress(initialProgress);

      // Process each row in the chunk
      for (const row of chunk) {

      // Create base trade object
      const trade: Partial<Trade> = {
        id: uuidv4(),
        tradeNo: '', // Will be set after filtering
        date: new Date().toISOString(),
        name: '',
        setup: '',
        buySell: 'Buy',
        entry: 0,
        avgEntry: 0,
        sl: 0,
        tsl: 0,
        cmp: 0,
        initialQty: 0,
        pyramid1Price: 0,
        pyramid1Qty: 0,
        pyramid1Date: '',
        pyramid2Price: 0,
        pyramid2Qty: 0,
        pyramid2Date: '',
        positionSize: 0,
        allocation: 0,
        exit1Price: 0,
        exit1Qty: 0,
        exit1Date: '',
        exit2Price: 0,
        exit2Qty: 0,
        exit2Date: '',
        exit3Price: 0,
        exit3Qty: 0,
        exit3Date: '',
        openQty: 0,
        exitedQty: 0,
        avgExitPrice: 0,
        stockMove: 0,
        openHeat: 0,
        rewardRisk: 0,
        holdingDays: 0,
        positionStatus: 'Open',
        realisedAmount: 0,
        plRs: 0,
        pfImpact: 0,
        cummPf: 0,
        planFollowed: true,
        exitTrigger: '',
        proficiencyGrowthAreas: '',
        baseDuration: '',
        slPercent: 0,
        notes: '',
      };

      // Map values based on column mapping
      Object.entries(columnMapping).forEach(([field, column]) => {
        const columnIndex = parsedData.headers.indexOf(column);
        if (columnIndex !== -1 && row[columnIndex] !== undefined) {
          const value = row[columnIndex];

          // Type conversion based on field - ONLY for user input fields
          if (['entry', 'avgEntry', 'sl', 'tsl', 'cmp', 'pyramid1Price', 'pyramid2Price',
               'exit1Price', 'exit2Price', 'exit3Price', 'avgExitPrice', 'realisedAmount', 'plRs'].includes(field)) {
            // Enhanced number parsing for cross-platform compatibility
            const parsedNumber = parseFlexibleNumber(value);
            (trade as any)[field] = parsedNumber;
          } else if (['initialQty', 'pyramid1Qty', 'pyramid2Qty', 'exit1Qty', 'exit2Qty', 'exit3Qty',
                     'openQty', 'exitedQty', 'holdingDays'].includes(field)) {
            // Enhanced quantity parsing for cross-platform compatibility
            const parsedQuantity = parseFlexibleNumber(value);
            (trade as any)[field] = Math.round(parsedQuantity); // Quantities should be whole numbers
          } else if (['slPercent', 'allocation', 'stockMove', 'openHeat', 'pfImpact', 'cummPf', 'positionSize'].includes(field)) {
            // Enhanced percentage/decimal parsing
            const parsedPercent = parseFlexibleNumber(value);
            (trade as any)[field] = parsedPercent;
          } else if (field === 'buySell') {
            // Handle Buy/Sell field - normalize common variations
            const buySellValue = String(value || '').toLowerCase().trim();
            if (buySellValue === 'b' || buySellValue === 'buy' || buySellValue === 'long') {
              (trade as any)[field] = 'Buy';
            } else if (buySellValue === 's' || buySellValue === 'sell' || buySellValue === 'short') {
              (trade as any)[field] = 'Sell';
            } else {
              (trade as any)[field] = 'Buy'; // Default to Buy if unclear
            }
          } else if (field === 'planFollowed') {
            // Handle boolean fields
            const boolValue = String(value || '').toLowerCase();
            (trade as any)[field] = boolValue === 'true' || boolValue === 'yes' || boolValue === '1';
          } else if (field.includes('Date') && value) {
            // Enhanced date parsing with smart year assignment for pyramid/exit dates
            let tradeYear: number | undefined;

            // Get trade year from main date field for pyramid/exit dates, or use selected year
            if (['pyramid1Date', 'pyramid2Date', 'exit1Date', 'exit2Date', 'exit3Date'].includes(field)) {
              // First try to get year from the main trade date in the same row
              const mainDateField = columnMapping['date'];
              if (mainDateField) {
                const mainDateIndex = parsedData.headers.indexOf(mainDateField);
                if (mainDateIndex !== -1 && row[mainDateIndex]) {
                  const mainDateValue = String(row[mainDateIndex]).trim();

                  // Try to extract year from main date directly
                  if (/\d{4}/.test(mainDateValue)) {
                    const yearMatch = mainDateValue.match(/\d{4}/);
                    if (yearMatch) {
                      const extractedYear = parseInt(yearMatch[0], 10);
                      if (extractedYear >= 2000 && extractedYear <= new Date().getFullYear() + 5) {
                        tradeYear = extractedYear;
                      }
                    }
                  }

                  // If no year found in main date, parse it with current year
                  if (!tradeYear) {
                    const currentYear = new Date().getFullYear();
                    const mainDateParsed = parseDate(mainDateValue, undefined, currentYear);
                    if (mainDateParsed) {
                      // mainDateParsed is in ISO format (YYYY-MM-DD), so year is the first part
                      const [yearStr] = mainDateParsed.split('-');
                      tradeYear = parseInt(yearStr, 10);
                    }
                  }
                }
              }

              // Always fallback to current year if no valid year found
              if (!tradeYear || tradeYear < 2000) {
                tradeYear = new Date().getFullYear();
              }
            }

            const parsedDate = parseDate(value, undefined, tradeYear || new Date().getFullYear());
            if (!parsedDate && value) {
              dateParsingErrors.push('Row ' + (validTradeCount + skippedBlankTrades + 1) + ': Invalid date "' + value + '" in ' + field);
            }
            (trade as any)[field] = parsedDate || (() => {
              const today = new Date();
              const day = String(today.getDate()).padStart(2, '0');
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const year = today.getFullYear();
              return `${year}-${month}-${day}`; // ISO format for database
            })();
          } else if (field === 'positionStatus') {
            // Handle status field - normalize common variations
            const statusValue = String(value || '').toLowerCase().trim();
            if (statusValue === 'open' || statusValue === 'o') {
              (trade as any)[field] = 'Open';
            } else if (statusValue === 'closed' || statusValue === 'c') {
              (trade as any)[field] = 'Closed';
            } else if (statusValue === 'partial' || statusValue === 'p') {
              (trade as any)[field] = 'Partial';
            } else {
              (trade as any)[field] = statusValue || 'Open'; // Default to Open
            }
          } else if (field === 'rewardRisk') {
            // Handle R:R field - parse as decimal
            const rrValue = parseFlexibleNumber(value);
            (trade as any)[field] = rrValue;
          } else if (field === 'setup') {
            // Special handling for setup field - reject numeric values
            const setupValue = String(value || '').trim();
            // If the value looks like a number (price), don't use it for setup
            if (setupValue && !(/^\d+\.?\d*$/.test(setupValue))) {
              (trade as any)[field] = setupValue;
            } else {
              (trade as any)[field] = ''; // Leave empty if it's a numeric value
            }
          } else if (['name', 'exitTrigger', 'proficiencyGrowthAreas', 'notes', 'baseDuration'].includes(field)) {
            // Handle text fields - store as string, trim whitespace
            (trade as any)[field] = String(value || '').trim();
          } else {
            (trade as any)[field] = String(value || '');
          }
        }
      });

        // Check if trade is completely blank and skip if so
        if (isTradeCompletelyBlank(trade)) {
          skippedBlankTrades++;
        } else {
          // Assign sequential trade number only for valid trades
          validTradeCount++;
          trade.tradeNo = String(validTradeCount);

          // Recalculate all auto-populated fields
          const recalculatedTrade = recalculateTradeFields(trade as Trade);
          trades.push(recalculatedTrade);
        }
      }

      // Update progress after each chunk with more accurate calculation
      const actualProcessedRows = Math.min((chunkIndex + 1) * CHUNK_SIZE, totalRows);
      const progress = Math.round((actualProcessedRows / totalRows) * 100);
      setImportProgress(progress);

      // Yield control to browser to prevent freezing and make progress visible
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => {
          // Add a small delay to make progress visible
          setTimeout(() => {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(resolve);
            } else {
              resolve(undefined);
            }
          }, 50); // 50ms delay to make progress visible
        });
      }
    }

    // Show date parsing warnings if any
    if (dateParsingErrors.length > 0) {
      const errorMessage = 'Import completed with ' + dateParsingErrors.length + ' date parsing warnings. Some dates may have been set to today\'s date. Check the imported trades and update dates as needed.';
      setError(errorMessage);

      // Still proceed with import but show warning
      setTimeout(() => setError(null), 5000); // Clear error after 5 seconds
    }

    // Import trades
    onImport(trades);

    setImportProgress(100);

    // Show success toast for regular trade imports
    addToast({
      title: 'Trades Imported Successfully',
      description: `${trades.length} trade${trades.length > 1 ? 's' : ''} imported successfully to your journal.`,
      color: 'success',
      variant: 'solid',
      radius: 'lg',
      icon: <Icon icon="lucide:trending-up" className="text-white text-base mr-2" />,
      classNames: {
        base: 'flex items-center w-full max-w-[380px] min-w-[280px] p-3 pr-6 rounded-[12px] shadow-lg border-0 bg-success-500 transition-all duration-200 relative gap-2',
        title: 'text-sm font-semibold text-white',
        description: 'text-xs text-white/90'
      }
    });

    // Small delay to show completion before closing
    setTimeout(() => {
      onOpenChange(false);

      // Reset state
      setStep('upload');
      setParsedData(null);
      setColumnMapping({});
      setMappingConfidence({});
      setPreviewTrades([]);
      setImportProgress(0);
    }, 1500); // Slightly longer delay to show the toast
  }, [parsedData, columnMapping, onImport, onOpenChange, recalculateTradeFields, isTradeCompletelyBlank, isZerodhaFormat, previewTrades]);

  // Auto-proceed when consent is given after file upload
  useEffect(() => {
    if (dataConsentGiven && parsedData && step === 'upload') {
      // For broker formats (Zerodha/Dhan/Upstox), we already processed and went to preview in handleFileUpload
      // So we don't need to auto-proceed here
      if (isZerodhaFormat || isDhanFormat || isUpstoxFormat) {
        return;
      }

      // Check if we need date format step for regular CSV files
      const hasDateColumns = parsedData.headers.some(header =>
        header.toLowerCase().includes('date') &&
        !header.toLowerCase().includes('p1') &&
        !header.toLowerCase().includes('p2') &&
        !header.toLowerCase().includes('e1') &&
        !header.toLowerCase().includes('e2') &&
        !header.toLowerCase().includes('e3')
      );

      const hasIncompleteYears = parsedData.rows.some(row => {
        return parsedData.headers.some((header, index) => {
          if (header.toLowerCase().includes('date')) {
            const value = row[index];
            return value && typeof value === 'string' &&
                   (value.includes('/') || value.includes('-')) &&
                   !value.includes('20') && !value.includes('19');
          }
          return false;
        });
      });

      // Auto-proceed to next step with small delay for better UX
      setTimeout(() => {
        if (hasDateColumns || hasIncompleteYears) {
          setStep('dateFormat');
        } else {
          setStep('mapping');
        }
      }, 300);
    }
  }, [dataConsentGiven, parsedData, step, isZerodhaFormat, isDhanFormat, isUpstoxFormat]);

  const resetModal = useCallback(() => {
    setStep('upload');
    setParsedData(null);
    setColumnMapping({});
    setMappingConfidence({});
    setPreviewTrades([]);
    setImportProgress(0);
    setError(null);
    setSelectedDateFormat('auto');
    setShowImportBanner(true); // Reset banner to show every time modal opens
    setDataConsentGiven(false); // Reset data consent when modal resets
    setIsZerodhaFormat(false); // Reset Zerodha format detection
    setIsDhanFormat(false); // Reset Dhan format detection
    setIsUpstoxFormat(false); // Reset Upstox format detection
  }, []);




  // Show under development banner if upload is disabled
  if (isUploadDisabled) {
    return (
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="2xl"
        classNames={{
          base: "max-h-[95vh]",
          body: "p-0",
          header: "border-b border-divider/50",
          footer: "border-t border-divider/50"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-default-100 dark:bg-default-200/20">
                    <Icon icon="lucide:construction" className="text-foreground-600 w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground-800 dark:text-foreground-200">
                    Upload Feature Under Development
                  </h2>
                </div>
              </ModalHeader>

              <ModalBody className="p-8">
                <div className="text-center space-y-6">
                  {/* Main Icon */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-default-100 dark:bg-default-200/10 flex items-center justify-center">
                        <Icon icon="lucide:upload-cloud" className="w-10 h-10 text-foreground-500" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-600 dark:bg-slate-400 flex items-center justify-center">
                        <Icon icon="lucide:wrench" className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground-800 dark:text-foreground-200">
                      We're Working on Something Better
                    </h3>
                    <p className="text-foreground-600 dark:text-foreground-400 leading-relaxed max-w-md mx-auto">
                      Our CSV upload feature is getting a major upgrade to make your trade importing experience even better.
                    </p>
                  </div>

                  {/* Features Coming Soon */}
                  <div className="bg-default-50 dark:bg-default-100/5 rounded-lg p-6 border border-divider/50">
                    <h4 className="font-medium text-foreground-700 dark:text-foreground-300 mb-4 flex items-center gap-2">
                      <Icon icon="lucide:sparkles" className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      What's Coming:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-foreground-600 dark:text-foreground-400">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:zap" className="w-3 h-3 text-foreground-500" />
                        Faster processing
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:shield-check" className="w-3 h-3 text-foreground-500" />
                        Better error handling
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:brain" className="w-3 h-3 text-foreground-500" />
                        Smarter column mapping
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:smartphone" className="w-3 h-3 text-foreground-500" />
                        Mobile optimization
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="text-center">
                    <p className="text-sm text-foreground-500 dark:text-foreground-500">
                      Expected to be back soon. Thank you for your patience! 🚀
                    </p>
                  </div>
                </div>
              </ModalBody>

              <ModalFooter className="justify-center">
                <Button
                  variant="flat"
                  size="sm"
                  onPress={onClose}
                  className="bg-default-100 hover:bg-default-200 text-foreground-700 dark:bg-default-200/20 dark:hover:bg-default-200/30 dark:text-foreground-300 font-medium px-6 py-2 h-8"
                  startContent={<Icon icon="lucide:check" className="w-3 h-3" />}
                >
                  Got it
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="5xl"
      scrollBehavior="inside"
      onClose={resetModal}
      classNames={{
        base: "max-h-[95vh] mx-2 sm:mx-4 lg:mx-6",
        body: "p-0",
        header: "border-b border-divider/50 bg-default-50/50 dark:bg-default-100/5",
        footer: "border-t border-divider/50 bg-default-50/50 dark:bg-default-100/5"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="px-4 py-3">
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-2 mt-3 py-2 px-3 bg-default-50 dark:bg-default-100/5 rounded border border-default-200 dark:border-default-100/10 overflow-x-auto">
                {(() => {
                  // For broker formats (Zerodha, Dhan, Upstox), show simplified steps: upload -> preview -> importing
                  const steps = (isZerodhaFormat || isDhanFormat || isUpstoxFormat)
                    ? ['upload', 'preview', 'importing']
                    : ['upload', 'dateFormat', 'mapping', 'preview', 'importing'];

                  return steps.map((stepName, index) => (
                    <React.Fragment key={stepName}>
                      <div className={'flex items-center gap-1.5 flex-shrink-0 ' + (
                        step === stepName ? 'text-foreground' :
                        steps.indexOf(step) > index ? 'text-default-600' : 'text-default-400'
                      )}>
                        <div className={'w-5 h-5 rounded flex items-center justify-center text-xs font-medium transition-all duration-200 ' + (
                          step === stepName ? 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900' :
                          steps.indexOf(step) > index ? 'bg-success text-success-foreground' : 'bg-default-200 dark:bg-default-100/10 text-default-500'
                        )}>
                          {steps.indexOf(step) > index ?
                            <Icon icon="lucide:check" className="w-3 h-3" /> :
                            index + 1
                          }
                        </div>
                        <span className="text-xs font-medium capitalize hidden sm:inline">
                          {stepName === 'dateFormat' ? 'Date' : stepName}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={'w-6 h-0.5 rounded-full transition-colors flex-shrink-0 ' + (
                          steps.indexOf(step) > index ? 'bg-success' : 'bg-default-300 dark:bg-default-100/20'
                        )} />
                      )}
                    </React.Fragment>
                  ));
                })()}
              </div>
            </ModalHeader>

            {/* Dismissible Import Banner */}
            {showImportBanner && (
              <div className="mx-4 mt-4 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg relative">
                <button
                  onClick={() => setShowImportBanner(false)}
                  className="absolute top-2 right-2 p-1 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-full transition-colors"
                  aria-label="Dismiss banner"
                >
                  <Icon icon="lucide:x" className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </button>

                <div className="flex items-center gap-3 pr-8">
                  <div className="flex-shrink-0">
                    <Icon icon="lucide:construction" className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                      Custom Journal Import - Now Live!
                    </h3>
                    <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                      We are live for custom journal import only. Broker tradebook import is currently under development - <span className="text-sm font-bold text-orange-800 dark:text-orange-200">Stay Tuned!</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:upload" className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs font-medium text-orange-800 dark:text-orange-200">
                      Try importing your custom journal by mapping columns as guided by the system
                    </span>
                  </div>
                </div>
              </div>
            )}

            <ModalBody className="p-4">
              <AnimatePresence mode="wait">
                {step === 'upload' && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div
                      className={'border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer group ' + (
                        dragActive
                          ? 'border-slate-400 bg-slate-50 dark:bg-slate-950/20'
                          : 'border-default-300 hover:border-slate-300 hover:bg-default-50 dark:hover:bg-default-100/5'
                      )}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      {!parsedData ? (
                        // Upload state
                        <div className="flex flex-col items-center gap-4">
                          <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            dragActive
                              ? 'bg-slate-100 dark:bg-slate-800 scale-105'
                              : 'bg-slate-50 dark:bg-slate-900 group-hover:scale-105'
                          }`}>
                            <Icon icon="lucide:file-text" className={`w-5 h-5 transition-colors duration-200 ${
                              dragActive
                                ? 'text-slate-600 dark:text-slate-400'
                                : 'text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400'
                            }`} />
                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                              dragActive
                                ? 'bg-slate-600 dark:bg-slate-400'
                                : 'bg-slate-500 group-hover:bg-slate-600'
                            }`}>
                              <Icon icon="lucide:plus" className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                          <div className="text-center space-y-1">
                            <h3 className="text-base font-semibold text-foreground">
                              Upload Trade File
                            </h3>
                            <p className="text-sm text-default-500">
                              CSV files (Zerodha, Dhan) or Excel files (Upstox only)
                            </p>
                            <p className="text-xs text-default-400">
                              Drag & drop your file here or click to browse
                            </p>
                          </div>
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-upload"
                          />
                          <label htmlFor="file-upload">
                            <Button
                              as="span"
                              size="md"
                              variant="bordered"
                              className="border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-foreground font-medium transition-all duration-200"
                              startContent={<Icon icon="lucide:upload" className="w-4 h-4" />}
                            >
                              Choose File
                            </Button>
                          </label>
                        </div>
                      ) : (
                        // Success state
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-4"
                        >
                          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                            <Icon icon="lucide:check" className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="text-center space-y-2">
                            <h3 className="text-base font-semibold text-green-800 dark:text-green-200">
                              File Uploaded Successfully
                            </h3>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {parsedData.fileName}
                              </p>
                              <p className="text-xs text-default-500">
                                {parsedData.rows.length} rows • {parsedData.headers.length} columns
                              </p>
                              {(isZerodhaFormat || isDhanFormat || isUpstoxFormat) && (
                                <div className="flex items-center justify-center gap-1 mt-2">
                                  {isZerodhaFormat && (
                                    <Chip
                                      size="sm"
                                      color="primary"
                                      variant="flat"
                                      startContent={<Icon icon="lucide:zap" className="w-3 h-3" />}
                                    >
                                      Zerodha Format Detected
                                    </Chip>
                                  )}
                                  {isDhanFormat && (
                                    <Chip
                                      size="sm"
                                      color="success"
                                      variant="flat"
                                      startContent={<Icon icon="lucide:trending-up" className="w-3 h-3" />}
                                    >
                                      Dhan Format Detected
                                    </Chip>
                                  )}
                                  {isUpstoxFormat && (
                                    <Chip
                                      size="sm"
                                      color="warning"
                                      variant="flat"
                                      startContent={<Icon icon="lucide:file-spreadsheet" className="w-3 h-3" />}
                                    >
                                      Upstox Format Detected
                                    </Chip>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="bordered"
                            className="text-xs"
                            onPress={() => {
                              setParsedData(null);
                              setDataConsentGiven(false);
                              setError(null);
                            }}
                            startContent={<Icon icon="lucide:upload" className="w-3 h-3" />}
                          >
                            Upload Different File
                          </Button>
                        </motion.div>
                      )}
                    </div>

                    {error && (
                      <div className="p-3 bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Icon icon="lucide:alert-circle" className="w-4 h-4 text-danger-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              className="mt-2 h-7 px-3 text-xs"
                              onPress={() => setError(null)}
                            >
                              Try Again
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-default-50 dark:bg-default-100/5 border border-default-200 dark:border-default-100/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon="lucide:file-text" className="w-4 h-4 text-default-600" />
                        <span className="text-sm font-medium text-foreground">CSV Format Only</span>
                      </div>
                      <p className="text-xs text-default-500 mb-2">
                        Upload comma-separated values file with trade data headers.
                      </p>
                      <div className="text-xs text-warning-600 dark:text-warning-400">
                        <Icon icon="lucide:info" className="w-3 h-3 inline mr-1" />
                        Excel files no longer supported - convert to CSV first
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-default-500 mb-3">
                        Need a template? Download our sample CSV format
                      </p>

                      {/* Big Download Template Button */}
                      <div className="flex justify-center">
                        <Button
                          isIconOnly
                          size="lg"
                          variant="light"
                          className="w-12 h-12 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 shadow-none focus:shadow-none border-0"
                          onPress={() => {
                            // Create CSV template exactly matching the trading_template.csv structure
                            const sampleCSV = 'Trade No.,Date,Name,Setup,Buy/Sell,Entry (),Avg. Entry (),SL (),SL %,TSL (),CMP (),Initial Qty,P1 Price (),P1 Qty,P1 Date,P2 Price (),P2 Qty,P2 Date,Pos. Size,Allocation (%),E1 Price (),E1 Qty,E1 Date,E2 Price (),E2 Qty,E2 Date,E3 Price (),E3 Qty,E3 Date,Open Qty,Exited Qty,Avg. Exit (),Stock Move (%),Open Heat (%),R:R,Holding Days,Status,Realized Amount,Realized P/L (),PF Impact (%),Cumm. PF (%),Plan Followed,Exit Trigger,Growth Areas,Charts,Notes\n' +
'1,16-Jun-2025,63MOONS,Pivot Bo,Buy,918.4,918.4,907,1.241289199,0,1003,14,0,0,,0,0,,12858,4.300334448,907,14,15-Jun-2025,0,0,,0,0,,0,14,907,-1.241289199,,1,1,Closed,12698,-159.6,-0.05337792642,22.02288902,TRUE,,ENTRY POINT,[object Object],EXITED TO EARLY\n' +
'2,17-Jun-2025,EXAMPLE,Sample,Sell,100,100,105,5,0,95,10,0,0,,0,0,,1000,3.33,105,10,18-Jun-2025,0,0,,0,0,,0,10,105,5,,1,1,Closed,1050,50,0.167,22.19,TRUE,,SAMPLE,[object Object],SAMPLE TRADE';

                            // Create and download file
                            const blob = new Blob([sampleCSV], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'trade_journal_template.csv';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                          }}
                        >
                          <Icon icon="lucide:download" className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>

                    {/* Elegant Data Consent Disclaimer */}
                    <motion.div
                      className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 dark:from-gray-900/50 dark:via-gray-800/30 dark:to-gray-900/50 border border-gray-200/60 dark:border-gray-700/40 rounded-2xl shadow-sm backdrop-blur-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    >
                      {/* Subtle background pattern */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/5 opacity-50" />

                      <div className="relative p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-black dark:from-gray-700 dark:to-gray-900 rounded-xl flex items-center justify-center shadow-lg">
                              <Icon icon="lucide:shield-check" className="w-5 h-5 text-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="mb-4">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
                                Data Privacy & Security
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                Your trading data protection commitment
                              </p>
                            </div>

                            <div className="space-y-4 mb-6">
                              <div className="bg-white/60 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                                  <Icon icon="lucide:shield-check" className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                  Our Data Commitment
                                </h4>
                                <div className="grid gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                      <span className="font-medium">Secure Server Storage:</span> Your trading data is stored securely on our servers
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                      <span className="font-medium">Never Shared or Sold:</span> We never share, sell, or distribute your data to third parties
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                      <span className="font-medium">Your Data, Your Control:</span> Full ownership with ability to export or delete anytime
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                      <span className="font-medium">Purpose-Limited Use:</span> Used exclusively for your trading journal and analytics
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Elegant Consent Checkbox */}
                            <motion.div
                              className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-700/30 rounded-xl border border-gray-200/50 dark:border-gray-600/30"
                              whileHover={{ scale: 1.005 }}
                              transition={{ duration: 0.2 }}
                            >
                              <label className={`flex items-start gap-4 group w-full ${!parsedData ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                <div className="relative flex-shrink-0 mt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={dataConsentGiven}
                                    onChange={(e) => setDataConsentGiven(e.target.checked)}
                                    disabled={!parsedData}
                                    className="sr-only"
                                  />
                                  <div className={`w-6 h-6 rounded-lg border-2 transition-all duration-300 flex items-center justify-center shadow-sm ${
                                    !parsedData
                                      ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'
                                      : dataConsentGiven
                                      ? 'bg-gradient-to-br from-gray-800 to-black border-gray-800 shadow-md'
                                      : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500 bg-white dark:bg-gray-800'
                                  }`}>
                                    {dataConsentGiven && (
                                      <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                      >
                                        <Icon icon="lucide:check" className="w-4 h-4 text-white" />
                                      </motion.div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-gray-50 transition-colors leading-relaxed">
                                    I acknowledge and consent to the secure storage and processing of my trading data as described above
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    {!parsedData ? 'Upload a file first to enable consent' : 'Required to proceed with import'}
                                  </p>
                                </div>
                              </label>
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    </motion.div>




                  </motion.div>
                )}

                {step === 'dateFormat' && parsedData && (
                  <motion.div
                    key="dateFormat"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:calendar" className="text-slate-600 dark:text-slate-400" />
                          <span className="font-medium">Select Date Format</span>
                        </div>
                      </CardHeader>
                      <CardBody>
                        <div className="space-y-4">


                          {/* Warning for incomplete years */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                              <Icon icon="lucide:info" className="w-4 h-4 text-blue-600 mt-0.5" />
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                <div className="space-y-2">
                                  <p>
                                    <strong>Incomplete Years Detected:</strong> Some dates in your file don't include years (e.g., "29 April", "16/4"). The system will automatically assign years from each trade's main date, provided the main trade data's date column/field consists a valid DD-MM-YYYY format.
                                  </p>
                                  <p>
                                    <strong>⚠️ Proceed at your own discretion:</strong> The imported data might be inaccurate due to date and year inconsistencies or missing information. We have tried our best to handle these cases automatically.
                                  </p>
                                  <p>
                                    <strong>💡 Recommendation:</strong> If wrong data parsing occurs, please fix your CSV date and year format inconsistencies and then try importing again for best results.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>



                          {/* Date format selection */}
                          <div className="space-y-3">
                            {dateFormatOptions.map((option) => (
                              <div
                                key={option.value}
                                className={'p-4 border-2 rounded-lg cursor-pointer transition-all ' + (
                                  selectedDateFormat === option.value
                                    ? 'border-slate-400 bg-slate-50 dark:bg-slate-950/20'
                                    : 'border-default-200 hover:border-default-300'
                                )}
                                onClick={() => setSelectedDateFormat(option.value)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={'w-4 h-4 rounded-full border-2 flex items-center justify-center ' + (
                                    selectedDateFormat === option.value
                                      ? 'border-slate-500 bg-slate-500'
                                      : 'border-default-300'
                                  )}>
                                    {selectedDateFormat === option.value && (
                                      <div className="w-2 h-2 rounded-full bg-white"></div>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{option.label}</span>
                                      <code className="text-xs bg-default-100 px-2 py-1 rounded">
                                        {option.example}
                                      </code>
                                    </div>
                                    <p className="text-xs text-foreground-500">{option.description}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Smart Year Assignment Info */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Icon icon="lucide:calendar-days" className="text-slate-600 dark:text-slate-400" />
                              <span className="font-medium text-sm">Smart Year Assignment</span>
                            </div>
                            <div className="p-4 border-2 border-default-200 rounded-lg">
                              <div className="text-sm text-foreground-600">
                                <p className="mb-2">
                                  <strong>Automatic year detection:</strong> The system will automatically assign years to pyramid and exit dates <strong>only when years are missing or incomplete</strong> in those fields.
                                </p>
                                <div className="text-xs text-foreground-500 space-y-1">
                                  <p>• <strong>Missing year:</strong> Exit date "29-Apr" → becomes "29-04-2025" (uses trade year)</p>
                                  <p>• <strong>Complete date:</strong> Exit date "29-04-2024" → stays "29-04-2024" (unchanged)</p>
                                  <p>• <strong>Mixed formats:</strong> Each field is handled independently</p>
                                  <p>• <strong>Per-trade logic:</strong> Each trade uses its own main date year</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                              <Icon icon="lucide:lightbulb" className="w-4 h-4 text-blue-600 mt-0.5" />
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                <strong>Tip:</strong> If you're unsure, choose "Auto-detect" and we'll try to figure out your date format automatically. You can always re-import if needed.
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}

                {step === 'mapping' && parsedData && (
                  <motion.div
                    key="mapping"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:file-text" className="text-slate-600 dark:text-slate-400" />
                          <span className="font-medium">File: {parsedData.fileName}</span>
                        </div>
                      </CardHeader>
                      <CardBody className="pt-0">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm text-foreground-500">
                            Map your file columns to our trade journal fields. We've made smart suggestions based on column names.
                          </p>
                          <Button
                            size="sm"
                            variant="light"
                            className="bg-gradient-to-r from-slate-50 to-gray-50 hover:from-slate-100 hover:to-gray-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium transition-all duration-200 hover:scale-105 hover:shadow-md"
                            startContent={<Icon icon="lucide:sparkles" className="w-3.5 h-3.5" />}
                            onPress={() => {
                              if (parsedData) {
                                const smartMapping = generateSmartMapping(parsedData.headers);
                                setColumnMapping(smartMapping.mapping);
                                setMappingConfidence(smartMapping.confidence);
                              }
                            }}
                          >
                            Smart Re-map
                          </Button>
                        </div>

                        {/* Mapping Summary */}
                        <div className="mb-4 p-3 bg-default-50 rounded-lg">
                          <div className="flex items-center justify-between text-sm">
                            <span>Mapping Progress:</span>
                            <div className="flex gap-4">
                              <span className="text-success">
                                {Object.keys(columnMapping).length} mapped
                              </span>
                              <span className="text-warning">
                                {MAPPABLE_FIELDS.filter(f => f.required && !columnMapping[f.key]).length} required missing
                              </span>
                            </div>
                          </div>
                        </div>

                        <ScrollShadow className="max-h-96">
                          <div className="space-y-3">
                            {MAPPABLE_FIELDS.map((field) => (
                              <div key={field.key} className="flex items-center gap-4">
                                <div className="min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{field.label}</span>
                                    {field.required && (
                                      <Chip size="sm" color="danger" variant="flat">Required</Chip>
                                    )}
                                    {mappingConfidence[field.key] && (
                                      <Chip
                                        size="sm"
                                        variant="flat"
                                        color={
                                          mappingConfidence[field.key] >= 90 ? "success" :
                                          mappingConfidence[field.key] >= 70 ? "warning" : "default"
                                        }
                                      >
                                        {mappingConfidence[field.key].toFixed(0)}% match
                                      </Chip>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <Select
                                    placeholder="Select column or skip"
                                    size="sm"
                                    aria-label={`Map ${field.label} to CSV column`}
                                    selectedKeys={columnMapping[field.key] ?
                                      parsedData.headers.map((header, index) =>
                                        header === columnMapping[field.key] ? `${header}-${index}` : null
                                      ).filter(Boolean) : []}
                                    onSelectionChange={(keys) => {
                                      const selectedKey = Array.from(keys)[0] as string;
                                      if (selectedKey) {
                                        // Extract the original header name from the key format "header-index"
                                        const headerName = selectedKey.replace(/-\d+$/, '');
                                        setColumnMapping(prev => ({
                                          ...prev,
                                          [field.key]: headerName
                                        }));
                                        // Clear confidence when manually changed
                                        setMappingConfidence(prev => {
                                          const newConfidence = { ...prev };
                                          delete newConfidence[field.key];
                                          return newConfidence;
                                        });
                                      } else {
                                        setColumnMapping(prev => {
                                          const newMapping = { ...prev };
                                          delete newMapping[field.key];
                                          return newMapping;
                                        });
                                        setMappingConfidence(prev => {
                                          const newConfidence = { ...prev };
                                          delete newConfidence[field.key];
                                          return newConfidence;
                                        });
                                      }
                                    }}
                                  >
                                    {parsedData.headers.map((header, index) => (
                                      <SelectItem key={`${header}-${index}`}>
                                        {header}
                                      </SelectItem>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollShadow>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}

                {step === 'preview' && previewTrades.length > 0 && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardHeader>
                        <Chip size="sm" variant="flat" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          Showing first 5 rows
                        </Chip>
                      </CardHeader>
                      <CardBody className="pt-0">
                        <div className="mb-4">
                          <div className="space-y-2">
                            {isZerodhaFormat && (
                              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <Icon icon="lucide:zap" className="text-blue-600 dark:text-blue-400" />
                                <div className="text-sm">
                                  <span className="text-blue-700 dark:text-blue-300 font-semibold">Zerodha Format Processed:</span>
                                  <span className="text-blue-600 dark:text-blue-400 ml-1">
                                    Transactions automatically grouped into trades with proper entry/exit calculations
                                  </span>
                                </div>
                              </div>
                            )}
                            {isDhanFormat && (
                              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                <Icon icon="lucide:trending-up" className="text-green-600 dark:text-green-400" />
                                <div className="text-sm">
                                  <span className="text-green-700 dark:text-green-300 font-semibold">Dhan Format Processed:</span>
                                  <span className="text-green-600 dark:text-green-400 ml-1">
                                    Transactions automatically grouped into trades with proper entry/exit calculations
                                  </span>
                                </div>
                              </div>
                            )}
                            {isUpstoxFormat && (
                              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                <Icon icon="lucide:file-spreadsheet" className="text-orange-600 dark:text-orange-400" />
                                <div className="text-sm">
                                  <span className="text-orange-700 dark:text-orange-300 font-semibold">Upstox Format Processed:</span>
                                  <span className="text-orange-600 dark:text-orange-400 ml-1">
                                    Excel transactions automatically grouped into trades with proper entry/exit calculations
                                  </span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-900/20 rounded-lg">
                              <Icon icon="lucide:calculator" className="text-slate-600 dark:text-slate-400" />
                              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                Auto-calculated fields (Avg Entry, Position Size, Allocation %, P/L, etc.) are highlighted in gray
                              </span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-warning/10 rounded-lg">
                              <Icon icon="lucide:info" className="text-warning" />
                              <span className="text-sm text-warning font-medium">
                                CMP values from CSV will be imported as-is (no auto-fetching)
                              </span>
                            </div>
                          </div>
                        </div>

                        <ScrollShadow className="max-h-96">
                          <Table aria-label="Preview table" className="min-w-full">
                            <TableHeader>
                              <TableColumn>Name</TableColumn>
                              <TableColumn>Date</TableColumn>
                              <TableColumn>Entry</TableColumn>
                              <TableColumn>Avg Entry</TableColumn>
                              <TableColumn>Qty</TableColumn>
                              <TableColumn>Position Size</TableColumn>
                              <TableColumn>Allocation %</TableColumn>
                              <TableColumn>Status</TableColumn>
                              <TableColumn>P/L</TableColumn>
                            </TableHeader>
                            <TableBody>
                              {previewTrades.slice(0, 5).map((trade, index) => (
                                <TableRow key={index}>
                                  <TableCell>{trade.name || '-'}</TableCell>
                                  <TableCell>
                                    {(() => {
                                      if (!trade.date) return '-';
                                      try {
                                        const dateObj = new Date(trade.date);
                                        return isNaN(dateObj.getTime()) ? trade.date : dateObj.toLocaleDateString();
                                      } catch {
                                        return trade.date;
                                      }
                                    })()}
                                  </TableCell>
                                  <TableCell>₹{trade.entry?.toFixed(2) || '0.00'}</TableCell>
                                  <TableCell>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                                      ₹{trade.avgEntry?.toFixed(2) || '0.00'}
                                    </span>
                                  </TableCell>
                                  <TableCell>{trade.initialQty || 0}</TableCell>
                                  <TableCell>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                                      ₹{trade.positionSize?.toLocaleString() || '0'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                                      {trade.allocation?.toFixed(2) || '0.00'}%
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Chip size="sm" variant="flat" color={
                                      trade.positionStatus === 'Open' ? 'warning' :
                                      trade.positionStatus === 'Closed' ? 'success' : 'primary'
                                    }>
                                      {trade.positionStatus}
                                    </Chip>
                                  </TableCell>
                                  <TableCell>
                                    <span className={trade.plRs >= 0 ? 'text-success' : 'text-danger'}>
                                      ₹{trade.plRs?.toFixed(2) || '0.00'}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollShadow>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}

                {step === 'importing' && (
                  <motion.div
                    key="importing"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <Card>
                      <CardBody className="text-center py-12">
                        {/* Sleek animated loader */}
                        <div className="relative mb-8">
                          <div className="w-16 h-16 mx-auto relative">
                            {/* Outer ring */}
                            <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
                            {/* Animated ring */}
                            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-slate-600 dark:border-t-slate-400 animate-spin" style={{ animationDuration: '1s' }}></div>
                            {/* Inner pulse */}
                            <div className="absolute inset-2 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ animationDuration: '2s' }}></div>
                            {/* Center dot */}
                            <div className="absolute inset-6 rounded-full bg-slate-600 dark:bg-slate-400"></div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-foreground">
                            Importing Trades
                          </h3>
                          <p className="text-default-500 text-base">
                            {importProgress < 100
                              ? `Processing trades... ${Math.round(importProgress)}%`
                              : 'Finalizing import...'
                            }
                          </p>

                          {/* Sleek info card */}
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/30 rounded-full border border-slate-200 dark:border-slate-700">
                            <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse" style={{ animationDuration: '1.5s' }}></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                              Optimized import in progress
                            </span>
                          </div>

                          {/* Smooth progress bar */}
                          <div className="mt-6">
                            <div className="w-full max-w-sm mx-auto">
                              <div className="flex justify-between text-xs text-default-500 mb-2">
                                <span>Progress</span>
                                <span>{Math.round(importProgress)}%</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-slate-500 to-slate-600 dark:from-slate-400 dark:to-slate-500 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${importProgress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </ModalBody>

            <ModalFooter className="px-4 py-3">
              <div className="flex justify-between w-full gap-2">
                <div>
                  {step !== 'upload' && step !== 'importing' && (
                    <Button
                      variant="light"
                      size="sm"
                      className="text-xs px-3 py-1.5 h-8"
                      onPress={() => {
                        if (step === 'dateFormat') setStep('upload');
                        else if (step === 'mapping') setStep('dateFormat');
                        else if (step === 'preview') {
                          // For broker formats (Zerodha/Dhan/Upstox), go back to upload since we skip mapping
                          if (isZerodhaFormat || isDhanFormat || isUpstoxFormat) {
                            setStep('upload');
                          } else {
                            setStep('mapping');
                          }
                        }
                      }}
                      startContent={<Icon icon="lucide:arrow-left" className="w-3 h-3" />}
                    >
                      Back
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="light"
                    onPress={onClose}
                    isDisabled={step === 'importing'}
                    size="sm"
                    className="text-xs px-3 py-1.5 h-8"
                  >
                    Cancel
                  </Button>

                  {step === 'dateFormat' && (
                    <Button
                      color="primary"
                      size="sm"
                      className="h-8 px-4 text-xs"
                      onPress={() => {
                        if (!dataConsentGiven) {
                          setError('Please acknowledge the data consent disclaimer before proceeding.');
                          return;
                        }
                        setStep('mapping');
                      }}
                      endContent={<Icon icon="lucide:arrow-right" className="w-3 h-3" />}
                    >
                      Continue
                    </Button>
                  )}

                  {step === 'mapping' && (
                    <Button
                      color="success"
                      size="sm"
                      className="h-8 px-4 text-xs"
                      onPress={generatePreview}
                      isDisabled={MAPPABLE_FIELDS.filter(f => f.required).some(field => !columnMapping[field.key])}
                      endContent={<Icon icon="lucide:arrow-right" className="w-3 h-3" />}
                    >
                      Preview
                    </Button>
                  )}

                  {step === 'preview' && (
                    <Button
                      color="success"
                      size="sm"
                      className="h-8 px-4 text-xs"
                      onPress={handleImport}
                      endContent={<Icon icon="lucide:upload" className="w-3 h-3" />}
                    >
                      Import {(isZerodhaFormat || isDhanFormat || isUpstoxFormat) ? previewTrades.length : parsedData?.rows.length}
                    </Button>
                  )}
                </div>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};