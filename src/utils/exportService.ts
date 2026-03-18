// Export service for generating reports in multiple formats (JSON, CSV, Excel-compatible, PDF-like)
// Uses expo-file-system for file creation and expo-sharing for sharing

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Expense } from '../types';
import { formatDate } from './helpers';

// Export expenses as a formatted JSON file
export const exportAsJSON = async (expenses: Expense[], filename: string): Promise<void> => {
  // Create clean JSON representation of expenses
  const data = expenses.map(e => ({
    date: e.date,
    amount: e.amount,
    category: e.category,
    notes: e.notes || '',
    tags: e.tags.join(', '),
    currency: e.currency,
  }));

  const jsonString = JSON.stringify(data, null, 2); // Pretty-print with 2-space indent
  const filePath = `${FileSystem.documentDirectory}${filename}.json`;
  await FileSystem.writeAsStringAsync(filePath, jsonString); // Write file to device storage
  await Sharing.shareAsync(filePath, { mimeType: 'application/json' }); // Open share dialog
};

// Export expenses as a CSV file compatible with spreadsheet apps
export const exportAsCSV = async (expenses: Expense[], filename: string): Promise<void> => {
  // CSV column headers
  const headers = ['Date', 'Amount', 'Category', 'Notes', 'Tags', 'Currency'];
  const rows = expenses.map(e => [
    e.date,
    e.amount.toString(),
    e.category,
    `"${(e.notes || '').replace(/"/g, '""')}"`, // Escape quotes in notes
    `"${e.tags.join(', ')}"`, // Wrap tags with quotes for CSV safety
    e.currency,
  ]);

  // Join headers and rows with commas and newlines
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const filePath = `${FileSystem.documentDirectory}${filename}.csv`;
  await FileSystem.writeAsStringAsync(filePath, csvContent);
  await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
};

// Export expenses as an Excel-compatible XML spreadsheet (.xlsx simulation)
export const exportAsExcel = async (expenses: Expense[], filename: string): Promise<void> => {
  // Generate Excel XML format that Excel and Google Sheets can open
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '  <Worksheet ss:Name="Expenses">\n';
  xml += '    <Table>\n';

  // Header row with column titles
  xml += '      <Row>\n';
  ['Date', 'Amount', 'Category', 'Notes', 'Tags', 'Currency'].forEach(h => {
    xml += `        <Cell><Data ss:Type="String">${h}</Data></Cell>\n`;
  });
  xml += '      </Row>\n';

  // Data rows for each expense
  expenses.forEach(e => {
    xml += '      <Row>\n';
    xml += `        <Cell><Data ss:Type="String">${e.date}</Data></Cell>\n`;
    xml += `        <Cell><Data ss:Type="Number">${e.amount}</Data></Cell>\n`;
    xml += `        <Cell><Data ss:Type="String">${e.category}</Data></Cell>\n`;
    xml += `        <Cell><Data ss:Type="String">${escapeXml(e.notes || '')}</Data></Cell>\n`;
    xml += `        <Cell><Data ss:Type="String">${e.tags.join(', ')}</Data></Cell>\n`;
    xml += `        <Cell><Data ss:Type="String">${e.currency}</Data></Cell>\n`;
    xml += '      </Row>\n';
  });

  xml += '    </Table>\n';
  xml += '  </Worksheet>\n';
  xml += '</Workbook>';

  const filePath = `${FileSystem.documentDirectory}${filename}.xls`;
  await FileSystem.writeAsStringAsync(filePath, xml);
  await Sharing.shareAsync(filePath, { mimeType: 'application/vnd.ms-excel' });
};

// Export expenses as a formatted PDF-style HTML file (opens in PDF viewers)
export const exportAsPDF = async (
  expenses: Expense[],
  filename: string,
  summary?: { total: number; currency: string; period: string }
): Promise<void> => {
  // Calculate summary stats for the report footer
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const currencySymbol = summary?.currency || '₹';

  // Build HTML document styled to look like a formal PDF report
  let html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body { font-family: 'Helvetica', Arial, sans-serif; padding: 30px; color: #333; }
  h1 { color: #6C63FF; border-bottom: 3px solid #6C63FF; padding-bottom: 10px; }
  h2 { color: #555; margin-top: 20px; }
  .summary { background: #f5f5ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
  .summary-item { display: inline-block; margin-right: 30px; }
  .summary-value { font-size: 24px; font-weight: bold; color: #6C63FF; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #6C63FF; color: white; padding: 12px 8px; text-align: left; }
  td { padding: 10px 8px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) { background: #f9f9ff; }
  .total-row { font-weight: bold; background: #f0f0ff !important; }
  .footer { margin-top: 30px; text-align: center; color: #999; font-size: 12px; }
</style></head><body>
<h1>Expense Report</h1>
${summary ? `<h2>${summary.period}</h2>` : ''}
<div class="summary">
  <div class="summary-item"><div>Total Expenses</div><div class="summary-value">${currencySymbol}${totalAmount.toFixed(2)}</div></div>
  <div class="summary-item"><div>Transactions</div><div class="summary-value">${expenses.length}</div></div>
</div>
<table>
<tr><th>#</th><th>Date</th><th>Category</th><th>Amount</th><th>Notes</th></tr>`;

  // Add a table row for each expense
  expenses.forEach((e, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${formatDate(e.date, 'MMM dd, yyyy')}</td>
      <td>${e.category}</td>
      <td>${currencySymbol}${e.amount.toFixed(2)}</td>
      <td>${e.notes || '-'}</td>
    </tr>`;
  });

  // Total row at the bottom of the table
  html += `<tr class="total-row"><td colspan="3">Total</td><td>${currencySymbol}${totalAmount.toFixed(2)}</td><td></td></tr>`;
  html += `</table>
<div class="footer">Generated by Personal Expense Tracker • ${formatDate(new Date().toISOString(), 'MMMM dd, yyyy')}</div>
</body></html>`;

  const filePath = `${FileSystem.documentDirectory}${filename}.html`;
  await FileSystem.writeAsStringAsync(filePath, html);
  await Sharing.shareAsync(filePath, { mimeType: 'text/html' }); // HTML can be printed to PDF by receiver
};

// Escape special XML characters to prevent injection in XML exports
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
