// UPI payment notification parser utility
// Detects and extracts payment data from Android notification text
// Supports Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, MobiKwik

import { UPITransactionType } from '../types';

// Mapping of UPI app package names to human-readable display names
export const UPI_APP_PACKAGES: Record<string, string> = {
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'net.one97.paytm': 'Paytm',
  'com.phonepe.app': 'PhonePe',
  'in.amazon.mShop.android.shopping': 'Amazon Pay',
  'com.bhim.axis': 'BHIM',
  'com.mobikwik_new': 'MobiKwik',
  'in.org.npci.upiapp': 'BHIM UPI',
  'com.paytm.business': 'Paytm Business',
  'com.freecharge': 'Freecharge',
  'com.myairtelapp': 'Airtel Payments',
};

// Set of all recognized UPI app package names for quick lookup
export const UPI_PACKAGE_SET = new Set(Object.keys(UPI_APP_PACKAGES));

// Check if a given package name belongs to a known UPI payment app
export const isUPIApp = (packageName: string): boolean => {
  return UPI_PACKAGE_SET.has(packageName);
};

// Get the human-readable app name from a package name
export const getAppName = (packageName: string): string => {
  return UPI_APP_PACKAGES[packageName] || 'Unknown UPI App';
};

// Regex patterns to extract amount from various notification formats
// Supports ₹, Rs., Rs, INR prefix/suffix with commas and decimals
const AMOUNT_PATTERNS = [
  /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i, // ₹1,234.56 or Rs.1234 or INR 500
  /([\d,]+(?:\.\d{1,2})?)\s*(?:₹|Rs\.?|INR)/i, // 1,234.56₹ or 1234 Rs
  /(?:amount|amt)[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i, // amount: ₹1234
  /(?:received|credited|debited|paid|sent)[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i, // received ₹500
];

// Keywords that indicate money was received (credit transaction)
const CREDIT_KEYWORDS = [
  'received', 'credited', 'credit', 'received from',
  'money received', 'payment received', 'got', 'added',
  'cashback', 'refund', 'reversed',
];

// Keywords that indicate money was sent/spent (debit transaction)
const DEBIT_KEYWORDS = [
  'sent', 'debited', 'debit', 'paid', 'payment to',
  'transferred', 'spent', 'charged', 'deducted',
  'payment successful', 'money sent',
];

// Parse the transaction amount from notification text
export const parseAmount = (text: string): number | null => {
  // Try each regex pattern until one matches
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Remove commas and parse as float
      const amount = parseFloat(match[1].replace(/,/g, ''));
      // Validate the amount is a positive, reasonable number
      if (!isNaN(amount) && amount > 0 && amount < 10000000) {
        return amount;
      }
    }
  }
  return null; // Could not extract a valid amount
};

// Determine if the notification describes a credit or debit transaction
export const parseTransactionType = (text: string): UPITransactionType | null => {
  const lowerText = text.toLowerCase();

  // Check for credit keywords first (received money)
  const isCredit = CREDIT_KEYWORDS.some(keyword => lowerText.includes(keyword));
  // Check for debit keywords (sent/spent money)
  const isDebit = DEBIT_KEYWORDS.some(keyword => lowerText.includes(keyword));

  // Return the detected type; if both match, debit takes priority (more common)
  if (isCredit && !isDebit) return 'credit';
  if (isDebit) return 'debit';
  if (isCredit) return 'credit';

  return null; // Could not determine transaction type
};

// Result of parsing a UPI notification
export interface ParsedUPINotification {
  amount: number | null; // Extracted amount or null if unparsable
  transactionType: UPITransactionType | null; // Credit/debit or null
  appName: string; // Human-readable source app name
  isUPIPayment: boolean; // Whether this is a valid UPI payment notification
}

// Parse a notification into structured UPI payment data
export const parseUPINotification = (
  packageName: string,
  text: string
): ParsedUPINotification => {
  // First check if the notification is from a recognized UPI app
  if (!isUPIApp(packageName)) {
    return {
      amount: null,
      transactionType: null,
      appName: 'Unknown',
      isUPIPayment: false,
    };
  }

  const amount = parseAmount(text);
  const transactionType = parseTransactionType(text);
  const appName = getAppName(packageName);

  // A valid UPI payment notification must have both an amount and a transaction type
  const isUPIPayment = amount !== null && transactionType !== null;

  return {
    amount,
    transactionType,
    appName,
    isUPIPayment,
  };
};
