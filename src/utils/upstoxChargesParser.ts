/**
 * Upstox Realized P&L Statement Charges Parser
 * Parses Upstox Realized P&L Excel files to extract charges breakdown
 */

import * as XLSX from 'xlsx';

export interface UpstoxChargesBreakdown {
  brokerage: number;
  sebiFees: number;
  stampDuty: number;
  turnoverCharges: number;
  dematTransactionCharges: number;
  integratedGST: number;
  securitiesTransactionTax: number;
  total: number;
  dateRange: {
    from: string;
    to: string;
  };
  clientId: string;
  clientName: string;
  pan: string;
  grossPnL: number;
  netPnL: number;
}

/**
 * Detects if an Excel file is an Upstox Realized P&L statement
 */
export function isUpstoxPnLStatement(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Check if it has REALIZED_PNL sheet
        const hasRealizedPnLSheet = workbook.SheetNames.includes('REALIZED_PNL');
        
        if (!hasRealizedPnLSheet) {
          resolve(false);
          return;
        }
        
        const worksheet = workbook.Sheets['REALIZED_PNL'];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Check for Upstox indicators
        const hasUpstoxHeader = jsonData.some((row: any) => 
          Array.isArray(row) && row.some((cell: any) => 
            String(cell || '').toLowerCase().includes('upstox securities')
          )
        );
        
        const hasUCC = jsonData.some((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('ucc')
        );
        
        const hasChargesSection = jsonData.some((row: any) => 
          Array.isArray(row) && row.some((cell: any) => 
            String(cell || '').toLowerCase().includes('brokerage') ||
            String(cell || '').toLowerCase().includes('sebi fees') ||
            String(cell || '').toLowerCase().includes('securities transaction tax')
          )
        );
        

        
        resolve(hasUpstoxHeader && hasUCC && hasChargesSection);
      } catch (error) {
        resolve(false);
      }
    };
    
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses Upstox Realized P&L Excel file to extract charges breakdown
 */
export function parseUpstoxCharges(file: File): Promise<UpstoxChargesBreakdown | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (!workbook.SheetNames.includes('REALIZED_PNL')) {
          resolve(null);
          return;
        }
        
        const worksheet = workbook.Sheets['REALIZED_PNL'];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        

        
        // Extract client information
        let clientId = '';
        let clientName = '';
        let pan = '';
        
        // Find UCC (client ID)
        const uccRow = jsonData.find((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('ucc')
        ) as any[];
        if (uccRow) {
          clientId = String(uccRow[1] || '').trim();
        }
        
        // Find client name
        const nameRow = jsonData.find((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('name')
        ) as any[];
        if (nameRow) {
          clientName = String(nameRow[1] || '').trim();
        }
        
        // Find PAN
        const panRow = jsonData.find((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('pan')
        ) as any[];
        if (panRow) {
          pan = String(panRow[1] || '').trim();
        }
        
        // Extract P&L information
        let grossPnL = 0;
        let netPnL = 0;
        
        const grossPnLRow = jsonData.find((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('gross p&l')
        ) as any[];
        if (grossPnLRow) {
          grossPnL = parseFloat(String(grossPnLRow[1] || '0'));
        }
        
        const netPnLRow = jsonData.find((row: any) => 
          Array.isArray(row) && row.length >= 2 && 
          String(row[0] || '').toLowerCase().includes('net p&l')
        ) as any[];
        if (netPnLRow) {
          netPnL = parseFloat(String(netPnLRow[1] || '0'));
        }
        
        // Initialize charges breakdown
        const charges: Partial<UpstoxChargesBreakdown> = {
          brokerage: 0,
          sebiFees: 0,
          stampDuty: 0,
          turnoverCharges: 0,
          dematTransactionCharges: 0,
          integratedGST: 0,
          securitiesTransactionTax: 0,
          total: 0
        };
        
        // Parse individual charge items
        jsonData.forEach((row: any, index: number) => {
          if (!Array.isArray(row) || row.length < 2) return;
          
          const description = String(row[0] || '').toLowerCase().trim();
          const amount = parseFloat(String(row[1] || '0'));
          
          if (isNaN(amount)) return;
          

          
          if (description.includes('sebi fees')) {
            charges.sebiFees = amount;
          } else if (description.includes('stamp duty')) {
            charges.stampDuty = amount;
          } else if (description.includes('turnover chg') || description.includes('turnover charges')) {
            charges.turnoverCharges = amount;
          } else if (description.includes('brokerage')) {
            charges.brokerage = amount;
          } else if (description.includes('demat tran chg') || description.includes('demat transaction')) {
            charges.dematTransactionCharges = amount;
          } else if (description.includes('integrated gst') || description.includes('igst')) {
            charges.integratedGST = amount;
          } else if (description.includes('securities transaction tax') || description.includes('stt')) {
            charges.securitiesTransactionTax = amount;
          } else if (description === 'total') {
            charges.total = amount;
          }
        });
        
        // Calculate total if not provided
        if (charges.total === 0) {
          charges.total = (charges.brokerage || 0) + 
                         (charges.sebiFees || 0) + 
                         (charges.stampDuty || 0) + 
                         (charges.turnoverCharges || 0) + 
                         (charges.dematTransactionCharges || 0) + 
                         (charges.integratedGST || 0) + 
                         (charges.securitiesTransactionTax || 0);
        }
        
        // For now, set a generic date range (can be enhanced later)
        const dateRange = { from: '', to: '' };
        
        const result: UpstoxChargesBreakdown = {
          brokerage: charges.brokerage || 0,
          sebiFees: charges.sebiFees || 0,
          stampDuty: charges.stampDuty || 0,
          turnoverCharges: charges.turnoverCharges || 0,
          dematTransactionCharges: charges.dematTransactionCharges || 0,
          integratedGST: charges.integratedGST || 0,
          securitiesTransactionTax: charges.securitiesTransactionTax || 0,
          total: charges.total || 0,
          dateRange,
          clientId,
          clientName,
          pan,
          grossPnL,
          netPnL
        };
        

        resolve(result);
        
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Distributes Upstox charges across months based on trade dates
 */
export function distributeUpstoxChargesAcrossMonths(
  charges: UpstoxChargesBreakdown,
  monthlyTradeCounts: { [monthYear: string]: number }
): { [monthYear: string]: UpstoxChargesBreakdown } {
  const result: { [monthYear: string]: UpstoxChargesBreakdown } = {};
  
  const totalTrades = Object.values(monthlyTradeCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalTrades === 0) {
    return result;
  }
  
  Object.entries(monthlyTradeCounts).forEach(([monthYear, tradeCount]) => {
    const proportion = tradeCount / totalTrades;
    
    result[monthYear] = {
      brokerage: charges.brokerage * proportion,
      sebiFees: charges.sebiFees * proportion,
      stampDuty: charges.stampDuty * proportion,
      turnoverCharges: charges.turnoverCharges * proportion,
      dematTransactionCharges: charges.dematTransactionCharges * proportion,
      integratedGST: charges.integratedGST * proportion,
      securitiesTransactionTax: charges.securitiesTransactionTax * proportion,
      total: charges.total * proportion,
      dateRange: charges.dateRange,
      clientId: charges.clientId,
      clientName: charges.clientName,
      pan: charges.pan,
      grossPnL: charges.grossPnL * proportion,
      netPnL: charges.netPnL * proportion
    };
  });
  
  return result;
}

/**
 * Formats Upstox charges breakdown for display
 */
export function formatUpstoxChargesBreakdown(charges: UpstoxChargesBreakdown): string[] {
  return [
    `Brokerage: ₹${charges.brokerage.toFixed(2)}`,
    `SEBI Fees: ₹${charges.sebiFees.toFixed(2)}`,
    `Stamp Duty: ₹${charges.stampDuty.toFixed(2)}`,
    `Turnover Charges: ₹${charges.turnoverCharges.toFixed(2)}`,
    `Demat Transaction Charges: ₹${charges.dematTransactionCharges.toFixed(2)}`,
    `Integrated GST: ₹${charges.integratedGST.toFixed(2)}`,
    `Securities Transaction Tax: ₹${charges.securitiesTransactionTax.toFixed(2)}`,
    `Total: ₹${charges.total.toFixed(2)}`
  ].filter(line => {
    // Only show non-zero charges
    const amount = parseFloat(line.split('₹')[1]);
    return amount > 0;
  });
}
