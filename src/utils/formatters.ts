export const formatCurrency = (value: number): string => {
  if (!value && value !== 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  if (!value && value !== 0) return "-";
  return `${value.toFixed(decimals)}%`;
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return "-";

  let date: Date;

  // Handle DD-MM-YYYY format (with dashes)
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('-').map(Number);
    date = new Date(year, month - 1, day);
  }
  // Handle DD.MM.YYYY format (with dots)
  else if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('.').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    // Handle other formats (ISO, etc.)
    date = new Date(dateString);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return dateString; // Return original string if parsing fails
  }

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
};
