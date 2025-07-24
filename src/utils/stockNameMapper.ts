/**
 * Stock Name Mapper Utility
 * 
 * Intelligently maps broker-provided stock names/symbols to standardized 
 * stock names from the backend CSV file (name_sector_industry.csv)
 */

interface StockData {
  stockName: string;
  basicIndustry: string;
  index: string;
  sector: string;
}

let stockDatabase: StockData[] = [];
let isLoaded = false;

/**
 * Load stock data from the CSV file
 */
export async function loadStockDatabase(): Promise<void> {
  if (isLoaded) return;

  try {
    const response = await fetch('/name_sector_industry.csv');
    const csvText = await response.text();
    
    // Parse CSV manually (simple parsing for this specific format)
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    stockDatabase = lines.slice(1)
      .filter(line => line.trim()) // Remove empty lines
      .map(line => {
        // Handle CSV parsing with quoted fields
        const values = parseCSVLine(line);
        return {
          stockName: values[0]?.trim() || '',
          basicIndustry: values[1]?.trim() || '',
          index: values[2]?.trim() || '',
          sector: values[3]?.trim() || ''
        };
      })
      .filter(stock => stock.stockName); // Remove entries without stock names

    isLoaded = true;
  } catch (error) {
    throw new Error('Failed to load stock name database');
  }
}

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current); // Add the last field
  return result;
}

/**
 * Normalize a string for comparison (remove special chars, convert to lowercase)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .trim();
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeForComparison(str1);
  const norm2 = normalizeForComparison(str2);
  
  if (norm1 === norm2) return 1.0; // Perfect match
  
  const maxLength = Math.max(norm1.length, norm2.length);
  if (maxLength === 0) return 0;
  
  const distance = levenshteinDistance(norm1, norm2);
  return 1 - (distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Map broker stock name to standardized stock name
 */
export async function mapStockName(brokerName: string): Promise<string> {
  // Ensure database is loaded
  await loadStockDatabase();
  
  if (!brokerName || !brokerName.trim()) {
    return brokerName;
  }
  
  const normalizedBrokerName = normalizeForComparison(brokerName);
  
  // First, try exact match
  const exactMatch = stockDatabase.find(stock => 
    normalizeForComparison(stock.stockName) === normalizedBrokerName
  );
  
  if (exactMatch) {
    return exactMatch.stockName;
  }
  
  // If no exact match, find best similarity match
  let bestMatch: StockData | null = null;
  let bestScore = 0;
  const MIN_SIMILARITY_THRESHOLD = 0.7; // 70% similarity required
  
  for (const stock of stockDatabase) {
    const similarity = calculateSimilarity(brokerName, stock.stockName);
    
    if (similarity > bestScore && similarity >= MIN_SIMILARITY_THRESHOLD) {
      bestScore = similarity;
      bestMatch = stock;
    }
  }
  
  if (bestMatch) {
    return bestMatch.stockName;
  }

  // If no good match found, return original name
  return brokerName;
}

/**
 * Batch map multiple stock names for efficiency
 */
export async function mapStockNames(brokerNames: string[]): Promise<string[]> {
  // Ensure database is loaded once
  await loadStockDatabase();
  
  const results: string[] = [];
  
  for (const brokerName of brokerNames) {
    // Use the same logic as mapStockName but without reloading database
    if (!brokerName || !brokerName.trim()) {
      results.push(brokerName);
      continue;
    }
    
    const normalizedBrokerName = normalizeForComparison(brokerName);
    
    // Try exact match first
    const exactMatch = stockDatabase.find(stock => 
      normalizeForComparison(stock.stockName) === normalizedBrokerName
    );
    
    if (exactMatch) {
      results.push(exactMatch.stockName);
      continue;
    }
    
    // Find best similarity match
    let bestMatch: StockData | null = null;
    let bestScore = 0;
    const MIN_SIMILARITY_THRESHOLD = 0.7;
    
    for (const stock of stockDatabase) {
      const similarity = calculateSimilarity(brokerName, stock.stockName);
      
      if (similarity > bestScore && similarity >= MIN_SIMILARITY_THRESHOLD) {
        bestScore = similarity;
        bestMatch = stock;
      }
    }
    
    results.push(bestMatch ? bestMatch.stockName : brokerName);
  }
  
  return results;
}

/**
 * Get stock information by name
 */
export async function getStockInfo(stockName: string): Promise<StockData | null> {
  await loadStockDatabase();
  
  return stockDatabase.find(stock => 
    normalizeForComparison(stock.stockName) === normalizeForComparison(stockName)
  ) || null;
}

/**
 * Search stocks by partial name
 */
export async function searchStocks(query: string, limit: number = 10): Promise<StockData[]> {
  await loadStockDatabase();
  
  if (!query.trim()) return [];
  
  const normalizedQuery = normalizeForComparison(query);
  
  // Find stocks that contain the query
  const matches = stockDatabase
    .filter(stock => normalizeForComparison(stock.stockName).includes(normalizedQuery))
    .slice(0, limit);
  
  return matches;
}
