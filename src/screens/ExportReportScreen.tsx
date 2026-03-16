// Export report screen allowing users to export expense data in multiple formats
// Supports JSON, CSV, Excel, and PDF exports for various time periods

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { TimeRange, ExportFormat } from '../types';
import { getDateRange } from '../utils/helpers';
import { exportAsJSON, exportAsCSV, exportAsExcel, exportAsPDF } from '../utils/exportService';
import * as db from '../database';
import { format } from 'date-fns';

// Time period options for export range selection
const TIME_RANGES: { value: TimeRange; label: string; icon: string }[] = [
  { value: 'daily', label: 'Today', icon: 'calendar-today' },
  { value: 'weekly', label: 'This Week', icon: 'calendar-week' },
  { value: 'monthly', label: 'This Month', icon: 'calendar-month' },
  { value: 'quarterly', label: 'Quarter', icon: 'calendar-range' },
  { value: 'half_yearly', label: '6 Months', icon: 'calendar-clock' },
  { value: 'yearly', label: 'This Year', icon: 'calendar' },
];

// Export format options with descriptions
const FORMATS: { value: ExportFormat; label: string; icon: string; description: string }[] = [
  { value: 'json', label: 'JSON', icon: 'code-json', description: 'Structured data format' },
  { value: 'csv', label: 'CSV', icon: 'file-delimited', description: 'Spreadsheet compatible' },
  { value: 'xlsx', label: 'Excel', icon: 'file-excel', description: 'Microsoft Excel format' },
  { value: 'pdf', label: 'PDF', icon: 'file-pdf-box', description: 'Printable report' },
];

const ExportReportScreen = () => {
  const { theme } = useTheme();

  // Export configuration state
  const [selectedRange, setSelectedRange] = useState<TimeRange>('monthly'); // Selected time range
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv'); // Selected file format
  const [exporting, setExporting] = useState(false); // Export in progress indicator

  // Execute the export operation with selected options
  const handleExport = async () => {
    setExporting(true);
    try {
      const { start, end } = getDateRange(selectedRange); // Calculate date range
      const expenses = await db.getExpensesByDateRange(start, end); // Fetch expenses in range

      if (expenses.length === 0) {
        Alert.alert('No Data', 'No expenses found for the selected period.');
        setExporting(false);
        return;
      }

      // Generate filename with date and range info
      const filename = `expense_report_${selectedRange}_${format(new Date(), 'yyyyMMdd')}`;
      const summary = {
        total: expenses.reduce((sum, e) => sum + e.amount, 0),
        currency: '₹',
        period: `${selectedRange.replace('_', ' ')} report`,
      };

      // Call the appropriate export function based on selected format
      switch (selectedFormat) {
        case 'json':
          await exportAsJSON(expenses, filename);
          break;
        case 'csv':
          await exportAsCSV(expenses, filename);
          break;
        case 'xlsx':
          await exportAsExcel(expenses, filename);
          break;
        case 'pdf':
          await exportAsPDF(expenses, filename, summary);
          break;
      }
    } catch (error) {
      Alert.alert('Export Failed', 'Unable to export the report. Please try again.');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Time period selection section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Select Time Period</Text>
      <View style={styles.optionsGrid}>
        {TIME_RANGES.map((range) => (
          <TouchableOpacity
            key={range.value}
            style={[
              styles.optionCard,
              {
                backgroundColor: selectedRange === range.value ? theme.colors.primary + '15' : theme.colors.surface,
                borderColor: selectedRange === range.value ? theme.colors.primary : theme.colors.border,
                borderWidth: selectedRange === range.value ? 2 : 0.5,
              },
            ]}
            onPress={() => setSelectedRange(range.value)} // Set selected time range
          >
            <MaterialCommunityIcons
              name={range.icon as any}
              size={28}
              color={selectedRange === range.value ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.optionLabel,
                { color: selectedRange === range.value ? theme.colors.primary : theme.colors.text },
              ]}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Export format selection section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Export Format</Text>
      {FORMATS.map((fmt) => (
        <TouchableOpacity
          key={fmt.value}
          style={[
            styles.formatCard,
            {
              backgroundColor: selectedFormat === fmt.value ? theme.colors.primary + '10' : theme.colors.surface,
              borderColor: selectedFormat === fmt.value ? theme.colors.primary : theme.colors.border,
              borderWidth: selectedFormat === fmt.value ? 2 : 0.5,
            },
          ]}
          onPress={() => setSelectedFormat(fmt.value)} // Set selected format
        >
          <MaterialCommunityIcons
            name={fmt.icon as any}
            size={32}
            color={selectedFormat === fmt.value ? theme.colors.primary : theme.colors.textSecondary}
          />
          <View style={styles.formatInfo}>
            <Text
              style={[
                styles.formatLabel,
                { color: selectedFormat === fmt.value ? theme.colors.primary : theme.colors.text },
              ]}
            >
              {fmt.label}
            </Text>
            <Text style={[styles.formatDesc, { color: theme.colors.textSecondary }]}>{fmt.description}</Text>
          </View>
          {/* Checkmark indicator for selected format */}
          {selectedFormat === fmt.value && (
            <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.primary} />
          )}
        </TouchableOpacity>
      ))}

      {/* Export button */}
      <View style={styles.exportContainer}>
        <Button
          title={exporting ? 'Exporting...' : 'Export Report'}
          onPress={handleExport}
          loading={exporting}
          fullWidth
          size="large"
          icon={!exporting ? <MaterialCommunityIcons name="download" size={20} color="#FFF" /> : undefined}
        />
      </View>

      {/* Info note about export behavior */}
      <Card>
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="information-outline" size={20} color={theme.colors.info} />
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            The exported file will open a share dialog where you can save, email, or share the report via any app.
          </Text>
        </View>
      </Card>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  optionsGrid: {
    flexDirection: 'row', // 3-column grid for time ranges
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionCard: {
    width: '31%', // Three columns with gap
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  formatCard: {
    flexDirection: 'row', // Icon, text, and checkmark in a row
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    gap: 14,
  },
  formatInfo: { flex: 1 },
  formatLabel: { fontSize: 16, fontWeight: '600' },
  formatDesc: { fontSize: 12, marginTop: 2 },
  exportContainer: { marginTop: 24, marginBottom: 16 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export default ExportReportScreen;
