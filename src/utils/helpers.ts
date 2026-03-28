// Utility functions for formatting, date calculations, and data transformations

import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subMonths } from 'date-fns';
import { TimeRange } from '../types';
import { CURRENCIES } from '../constants';

// Format a number as currency string with the appropriate symbol
export const formatCurrency = (amount: number, currencyCode: string = 'INR'): string => {
  const currency = CURRENCIES.find(c => c.code === currencyCode); // Find matching currency
  const symbol = currency?.symbol || '₹'; // Default to rupee if not found

  // Format with locale-appropriate thousand separators
  if (currencyCode === 'INR') {
    // Indian numbering system (e.g., 1,00,000)
    return `${symbol}${formatIndianNumber(amount)}`;
  }
  // Standard international format with 2 decimal places
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Format a raw numeric string with Indian-style commas for input field display
// Preserves partial input (e.g., "28000." stays as "28,000." without adding trailing zeros)
export const formatAmountInput = (value: string): string => {
  if (!value) return ''; // Return empty for empty input
  const parts = value.split('.');
  let intPart = parts[0];
  const decPart = parts.length > 1 ? '.' + parts[1] : ''; // Keep decimal as typed
  // Apply Indian grouping: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3); // Last three digits stay ungrouped
    const remaining = intPart.slice(0, -3); // Remaining digits grouped in pairs
    const groups = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = `${groups},${last3}`;
  }
  return intPart + decPart; // Combine integer and decimal parts
};

// Format number using Indian numbering system (lakhs, crores)
const formatIndianNumber = (num: number): string => {
  const isNegative = num < 0; // Track sign separately
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.'); // Split integer and decimal parts
  let intPart = parts[0];
  const decPart = parts[1];

  // Apply Indian grouping: last 3 digits, then groups of 2
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3); // Last three digits
    const remaining = intPart.slice(0, -3); // Remaining digits
    // Group remaining digits in pairs from right to left
    const groups = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    intPart = `${groups},${last3}`;
  }

  return `${isNegative ? '-' : ''}${intPart}.${decPart}`;
};

// Format a number as compact string (e.g., 1.2K, 3.5L for Indian)
export const formatCompactNumber = (num: number, currencyCode: string = 'INR'): string => {
  const currency = CURRENCIES.find(c => c.code === currencyCode);
  const symbol = currency?.symbol || '₹';

  if (currencyCode === 'INR') {
    // Indian compact format using lakhs and crores
    if (num >= 10000000) return `${symbol}${(num / 10000000).toFixed(1)}Cr`;
    if (num >= 100000) return `${symbol}${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `${symbol}${(num / 1000).toFixed(1)}K`;
    return `${symbol}${num.toFixed(0)}`;
  }
  // International compact format
  if (num >= 1000000) return `${symbol}${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${symbol}${(num / 1000).toFixed(1)}K`;
  return `${symbol}${num.toFixed(0)}`;
};

// Format a date string to a human-readable display format
export const formatDate = (dateString: string, formatStr: string = 'MMM dd, yyyy'): string => {
  return format(new Date(dateString), formatStr); // Use date-fns format
};

// Format a date for display as relative time (e.g., "Today", "Yesterday")
export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = subDays(today, 1);

  // Compare date portions only (ignore time)
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return format(date, 'MMM dd, yyyy'); // Fall back to standard format
};

// Calculate start and end dates for a given time range filter
export const getDateRange = (range: TimeRange, customStart?: Date, customEnd?: Date): { start: string; end: string } => {
  const now = new Date();

  switch (range) {
    case 'daily':
      // Current day only
      return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    case 'weekly':
      // Current week (Monday to Sunday)
      return { start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    case 'monthly':
      // Current month
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'quarterly':
      // Current quarter
      return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(endOfQuarter(now), 'yyyy-MM-dd') };
    case 'half_yearly':
      // Last 6 months from today
      return { start: format(subMonths(now, 6), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    case 'yearly':
      // Current year
      return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd') };
    case 'custom':
      // Custom date range provided by user
      return {
        start: customStart ? format(customStart, 'yyyy-MM-dd') : format(startOfMonth(now), 'yyyy-MM-dd'),
        end: customEnd ? format(customEnd, 'yyyy-MM-dd') : format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    default:
      return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
};

// Get a greeting message based on time of day
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning'; // Before noon
  if (hour < 17) return 'Good Afternoon'; // Noon to 5 PM
  return 'Good Evening'; // After 5 PM
};

// Calculate percentage with safe division (avoids NaN)
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0; // Prevent division by zero
  return Math.round((value / total) * 100);
};

// Truncate text to a max length with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...'; // Add ellipsis for overflow
};

// Get the currency symbol for a given currency code
export const getCurrencySymbol = (code: string): string => {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency?.symbol || '₹'; // Default to rupee symbol
};
