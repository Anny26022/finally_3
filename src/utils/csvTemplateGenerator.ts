import { TerminologyType } from '../context/TerminologyContext';

// Generate CSV template header based on terminology preference
export function generateCSVTemplate(terminology: TerminologyType): string {
  const baseHeaders = [
    'Trade No.',
    'Date',
    'Name',
    'Setup',
    'Buy/Sell',
    'Entry (₹)',
    'Avg. Entry (₹)',
    'SL (₹)',
    'SL %',
    'TSL (₹)',
    'CMP (₹)',
    'Initial Qty'
  ];

  let pyramidHeaders: string[];
  let exitHeaders: string[];

  if (terminology === 'buysell') {
    // Buy/Sell terminology
    pyramidHeaders = [
      'B1 Price (₹)',
      'B1 Qty',
      'B1 Date',
      'B2 Price (₹)',
      'B2 Qty',
      'B2 Date'
    ];
    exitHeaders = [
      'S1 Price (₹)',
      'S1 Qty',
      'S1 Date',
      'S2 Price (₹)',
      'S2 Qty',
      'S2 Date',
      'S3 Price (₹)',
      'S3 Qty',
      'S3 Date'
    ];
  } else {
    // Pyramid terminology (default)
    pyramidHeaders = [
      'P1 Price (₹)',
      'P1 Qty',
      'P1 Date',
      'P2 Price (₹)',
      'P2 Qty',
      'P2 Date'
    ];
    exitHeaders = [
      'E1 Price (₹)',
      'E1 Qty',
      'E1 Date',
      'E2 Price (₹)',
      'E2 Qty',
      'E2 Date',
      'E3 Price (₹)',
      'E3 Qty',
      'E3 Date'
    ];
  }

  const endHeaders = [
    'Pos. Size',
    'Allocation (%)',
    'Open Qty',
    'Exited Qty',
    'Avg. Exit (₹)',
    'Stock Move (%)',
    'Open Heat (%)',
    'R:R',
    'Holding Days',
    'Status',
    'Realized Amount',
    'Realized P/L (₹)',
    'PF Impact (%)',
    'Cumm. PF (%)',
    'Plan Followed',
    'Exit Trigger',
    'Growth Areas',
    'Charts',
    'Notes'
  ];

  const allHeaders = [
    ...baseHeaders,
    ...pyramidHeaders,
    ...exitHeaders,
    ...endHeaders
  ];

  return allHeaders.join(',');
}

// Generate sample data row for the template
export function generateSampleDataRow(terminology: TerminologyType): string {
  const baseData = [
    '1', // Trade No.
    '16-Jun-2025', // Date
    '63MOONS', // Name
    'Pivot Bo', // Setup
    'Buy', // Buy/Sell
    '918.4', // Entry
    '918.4', // Avg. Entry
    '907', // SL
    '1.241289199', // SL %
    '0', // TSL
    '1003', // CMP
    '14' // Initial Qty
  ];

  let pyramidData: string[];
  let exitData: string[];

  if (terminology === 'buysell') {
    // Buy/Sell sample data
    pyramidData = [
      '0', '0', '', // B1
      '0', '0', ''  // B2
    ];
    exitData = [
      '907', '14', '15-Jun-2025', // S1
      '0', '0', '',               // S2
      '0', '0', ''                // S3
    ];
  } else {
    // Pyramid sample data
    pyramidData = [
      '0', '0', '', // P1
      '0', '0', ''  // P2
    ];
    exitData = [
      '907', '14', '15-Jun-2025', // E1
      '0', '0', '',               // E2
      '0', '0', ''                // E3
    ];
  }

  const endData = [
    '12858', // Pos. Size
    '4.300334448', // Allocation (%)
    '0', // Open Qty
    '14', // Exited Qty
    '907', // Avg. Exit
    '-1.241289199', // Stock Move (%)
    '', // Open Heat (%)
    '1', // R:R
    '1', // Holding Days
    'Closed', // Status
    '12698', // Realized Amount
    '-159.6', // Realized P/L
    '-0.05337792642', // PF Impact (%)
    '22.02288902', // Cumm. PF (%)
    'TRUE', // Plan Followed
    '', // Exit Trigger
    'ENTRY POINT', // Growth Areas
    '[object Object]', // Charts
    'EXITED TO EARLY' // Notes
  ];

  const allData = [
    ...baseData,
    ...pyramidData,
    ...exitData,
    ...endData
  ];

  return allData.join(',');
}

// Generate complete CSV template with header and sample row
export function generateCompleteCSVTemplate(terminology: TerminologyType): string {
  const header = generateCSVTemplate(terminology);
  const sampleRow = generateSampleDataRow(terminology);
  return `${header}\n${sampleRow}`;
}
