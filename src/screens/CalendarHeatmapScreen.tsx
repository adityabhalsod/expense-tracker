// Calendar Heatmap screen — visualize daily spending intensity across a month
// Color intensity maps to spending amount, providing at-a-glance spending patterns

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, addMonths, subMonths, getDay, getDaysInMonth, parseISO } from 'date-fns';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { formatCurrency } from '../utils/helpers';
import Card from '../components/common/Card';
import * as db from '../database';

// Screen width for responsive calendar cell sizing
const screenWidth = Dimensions.get('window').width;
// 7 columns for days of week, with padding accounted for
const CELL_SIZE = Math.floor((screenWidth - 48) / 7);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Intensity color scale — from no spending to very high spending
const INTENSITY_COLORS = [
  'transparent',   // level 0: no data
  '#D1FAE5',       // level 1: light green (low spending)
  '#6EE7B7',       // level 2: medium-light 
  '#34D399',       // level 3: medium
  '#10B981',       // level 4: medium-high
  '#059669',       // level 5: high spending
];

const CalendarHeatmapScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dailyTotals, setDailyTotals] = useState<Map<string, number>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [monthTotal, setMonthTotal] = useState(0);
  const [maxDaily, setMaxDaily] = useState(0);

  // Fetch daily spending totals for the current month from database
  const loadData = useCallback(async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;

    const totals = await db.getDailyExpenseTotals(year, month);
    const map = new Map<string, number>();
    let total = 0;
    let max = 0;

    // Convert array results to a lookup map keyed by date string
    totals.forEach((row: { date: string; total: number }) => {
      map.set(row.date, row.total);
      total += row.total;
      if (row.total > max) max = row.total;
    });

    setDailyTotals(map);
    setMonthTotal(total);
    setMaxDaily(max);
    setSelectedDay(null);
  }, [currentMonth]);

  // Reload data when screen gains focus or month changes
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Determine color intensity level (0-5) based on amount relative to month's max
  const getIntensityLevel = (amount: number): number => {
    if (amount === 0) return 0;
    if (maxDaily === 0) return 1;
    const ratio = amount / maxDaily;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
  };

  // Build the calendar grid: generate all days including padding for first day offset
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOffset = getDay(startOfMonth(currentMonth)); // 0=Sun, 6=Sat
  const calendarCells: (string | null)[] = [];

  // Add empty cells for days before the 1st
  for (let i = 0; i < firstDayOffset; i++) calendarCells.push(null);
  // Add actual day cells
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d), 'yyyy-MM-dd'));
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Month navigation header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <MaterialCommunityIcons name="chevron-right" size={28} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Monthly spending summary */}
      <Card style={styles.summaryCard}>
        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>{t.calendarHeatmap.monthTotal}</Text>
        <Text style={[styles.summaryAmount, { color: theme.colors.expense }]}>{formatCurrency(monthTotal)}</Text>
        {maxDaily > 0 && (
          <Text style={[styles.summaryDetail, { color: theme.colors.textTertiary }]}>
            {t.calendarHeatmap.highestDay}: {formatCurrency(maxDaily)}
          </Text>
        )}
      </Card>

      {/* Day-of-week column headers */}
      <View style={styles.dayLabels}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[styles.dayLabel, { color: theme.colors.textTertiary, width: CELL_SIZE }]}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid with color-coded cells */}
      <View style={styles.grid}>
        {calendarCells.map((dateStr, idx) => {
          if (!dateStr) {
            // Empty padding cell
            return <View key={`empty-${idx}`} style={[styles.cell, { width: CELL_SIZE, height: CELL_SIZE }]} />;
          }
          const amount = dailyTotals.get(dateStr) || 0;
          const level = getIntensityLevel(amount);
          const dayNum = parseInt(dateStr.split('-')[2], 10);
          const isSelected = selectedDay === dateStr;

          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.cell,
                { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: INTENSITY_COLORS[level] },
                level === 0 && { backgroundColor: theme.colors.inputBackground },
                isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
              ]}
              onPress={() => setSelectedDay(isSelected ? null : dateStr)}
            >
              <Text style={[styles.cellDay, { color: level >= 3 ? '#FFF' : theme.colors.text }]}>{dayNum}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day detail tooltip */}
      {selectedDay && (
        <Card style={styles.detailCard}>
          <Text style={[styles.detailDate, { color: theme.colors.text }]}>
            {format(parseISO(selectedDay), 'EEEE, MMM d')}
          </Text>
          <Text style={[styles.detailAmount, { color: theme.colors.expense }]}>
            {formatCurrency(dailyTotals.get(selectedDay) || 0)}
          </Text>
        </Card>
      )}

      {/* Intensity legend showing color scale */}
      <View style={styles.legend}>
        <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>{t.calendarHeatmap.less}</Text>
        {INTENSITY_COLORS.slice(1).map((color, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: color }]} />
        ))}
        <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>{t.calendarHeatmap.more}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  summaryCard: { marginBottom: 16, alignItems: 'center', paddingVertical: 16 },
  summaryLabel: { fontSize: 13 },
  summaryAmount: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  summaryDetail: { fontSize: 12, marginTop: 4 },
  dayLabels: { flexDirection: 'row', marginBottom: 4 },
  dayLabel: { textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { justifyContent: 'center', alignItems: 'center', borderRadius: 6, margin: 0 },
  cellDay: { fontSize: 12, fontWeight: '600' },
  detailCard: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  detailDate: { fontSize: 15, fontWeight: '600' },
  detailAmount: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 6 },
  legendLabel: { fontSize: 11, marginHorizontal: 4 },
  legendCell: { width: 16, height: 16, borderRadius: 3 },
});

export default CalendarHeatmapScreen;
