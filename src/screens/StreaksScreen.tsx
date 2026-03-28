// Streaks & Gamification screen — track expense logging consistency and earn badges
// Motivates daily usage through visual streak counters and achievement system

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectStreak } from '../store';
import { Badge } from '../types';
import Card from '../components/common/Card';
import * as db from '../database';

// Predefined achievements—awarded when specific milestones are reached
const BADGE_DEFINITIONS: { id: string; icon: string; color: string; days: number }[] = [
  { id: 'streak_3', icon: 'fire', color: '#F59E0B', days: 3 },
  { id: 'streak_7', icon: 'fire', color: '#EF4444', days: 7 },
  { id: 'streak_14', icon: 'star', color: '#3B82F6', days: 14 },
  { id: 'streak_30', icon: 'trophy', color: '#8B5CF6', days: 30 },
  { id: 'streak_60', icon: 'diamond-stone', color: '#EC4899', days: 60 },
  { id: 'streak_100', icon: 'crown', color: '#F97316', days: 100 },
  { id: 'streak_365', icon: 'rocket-launch', color: '#10B981', days: 365 },
];

const StreaksScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const streak = useAppStore(selectStreak);
  const [badges, setBadges] = useState<Badge[]>([]);

  // Load earned badges from database on screen focus
  useFocusEffect(
    useCallback(() => {
      db.getAllBadges().then(setBadges);
    }, [])
  );

  // Set of badge IDs the user has earned, for quick lookup
  const earnedSet = new Set(badges.map((b) => b.id));

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      {/* Streak flame animation card — main visual focus */}
      <Card style={styles.streakCard}>
        <View style={[styles.flameContainer, { backgroundColor: streak.currentStreak > 0 ? '#FEF3C7' : theme.colors.inputBackground }]}>
          <MaterialCommunityIcons
            name="fire"
            size={64}
            color={streak.currentStreak > 0 ? '#F59E0B' : theme.colors.textTertiary}
          />
        </View>
        <Text style={[styles.streakCount, { color: theme.colors.text }]}>{streak.currentStreak}</Text>
        <Text style={[styles.streakLabel, { color: theme.colors.textSecondary }]}>
          {streak.currentStreak === 1 ? t.streaks.day : t.streaks.days}
        </Text>
        <Text style={[styles.streakDesc, { color: theme.colors.textTertiary }]}>
          {streak.currentStreak > 0 ? t.streaks.keepGoing : t.streaks.startStreak}
        </Text>
      </Card>

      {/* Stats row — longest streak and total active days */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={24} color="#8B5CF6" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{streak.longestStreak}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{t.streaks.longestStreak}</Text>
        </Card>
        <Card style={styles.statCard}>
          <MaterialCommunityIcons name="calendar-check" size={24} color="#10B981" />
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{streak.totalDaysActive}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>{t.streaks.totalDays}</Text>
        </Card>
      </View>

      {/* Badge achievements grid */}
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t.streaks.badges}</Text>
      <View style={styles.badgeGrid}>
        {BADGE_DEFINITIONS.map((def) => {
          const earned = earnedSet.has(def.id);
          return (
            <Card key={def.id} style={{ ...styles.badgeCard, ...(!earned ? { opacity: 0.4 } : {}) }}>
              {/* Badge icon — colored when earned, muted when locked */}
              <View style={[styles.badgeIcon, { backgroundColor: earned ? def.color + '20' : theme.colors.inputBackground }]}>
                <MaterialCommunityIcons
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  name={def.icon as any}
                  size={28}
                  color={earned ? def.color : theme.colors.textTertiary}
                />
              </View>
              <Text style={[styles.badgeDays, { color: theme.colors.text }]}>{def.days} {t.streaks.days}</Text>
              {/* Lock icon overlay for unearned badges */}
              {!earned && (
                <MaterialCommunityIcons name="lock" size={14} color={theme.colors.textTertiary} style={styles.lockIcon} />
              )}
              {/* Checkmark overlay for earned badges */}
              {earned && (
                <MaterialCommunityIcons name="check-circle" size={16} color={def.color} style={styles.checkIcon} />
              )}
            </Card>
          );
        })}
      </View>

      {/* Motivational tips section */}
      <Card style={styles.tipsCard}>
        <MaterialCommunityIcons name="lightbulb-on" size={20} color="#F59E0B" />
        <Text style={[styles.tipsText, { color: theme.colors.textSecondary }]}>
          {t.streaks.tip}
        </Text>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  streakCard: { alignItems: 'center', paddingVertical: 28, marginBottom: 16 },
  flameContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  streakCount: { fontSize: 48, fontWeight: '800' },
  streakLabel: { fontSize: 16, fontWeight: '600', marginTop: -4 },
  streakDesc: { fontSize: 13, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  badgeCard: { width: (Dimensions.get('window').width - 64) / 3, alignItems: 'center', paddingVertical: 14 },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  badgeDays: { fontSize: 12, fontWeight: '600' },
  lockIcon: { position: 'absolute', top: 8, right: 8 },
  checkIcon: { position: 'absolute', top: 8, right: 8 },
  tipsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  tipsText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

export default StreaksScreen;
