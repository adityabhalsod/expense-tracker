// Monthly Insights screen — AI-like spending analysis comparing current vs previous month
// Generates insight cards with trends, anomalies, and actionable financial observations

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories } from '../store';
import { MonthlyInsight } from '../types';
import { formatCurrency } from '../utils/helpers';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import * as db from '../database';

const MonthlyInsightsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const categories = useAppStore(selectCategories);
  const [insights, setInsights] = useState<MonthlyInsight[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate insights by comparing current month data with previous month
  const generateInsights = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const curStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const curEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const prevMonth = subMonths(now, 1);
      const prevStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
      const prevEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

      // Fetch both months' data in parallel for comparison
      const [curTotal, prevTotal, curCats, prevCats, curIncome, prevIncome] = await Promise.all([
        db.getTotalExpenses(curStart, curEnd),
        db.getTotalExpenses(prevStart, prevEnd),
        db.getCategoryTotals(curStart, curEnd),
        db.getCategoryTotals(prevStart, prevEnd),
        db.getTotalIncome(curStart, curEnd),
        db.getTotalIncome(prevStart, prevEnd),
      ]);

      const newInsights: MonthlyInsight[] = [];

      // Insight 1: Overall spending trend (up or down from last month)
      if (prevTotal > 0) {
        const change = ((curTotal - prevTotal) / prevTotal) * 100;
        if (Math.abs(change) > 5) {
          newInsights.push({
            type: change > 0 ? 'warning' : 'positive',
            title: change > 0 ? t.insights.spendingUp : t.insights.spendingDown,
            description: `${t.insights.vsLastMonth}: ${change > 0 ? '+' : ''}${change.toFixed(0)}% (${formatCurrency(curTotal)} vs ${formatCurrency(prevTotal)})`,
            icon: change > 0 ? 'trending-up' : 'trending-down',
            color: change > 0 ? '#EF4444' : '#10B981',
            value: change,
          });
        }
      }

      // Insight 2: Savings rate (income minus expenses, if income tracked)
      if (curIncome > 0) {
        const savingsRate = ((curIncome - curTotal) / curIncome) * 100;
        newInsights.push({
          type: savingsRate >= 20 ? 'positive' : savingsRate >= 0 ? 'info' : 'warning',
          title: t.insights.savingsRate,
          description: `${savingsRate.toFixed(0)}% ${t.insights.ofIncome} (${formatCurrency(curIncome - curTotal)})`,
          icon: savingsRate >= 20 ? 'piggy-bank' : 'alert-circle',
          color: savingsRate >= 20 ? '#10B981' : savingsRate >= 0 ? '#3B82F6' : '#EF4444',
          value: savingsRate,
        });
      }

      // Insight 3: Find the top spending category this month
      if (curCats.length > 0) {
        const topCat = curCats.reduce((a, b) => a.total > b.total ? a : b);
        const cat = categories.find(c => c.name === topCat.category);
        newInsights.push({
          type: 'info',
          title: t.insights.topCategory,
          description: `${topCat.category}: ${formatCurrency(topCat.total)} (${topCat.count} ${t.insights.transactions})`,
          icon: cat?.icon || 'tag',
          color: cat?.color || '#3B82F6',
        });
      }

      // Insight 4: Detect category spending spikes vs previous month (>50% increase)
      const prevCatMap = new Map(prevCats.map(c => [c.category, c.total]));
      for (const cur of curCats) {
        const prev = prevCatMap.get(cur.category) || 0;
        if (prev > 0 && cur.total > prev * 1.5) {
          const spike = ((cur.total - prev) / prev) * 100;
          newInsights.push({
            type: 'warning',
            title: `${cur.category} ${t.insights.spike}`,
            description: `+${spike.toFixed(0)}%: ${formatCurrency(prev)} → ${formatCurrency(cur.total)}`,
            icon: 'alert-octagon',
            color: '#F59E0B',
            value: spike,
          });
          break; // Show only the biggest spike to avoid overwhelming the user
        }
      }

      // Insight 5: Income trend comparison
      if (prevIncome > 0 && curIncome > 0) {
        const incomeChange = ((curIncome - prevIncome) / prevIncome) * 100;
        if (Math.abs(incomeChange) > 5) {
          newInsights.push({
            type: incomeChange > 0 ? 'positive' : 'warning',
            title: incomeChange > 0 ? t.insights.incomeUp : t.insights.incomeDown,
            description: `${incomeChange > 0 ? '+' : ''}${incomeChange.toFixed(0)}% (${formatCurrency(curIncome)} vs ${formatCurrency(prevIncome)})`,
            icon: incomeChange > 0 ? 'arrow-up-bold' : 'arrow-down-bold',
            color: incomeChange > 0 ? '#10B981' : '#EF4444',
            value: incomeChange,
          });
        }
      }

      // Insight 6: Daily average spending
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      if (curTotal > 0) {
        const dailyAvg = curTotal / dayOfMonth;
        const projectedTotal = dailyAvg * daysInMonth;
        newInsights.push({
          type: 'info',
          title: t.insights.dailyAverage,
          description: `${formatCurrency(dailyAvg)}/day → ${t.insights.projected}: ${formatCurrency(projectedTotal)}`,
          icon: 'calculator',
          color: '#6366F1',
          value: dailyAvg,
        });
      }

      setInsights(newInsights);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setLoading(false);
    }
  }, [t, categories]);

  // Regenerate insights whenever screen gains focus (data may have changed)
  useFocusEffect(useCallback(() => { generateInsights(); }, [generateInsights]));

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      {/* Header with month label */}
      <Text style={[styles.header, { color: theme.colors.text }]}>
        {format(new Date(), 'MMMM yyyy')}
      </Text>

      {insights.length === 0 ? (
        // No insights — not enough data yet
        <EmptyState
          icon="lightbulb-on"
          title={t.insights.noInsights}
          subtitle={t.insights.noInsightsHint}
        />
      ) : (
        // Render each insight as a colored card
        insights.map((insight, idx) => (
          <Card key={idx} style={styles.insightCard}>
            <View style={styles.insightRow}>
              {/* Insight icon with tinted background */}
              <View style={[styles.insightIcon, { backgroundColor: insight.color + '15' }]}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <MaterialCommunityIcons name={insight.icon as any} size={24} color={insight.color} />
              </View>
              <View style={styles.insightContent}>
                <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{insight.title}</Text>
                <Text style={[styles.insightDesc, { color: theme.colors.textSecondary }]}>{insight.description}</Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  insightCard: { marginBottom: 4 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start' },
  insightIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 13, lineHeight: 18 },
});

export default MonthlyInsightsScreen;
