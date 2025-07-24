/**
 * Formatting Utilities for Calculations
 * Centralized location for all number and currency formatting
 */

/**
 * Format currency values in Indian Rupees
 */
export function formatCurrency(value: number): string {
  if (!value && value !== 0) return "-";
  if (isNaN(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format currency values with custom precision
 */
export function formatCurrencyWithPrecision(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  if (isNaN(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/**
 * Format percentage values
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  if (isNaN(value)) return "-";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format percentage with sign
 */
export function formatPercentageWithSign(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format number with Indian number system (lakhs, crores)
 */
export function formatIndianNumber(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  
  if (absValue >= 10000000) { // 1 crore
    return `${sign}₹${(absValue / 10000000).toFixed(decimals)}Cr`;
  } else if (absValue >= 100000) { // 1 lakh
    return `${sign}₹${(absValue / 100000).toFixed(decimals)}L`;
  } else if (absValue >= 1000) { // 1 thousand
    return `${sign}₹${(absValue / 1000).toFixed(decimals)}K`;
  } else {
    return `${sign}₹${absValue.toFixed(decimals)}`;
  }
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatLargeNumber(value: number, decimals: number = 1): string {
  if (!value && value !== 0) return "-";
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  
  if (absValue >= 1000000000) { // Billion
    return `${sign}${(absValue / 1000000000).toFixed(decimals)}B`;
  } else if (absValue >= 1000000) { // Million
    return `${sign}${(absValue / 1000000).toFixed(decimals)}M`;
  } else if (absValue >= 1000) { // Thousand
    return `${sign}${(absValue / 1000).toFixed(decimals)}K`;
  } else {
    return `${sign}${absValue.toFixed(decimals)}`;
  }
}

/**
 * Format risk-reward ratio
 */
export function formatRiskRewardRatio(value: number): string {
  if (!value && value !== 0) return "-";
  
  if (value < 0) {
    return `-1:${Math.abs(value).toFixed(2)}`;
  }
  return `1:${value.toFixed(2)}`;
}

/**
 * Format P&L with appropriate sign and color indication
 */
export function formatPLWithSign(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  if (value >= 0) {
    return `₹+${value.toLocaleString('en-IN', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  } else {
    return `₹${value.toLocaleString('en-IN', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  }
}

/**
 * Format stock move percentage with sign
 */
export function formatStockMove(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format allocation percentage
 */
export function formatAllocation(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format holding days
 */
export function formatHoldingDays(value: number): string {
  if (!value && value !== 0) return "-";
  
  const days = Math.round(value);
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * Format quantity
 */
export function formatQuantity(value: number): string {
  if (!value && value !== 0) return "-";
  return value.toLocaleString('en-IN');
}

/**
 * Format price
 */
export function formatPrice(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return `₹${value.toFixed(decimals)}`;
}

/**
 * Format metric value based on type
 */
export function formatMetricValue(
  value: number,
  type: 'currency' | 'percentage' | 'number' | 'ratio' | 'days'
): string {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (isNaN(num)) return '-';

  switch (type) {
    case 'currency':
      return formatCurrency(num);
    case 'percentage':
      return formatPercentage(num);
    case 'ratio':
      return formatRiskRewardRatio(num);
    case 'days':
      return formatHoldingDays(num);
    case 'number':
    default:
      return num.toFixed(2);
  }
}

/**
 * Format compact number (for small displays)
 */
export function formatCompactNumber(value: number): string {
  if (!value && value !== 0) return "-";
  
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}

/**
 * Format decimal with fixed precision
 */
export function formatDecimal(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return value.toFixed(decimals);
}

/**
 * Format number with thousands separator
 */
export function formatNumberWithSeparator(value: number, decimals: number = 0): string {
  if (!value && value !== 0) return "-";
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format XIRR/return percentage
 */
export function formatReturn(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format volatility
 */
export function formatVolatility(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format drawdown
 */
export function formatDrawdown(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return `-${Math.abs(value).toFixed(decimals)}%`;
}

/**
 * Format Sharpe ratio
 */
export function formatSharpeRatio(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  return value.toFixed(decimals);
}

/**
 * Format win rate
 */
export function formatWinRate(value: number, decimals: number = 1): string {
  if (!value && value !== 0) return "-";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format expectancy
 */
export function formatExpectancy(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format profit factor
 */
export function formatProfitFactor(value: number, decimals: number = 2): string {
  if (!value && value !== 0) return "-";
  
  if (value === Infinity) return "∞";
  return value.toFixed(decimals);
}

/**
 * Get color class for P&L values
 */
export function getPLColorClass(value: number): string {
  if (value > 0) return 'text-success-600 dark:text-success-400';
  if (value < 0) return 'text-danger-600 dark:text-danger-400';
  return 'text-foreground-800 dark:text-white';
}

/**
 * Get color class for percentage values
 */
export function getPercentageColorClass(value: number): string {
  if (value > 0) return 'text-success-600 dark:text-success-400';
  if (value < 0) return 'text-danger-600 dark:text-danger-400';
  return 'text-foreground-800 dark:text-white';
}
