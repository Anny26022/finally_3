/**
 * Zerodha P&L Statement Charges Parser
 * Parses Zerodha P&L statement CSV files to extract charges breakdown
 */

export interface ZerodhaChargesBreakdown {
  brokerage: number;
  exchangeTransactionCharges: number;
  clearingCharges: number;
  centralGST: number;
  stateGST: number;
  integratedGST: number;
  securitiesTransactionTax: number;
  sebiTurnoverFees: number;
  stampDuty: number;
  ipft: number;
  total: number;
  dateRange: {
    from: string;
    to: string;
  };
  clientId: string;
}

/**
 * Detects if a CSV file is a Zerodha P&L statement
 */
export function isZerodhaPnLStatement(csvContent: string): boolean {
  const lines = csvContent.split('\n');

  // Check for P&L statement indicators (case insensitive)
  const hasClientId = lines.some(line => line.toLowerCase().includes('client id'));
  const hasPnLStatement = lines.some(line => line.toLowerCase().includes('p&l statement for equity'));
  const hasChargesSection = lines.some(line =>
    line.toLowerCase().includes('charges') ||
    line.toLowerCase().includes('account head')
  );
  const hasSummary = lines.some(line => line.toLowerCase().includes('summary'));

  // More lenient detection - need at least 2 of these indicators
  const indicators = [hasClientId, hasPnLStatement, hasChargesSection, hasSummary];
  const matchCount = indicators.filter(Boolean).length;

  console.log('🔍 P&L Detection:', { hasClientId, hasPnLStatement, hasChargesSection, hasSummary, matchCount });

  return matchCount >= 2;
}

/**
 * Parses Zerodha P&L statement CSV to extract charges breakdown
 */
export function parseZerodhaCharges(csvContent: string): ZerodhaChargesBreakdown | null {
  try {
    const lines = csvContent.split('\n');
    console.log('📊 Parsing Zerodha charges from', lines.length, 'lines');
    
    // Extract client ID - data is in column 1 and 2 (0-indexed)
    let clientId = '';
    const clientIdLine = lines.find(line => line.toLowerCase().includes('client id'));
    if (clientIdLine) {
      const parts = clientIdLine.split(',');
      clientId = parts[2]?.trim() || ''; // Client ID is in column 2
    }
    
    // Extract date range
    let dateRange = { from: '', to: '' };
    const dateRangeLine = lines.find(line => line.toLowerCase().includes('p&l statement for equity from'));
    if (dateRangeLine) {
      const match = dateRangeLine.match(/from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);
      if (match) {
        dateRange = { from: match[1], to: match[2] };
      }
    }

    // Extract total charges - data is in columns 1 and 2 (0-indexed)
    let totalCharges = 0;
    const chargesLine = lines.find(line => {
      const parts = line.split(',');
      const secondCol = parts[1]?.trim().toLowerCase(); // "Charges" is in column 1
      const thirdCol = parts[2]?.trim(); // Amount is in column 2
      return secondCol === 'charges' &&
             thirdCol &&
             !isNaN(parseFloat(thirdCol)) &&
             parseFloat(thirdCol) > 0; // Must be positive number
    });
    if (chargesLine) {
      const parts = chargesLine.split(',');
      totalCharges = parseFloat(parts[2]?.trim() || '0'); // Amount is in column 2
      console.log(`💰 Total charges found: ${totalCharges}`);
    }
    
    // Extract individual charges breakdown
    const charges: Partial<ZerodhaChargesBreakdown> = {
      brokerage: 0,
      exchangeTransactionCharges: 0,
      clearingCharges: 0,
      centralGST: 0,
      stateGST: 0,
      integratedGST: 0,
      securitiesTransactionTax: 0,
      sebiTurnoverFees: 0,
      stampDuty: 0,
      ipft: 0
    };
    
    // Find charges section start - look for "Account Head,Amount" line (line 23)
    let chargesSectionStart = -1;

    // Debug: log all lines to see the structure
    console.log('🔍 Looking for charges section in lines:');
    lines.forEach((line, index) => {
      const parts = line.split(',');
      if (parts[0]?.trim() || parts[1]?.trim() || parts[2]?.trim()) {
        console.log(`Line ${index + 1}: "${parts[0]?.trim()}" | "${parts[1]?.trim()}" | "${parts[2]?.trim()}"`);
      }
    });

    chargesSectionStart = lines.findIndex(line => {
      const parts = line.split(',');
      const col2 = parts[1]?.trim().toLowerCase(); // "Account Head" is in column 1
      const col3 = parts[2]?.trim().toLowerCase(); // "Amount" is in column 2
      return col2 === 'account head' && col3 === 'amount';
    });

    if (chargesSectionStart === -1) {
      console.warn('⚠️ Could not find "Account Head,Amount" line');
      return null;
    }

    console.log(`📍 Charges section starts at line ${chargesSectionStart + 1}`);

    
    // Parse individual charge items - data is in columns 1 and 2 (0-indexed)
    for (let i = chargesSectionStart + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.includes('Symbol')) break; // End of charges section

      const parts = line.split(',');
      if (parts.length < 3) continue; // Need at least 3 columns

      const accountHead = parts[1]?.trim().toLowerCase() || ''; // Account head is in column 1
      const amountStr = parts[2]?.trim() || '0'; // Amount is in column 2
      const amount = parseFloat(amountStr);

      // Skip if amount is not a valid number
      if (isNaN(amount)) continue;

      console.log(`📊 Parsing charge: "${accountHead}" = ${amount}`);

      if (accountHead.includes('brokerage')) {
        charges.brokerage = amount;
      } else if (accountHead.includes('exchange transaction charges')) {
        charges.exchangeTransactionCharges = amount;
      } else if (accountHead.includes('clearing charges')) {
        charges.clearingCharges = amount;
      } else if (accountHead.includes('central gst')) {
        charges.centralGST = amount;
      } else if (accountHead.includes('state gst')) {
        charges.stateGST = amount;
      } else if (accountHead.includes('integrated gst')) {
        charges.integratedGST = amount;
      } else if (accountHead.includes('securities transaction tax')) {
        charges.securitiesTransactionTax = amount;
      } else if (accountHead.includes('sebi turnover fees')) {
        charges.sebiTurnoverFees = amount;
      } else if (accountHead.includes('stamp duty')) {
        charges.stampDuty = amount;
      } else if (accountHead.includes('ipft')) {
        charges.ipft = amount;
      }
    }
    
    const result = {
      ...charges as Required<Omit<ZerodhaChargesBreakdown, 'total' | 'dateRange' | 'clientId'>>,
      total: totalCharges,
      dateRange,
      clientId
    };

    console.log('✅ Parsed Zerodha charges:', result);
    return result;
    
  } catch (error) {
    console.error('Error parsing Zerodha charges:', error);
    return null;
  }
}

/**
 * Distributes charges across months in the date range
 * Since we don't know the exact monthly breakdown, we distribute evenly
 */
export function distributeChargesAcrossMonths(
  charges: ZerodhaChargesBreakdown,
  targetYear?: string
): { [month: string]: ZerodhaChargesBreakdown } {
  const result: { [month: string]: ZerodhaChargesBreakdown } = {};
  
  const startDate = new Date(charges.dateRange.from);
  const endDate = new Date(charges.dateRange.to);
  
  // Calculate total months in the range
  const months: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const monthName = current.toLocaleString('default', { month: 'long' });
    const year = current.getFullYear().toString();
    
    // If targetYear is specified, only include months from that year
    if (!targetYear || year === targetYear) {
      months.push(monthName);
    }
    
    current.setMonth(current.getMonth() + 1);
  }
  
  if (months.length === 0) return result;
  
  // Distribute charges evenly across months
  const chargesPerMonth = charges.total / months.length;
  
  months.forEach(month => {
    result[month] = {
      ...charges,
      total: chargesPerMonth,
      brokerage: charges.brokerage / months.length,
      exchangeTransactionCharges: charges.exchangeTransactionCharges / months.length,
      clearingCharges: charges.clearingCharges / months.length,
      centralGST: charges.centralGST / months.length,
      stateGST: charges.stateGST / months.length,
      integratedGST: charges.integratedGST / months.length,
      securitiesTransactionTax: charges.securitiesTransactionTax / months.length,
      sebiTurnoverFees: charges.sebiTurnoverFees / months.length,
      stampDuty: charges.stampDuty / months.length,
      ipft: charges.ipft / months.length
    };
  });
  
  return result;
}

/**
 * Formats charges breakdown for display
 */
export function formatChargesBreakdown(charges: ZerodhaChargesBreakdown): string[] {
  return [
    `Brokerage: ₹${charges.brokerage.toFixed(2)}`,
    `Exchange Transaction Charges: ₹${charges.exchangeTransactionCharges.toFixed(2)}`,
    `Clearing Charges: ₹${charges.clearingCharges.toFixed(2)}`,
    `Central GST: ₹${charges.centralGST.toFixed(2)}`,
    `State GST: ₹${charges.stateGST.toFixed(2)}`,
    `Integrated GST: ₹${charges.integratedGST.toFixed(2)}`,
    `Securities Transaction Tax: ₹${charges.securitiesTransactionTax.toFixed(2)}`,
    `SEBI Turnover Fees: ₹${charges.sebiTurnoverFees.toFixed(2)}`,
    `Stamp Duty: ₹${charges.stampDuty.toFixed(2)}`,
    `IPFT: ₹${charges.ipft.toFixed(2)}`
  ].filter(item => !item.includes('₹0.00')); // Filter out zero amounts
}


