// Analytics dashboard screen with pie charts, bar charts, and spending trends
// Provides visual insights into spending patterns across different time periods

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PieChart, BarChart, LineChart } from 'react-native-chart-kit';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories } from '../store';
import Card from '../components/common/Card';
import { formatCurrency, getDateRange, calculatePercentage, formatCompactNumber } from '../utils/helpers';
import { TimeRange } from '../types';
import * as db from '../database';

// Screen dimensions for responsive chart sizing
const screenWidth = Dimensions.get('window').width;

// Time range values for analytics period selection
const TIME_RANGE_VALUES: TimeRange[] = ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'];

const AnalyticsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const categories = useAppStore(selectCategories); // Only subscribe to categories slice

  // Translated time range labels
  const TIME_RANGES = TIME_RANGE_VALUES.map(value => ({
    value,
    label: ({ daily: t.analytics.today, weekly: t.analytics.week, monthly: t.analytics.month, quarterly: t.analytics.quarter, half_yearly: t.analytics.sixMonths, yearly: t.analytics.year } as Record<string, string>)[value] || value,
  }));

  // State for analytics data and UI controls
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly'); // Selected time period
  const [loading, setLoading] = useState(true); // Data loading indicator
  const [totalExpenses, setTotalExpenses] = useState(0); // Total spending in period
  const [categoryData, setCategoryData] = useState<any[]>([]); // Category breakdown data
  const [dailyData, setDailyData] = useState<any[]>([]); // Daily trend data
  const [expenseCount, setExpenseCount] = useState(0); // Number of transactions

  // Reload analytics data whenever the time range changes
  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  // Fetch all analytics data from the database for the selected period
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(timeRange); // Calculate date boundaries

      // Fetch total expenses and category breakdown in parallel
      const [total, catTotals, dailyTotals] = await Promise.all([
        db.getTotalExpenses(start, end),
        db.getCategoryTotals(start, end),
        db.getDailyTotals(start, end),
      ]);

      setTotalExpenses(total);
      setExpenseCount(catTotals.reduce((sum, c) => sum + c.count, 0)); // Sum transaction counts

      // Map category totals with colors and icons from the categories list
      const catData = catTotals.map((ct) => {
        const cat = categories.find(c => c.name === ct.category);
        return {
          name: ct.category,
          amount: ct.total,
          count: ct.count,
          color: cat?.color || '#999',
          icon: cat?.icon || 'help-circle',
          percentage: calculatePercentage(ct.total, total), // Percentage of total
          legendFontColor: theme.colors.text,
          legendFontSize: 12,
        };
      });
      setCategoryData(catData);

      // Format daily totals for the line chart
      setDailyData(dailyTotals.map(d => ({
        date: d.date,
        amount: d.total,
      })));
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare pie chart data from category breakdown (memoized)
  const pieChartData = useMemo(() => categoryData.slice(0, 6).map((cat) => ({
    name: cat.name,
    amount: cat.amount,
    color: cat.color,
    legendFontColor: theme.colors.text,
    legendFontSize: 11,
  })), [categoryData, theme.colors.text]);

  // Prepare bar chart data for top 5 categories (memoized)
  const barChartData = useMemo(() => ({
    labels: categoryData.slice(0, 5).map(c => c.name.substring(0, 6)),
    datasets: [{ data: categoryData.slice(0, 5).map(c => c.amount) }],
  }), [categoryData]);

  // Prepare line chart data for daily spending trends (memoized)
  const lineChartData = useMemo(() => ({
    labels: dailyData.slice(-7).map(d => d.date.substring(8, 10)),
    datasets: [{ data: dailyData.slice(-7).map(d => d.amount) }],
  }), [dailyData]);

  // Chart configuration for consistent styling across all charts (memoized)
  const chartConfig = useMemo(() => ({
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: () => theme.colors.primary,
    labelColor: () => theme.colors.textSecondary,
    propsForLabels: { fontSize: 10 },
    propsForBackgroundLines: { strokeDasharray: '', stroke: theme.colors.border },
  }), [theme.colors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Screen header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t.analytics.title}</Text>
        </View>

        {/* Time range selector tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeScroll}>
          {TIME_RANGES.map((range) => (
            <TouchableOpacity
              key={range.value}
              style={[
                styles.rangeChip,
                {
                  backgroundColor: timeRange === range.value ? theme.colors.primary : theme.colors.surfaceVariant,
                  borderColor: timeRange === range.value ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setTimeRange(range.value)} // Switch time range
            >
              <Text
                style={[
                  styles.rangeText,
                  { color: timeRange === range.value ? '#FFFFFF' : theme.colors.text },
                ]}
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          // Show loading indicator while fetching data
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {/* Summary statistics cards */}
            <View style={styles.statsRow}>
              {/* Total spending stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="cash-multiple" size={24} color={theme.colors.expense} />
                <Text style={[styles.statAmount, { color: theme.colors.text }]}>
                  {formatCompactNumber(totalExpenses)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{t.analytics.totalSpent}</Text>
              </View>
              {/* Transaction count stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="swap-horizontal" size={24} color={theme.colors.primary} />
                <Text style={[styles.statAmount, { color: theme.colors.text }]}>{expenseCount}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{t.analytics.transactions}</Text>
              </View>
              {/* Daily average stat */}
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={theme.colors.warning} />
                <Text style={[styles.statAmount, { color: theme.colors.text }]}>
                  {formatCompactNumber(dailyData.length > 0 ? totalExpenses / Math.max(dailyData.length, 1) : 0)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{t.analytics.dailyAvg}</Text>
              </View>
            </View>

            {/* Category distribution pie chart */}
            {pieChartData.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.analytics.spendingByCategory}</Text>
                <PieChart
                  data={pieChartData}
                  width={screenWidth - 64}
                  height={200}
                  chartConfig={chartConfig}
                  accessor="amount" // Field name for chart values
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute // Show absolute amounts vs percentages
                />
              </Card>
            )}

            {/* Top categories bar chart */}
            {categoryData.length > 0 && barChartData.datasets[0].data.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.analytics.topCategories}</Text>
                <BarChart
                  data={barChartData}
                  width={screenWidth - 64}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: () => theme.colors.primary,
                    barPercentage: 0.6,
                  }}
                  yAxisLabel="₹"
                  yAxisSuffix=""
                  showValuesOnTopOfBars // Display values above bars
                  fromZero // Start Y axis at zero
                  style={styles.chart}
                />
              </Card>
            )}

            {/* Spending trend line chart */}
            {dailyData.length > 1 && lineChartData.datasets[0].data.length > 1 && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.analytics.spendingTrend}</Text>
                <LineChart
                  data={lineChartData}
                  width={screenWidth - 64}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: () => theme.colors.primary,
                  }}
                  bezier // Smooth curve instead of straight lines
                  style={styles.chart}
                />
              </Card>
            )}

            {/* Category breakdown list with percentages */}
            {categoryData.length > 0 && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.analytics.categoryDetails}</Text>
                {categoryData.map((cat, index) => (
                  <View key={index} style={styles.catRow}>
                    {/* Category icon */}
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '20' }]}>
                      <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
                    </View>
                    {/* Category name and transaction count */}
                    <View style={styles.catInfo}>
                      <Text style={[styles.catName, { color: theme.colors.text }]}>{cat.name}</Text>
                      <Text style={[styles.catCount, { color: theme.colors.textSecondary }]}>
                        {cat.count} {cat.count !== 1 ? t.common.transactions : t.common.transaction}
                      </Text>
                    </View>
                    {/* Amount and percentage display */}
                    <View style={styles.catAmountContainer}>
                      <Text style={[styles.catAmount, { color: theme.colors.text }]}>
                        {formatCurrency(cat.amount)}
                      </Text>
                      <Text style={[styles.catPercent, { color: cat.color }]}>{cat.percentage}%</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )}

            {/* Empty state when no data exists */}
            {categoryData.length === 0 && (
              <Card style={styles.emptyCard}>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="chart-arc" size={64} color={theme.colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                    {t.analytics.noData}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                    {t.analytics.addExpensesHint}
                  </Text>
                </View>
              </Card>
            )}
          </>
        )}

        {/* Bottom spacer for tab bar clearance */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  rangeScroll: { paddingHorizontal: 16, marginBottom: 16 },
  rangeChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  rangeText: { fontSize: 13, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  statsRow: {
    flexDirection: 'row', // Three stat cards in a row
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 0.5,
  },
  statAmount: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 4, textAlign: 'center' },
  chartCard: { marginBottom: 8 },
  chartTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  chart: { borderRadius: 16, marginLeft: -12 },
  catRow: {
    flexDirection: 'row', // Category item layout
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catInfo: { flex: 1 },
  catName: { fontSize: 14, fontWeight: '600' },
  catCount: { fontSize: 11, marginTop: 2 },
  catAmountContainer: { alignItems: 'flex-end' },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catPercent: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  emptyCard: { marginTop: 24 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
});

export default AnalyticsScreen;
