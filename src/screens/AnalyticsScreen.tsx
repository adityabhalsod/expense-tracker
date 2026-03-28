// Analytics dashboard screen with pie charts, bar charts, and spending trends
// Provides visual insights into spending patterns across different time periods

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart, BarChart, LineChart, StackedBarChart } from 'react-native-chart-kit';
import Svg, { Rect, Text as SvgText, Path } from 'react-native-svg';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [categoryData, setCategoryData] = useState<any[]>([]); // Category breakdown data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dailyData, setDailyData] = useState<any[]>([]); // Daily trend data
  const [expenseCount, setExpenseCount] = useState(0); // Number of transactions
  const [totalIncome, setTotalIncome] = useState(0); // Total income in period
  const [weeklyCategories, setWeeklyCategories] = useState<{ week: string; category: string; total: number }[]>([]); // Weekly stacked data

  // Fetch all analytics data from the database for the selected period
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(timeRange); // Calculate date boundaries

      // Fetch total expenses and category breakdown in parallel
      const [total, catTotals, dailyTotals, income, weeklyCats] = await Promise.all([
        db.getTotalExpenses(start, end),
        db.getCategoryTotals(start, end),
        db.getDailyTotals(start, end),
        db.getTotalIncome(start, end),
        db.getCategoryTotalsByWeek(start, end),
      ]);

      setTotalExpenses(total);
      setTotalIncome(income);
      setWeeklyCategories(weeklyCats); // Store weekly category breakdown for stacked chart
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
  }, [timeRange, categories, theme.colors.text]);

  // Refresh analytics on screen focus AND when time range changes
  // useFocusEffect fires on initial mount + every time this tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

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

  // Prepare stacked bar chart data — top 4 categories by week (memoized)
  const stackedBarData = useMemo(() => {
    if (weeklyCategories.length === 0) return null;
    // Get top 4 categories by total spend across all weeks
    const catTotals = new Map<string, number>();
    weeklyCategories.forEach(wc => catTotals.set(wc.category, (catTotals.get(wc.category) || 0) + wc.total));
    const topCats = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0]);
    // Get unique weeks sorted chronologically
    const weeks = [...new Set(weeklyCategories.map(wc => wc.week))].sort().slice(-6);
    if (weeks.length < 2) return null; // Need at least 2 weeks for comparison
    // Build data matrix: each row = week, each col = category total for that week
    const data = weeks.map(week => topCats.map(cat => {
      const entry = weeklyCategories.find(wc => wc.week === week && wc.category === cat);
      return entry ? entry.total : 0;
    }));
    // Map category colors
    const colors = topCats.map(cat => {
      const c = categories.find(c => c.name === cat);
      return c?.color || '#999';
    });
    return {
      labels: weeks.map(w => w.replace(/^\d{4}-W/, 'W')), // Shorten "2024-W23" to "W23"
      legend: topCats,
      data,
      barColors: colors,
    };
  }, [weeklyCategories, categories]);

  // Prepare spending flow data — income to top category allocation (memoized)
  const flowData = useMemo(() => {
    if (totalIncome === 0 || categoryData.length === 0) return null;
    // Take top 5 categories for the flow visualization
    const topCats = categoryData.slice(0, 5);
    const otherTotal = categoryData.slice(5).reduce((sum, c) => sum + c.amount, 0);
    const entries = [...topCats.map(c => ({ name: c.name, amount: c.amount, color: c.color }))];
    if (otherTotal > 0) entries.push({ name: 'Other', amount: otherTotal, color: '#9CA3AF' });
    // Calculate remaining (savings) if income > expenses
    const totalSpent = entries.reduce((sum, e) => sum + e.amount, 0);
    const savings = totalIncome - totalSpent;
    if (savings > 0) entries.push({ name: 'Savings', amount: savings, color: '#10B981' });
    return entries;
  }, [totalIncome, categoryData]);

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

            {/* Income vs Expense comparison card — data viz upgrade */}
            {(totalExpenses > 0 || totalIncome > 0) && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.dataViz?.incomeVsExpense || 'Income vs Expense'}</Text>
                <View style={styles.comparisonRow}>
                  {/* Income bar */}
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: theme.colors.textSecondary }]}>{t.dataViz.income}</Text>
                    <View style={[styles.comparisonBar, { backgroundColor: '#D1FAE5' }]}>
                      <View style={[styles.comparisonFill, { backgroundColor: '#10B981', width: `${totalIncome > 0 ? Math.min((totalIncome / Math.max(totalIncome, totalExpenses)) * 100, 100) : 0}%` }]} />
                    </View>
                    <Text style={[styles.comparisonAmount, { color: '#10B981' }]}>{formatCurrency(totalIncome)}</Text>
                  </View>
                  {/* Expense bar */}
                  <View style={styles.comparisonItem}>
                    <Text style={[styles.comparisonLabel, { color: theme.colors.textSecondary }]}>{t.dataViz.expense}</Text>
                    <View style={[styles.comparisonBar, { backgroundColor: '#FEE2E2' }]}>
                      <View style={[styles.comparisonFill, { backgroundColor: '#EF4444', width: `${totalExpenses > 0 ? Math.min((totalExpenses / Math.max(totalIncome, totalExpenses)) * 100, 100) : 0}%` }]} />
                    </View>
                    <Text style={[styles.comparisonAmount, { color: '#EF4444' }]}>{formatCurrency(totalExpenses)}</Text>
                  </View>
                  {/* Savings rate */}
                  <View style={styles.savingsRateRow}>
                    <MaterialCommunityIcons name="piggy-bank" size={18} color={totalIncome > totalExpenses ? '#10B981' : '#EF4444'} />
                    <Text style={[styles.savingsRateText, { color: totalIncome > totalExpenses ? '#10B981' : '#EF4444' }]}>
                      {totalIncome > 0 ? `${(((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(0)}% ${t.dataViz.savingsRate}` : t.dataViz.noIncome}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Stacked bar chart — category spending over weeks */}
            {stackedBarData && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.dataViz?.stackedChart || 'Category Breakdown by Week'}</Text>
                <StackedBarChart
                  data={stackedBarData}
                  width={screenWidth - 64}
                  height={240}
                  chartConfig={{
                    ...chartConfig,
                    barPercentage: 0.6,
                  }}
                  style={styles.chart}
                  hideLegend={false}
                />
              </Card>
            )}

            {/* Spending flow — income flowing into category allocations */}
            {flowData && totalIncome > 0 && (
              <Card style={styles.chartCard}>
                <Text style={[styles.chartTitle, { color: theme.colors.text }]}>{t.dataViz?.incomeFlow || 'Spending Flow'}</Text>
                <View>
                  <Svg width={screenWidth - 64} height={Math.max(flowData.length * 38 + 40, 200)}>
                    {/* Source: Income label on the left */}
                    <Rect x={0} y={20} width={90} height={36} rx={8} fill={theme.colors.primary} />
                    <SvgText x={45} y={43} fontSize={12} fontWeight="600" fill="#FFFFFF" textAnchor="middle">
                      {t.dataViz?.income || 'Income'}
                    </SvgText>
                    <SvgText x={45} y={70} fontSize={10} fill={theme.colors.textSecondary} textAnchor="middle">
                      {formatCompactNumber(totalIncome)}
                    </SvgText>
                    {/* Flow paths from income to each category */}
                    {flowData.map((entry, idx) => {
                      const yTarget = 20 + idx * 38; // Vertical position for each flow target
                      const barWidth = Math.max((entry.amount / totalIncome) * 120, 20); // Proportional width
                      return (
                        <React.Fragment key={idx}>
                          {/* Curved path from income box to category bar */}
                          <Path
                            d={`M 90 38 C 130 38, 130 ${yTarget + 18}, 160 ${yTarget + 18}`}
                            stroke={entry.color}
                            strokeWidth={Math.max((entry.amount / totalIncome) * 6, 1.5)}
                            fill="none"
                            opacity={0.6}
                          />
                          {/* Category bar */}
                          <Rect
                            x={160}
                            y={yTarget}
                            width={barWidth}
                            height={28}
                            rx={6}
                            fill={entry.color}
                            opacity={0.85}
                          />
                          {/* Category name and amount label */}
                          <SvgText
                            x={160 + barWidth + 6}
                            y={yTarget + 14}
                            fontSize={11}
                            fontWeight="500"
                            fill={theme.colors.text}
                          >
                            {entry.name}
                          </SvgText>
                          <SvgText
                            x={160 + barWidth + 6}
                            y={yTarget + 26}
                            fontSize={9}
                            fill={theme.colors.textSecondary}
                          >
                            {formatCompactNumber(entry.amount)} ({totalIncome > 0 ? ((entry.amount / totalIncome) * 100).toFixed(0) : 0}%)
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </View>
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
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
  comparisonRow: { gap: 12 },
  comparisonItem: { gap: 4 },
  comparisonLabel: { fontSize: 13, fontWeight: '600' },
  comparisonBar: { height: 12, borderRadius: 6, overflow: 'hidden' },
  comparisonFill: { height: '100%', borderRadius: 6 },
  comparisonAmount: { fontSize: 15, fontWeight: '700' },
  savingsRateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  savingsRateText: { fontSize: 13, fontWeight: '600' },
});

export default AnalyticsScreen;
