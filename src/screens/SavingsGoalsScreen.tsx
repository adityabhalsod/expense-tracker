// Savings Goals screen — track financial targets with progress visualization
// Supports creating, contributing to, and managing savings goals

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectSavingsGoals } from '../store';
import { formatCurrency } from '../utils/helpers';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';

// Predefined icons for goal selection
const GOAL_ICONS = [
  'piggy-bank', 'car', 'home', 'airplane', 'school', 'cellphone',
  'laptop', 'gift', 'heart', 'shield', 'cash', 'diamond-stone',
];

// Predefined colors for goal visual identity
const GOAL_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899',
  '#14B8A6', '#6366F1', '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];

const SavingsGoalsScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const goals = useAppStore(selectSavingsGoals);
  const addSavingsGoal = useAppStore((s) => s.addSavingsGoal);
  const updateSavingsGoal = useAppStore((s) => s.updateSavingsGoal);
  const deleteSavingsGoal = useAppStore((s) => s.deleteSavingsGoal);

  // Modal state for creating/editing goals
  const [showModal, setShowModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('piggy-bank');
  const [selectedColor, setSelectedColor] = useState('#10B981');
  const [loading, setLoading] = useState(false);

  // Modal state for adding contributions
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  // Reset modal form fields to defaults
  const resetForm = useCallback(() => {
    setGoalName('');
    setTargetAmount('');
    setSelectedIcon('piggy-bank');
    setSelectedColor('#10B981');
    setEditingGoalId(null);
  }, []);

  // Open modal for creating a new goal
  const handleNewGoal = () => {
    resetForm();
    setShowModal(true);
  };

  // Open modal for editing an existing goal
  const handleEditGoal = (goal: typeof goals[0]) => {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setSelectedIcon(goal.icon);
    setSelectedColor(goal.color);
    setShowModal(true);
  };

  // Save a new or updated savings goal
  const handleSaveGoal = async () => {
    if (!goalName.trim()) return;
    const amount = parseFloat(targetAmount);
    if (!amount || amount <= 0) return;

    setLoading(true);
    try {
      if (editingGoalId) {
        // Update existing goal
        await updateSavingsGoal(editingGoalId, {
          name: goalName.trim(),
          targetAmount: amount,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        // Create new goal
        await addSavingsGoal({
          name: goalName.trim(),
          targetAmount: amount,
          currentAmount: 0,
          icon: selectedIcon,
          color: selectedColor,
        });
      }
      setShowModal(false);
      resetForm();
    } catch {
      Alert.alert(t.common.error, t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // Open contribution modal for a specific goal
  const handleContribute = (goalId: string) => {
    setContributeGoalId(goalId);
    setContributeAmount('');
    setShowContributeModal(true);
  };

  // Add a contribution to a savings goal
  const handleSaveContribution = async () => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0 || !contributeGoalId) return;

    const goal = goals.find((g) => g.id === contributeGoalId);
    if (!goal) return;

    await updateSavingsGoal(contributeGoalId, {
      currentAmount: goal.currentAmount + amount,
    });
    setShowContributeModal(false);
  };

  // Delete a savings goal with confirmation
  const handleDelete = (id: string) => {
    Alert.alert(t.savingsGoals.deleteTitle, t.savingsGoals.deleteMsg, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => deleteSavingsGoal(id) },
    ]);
  };

  // Calculate progress percentage capped at 100
  const getProgress = (current: number, target: number) => Math.min((current / target) * 100, 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {goals.length === 0 ? (
          // Empty state when no goals exist
          <EmptyState
            icon="piggy-bank"
            title={t.savingsGoals.noGoals}
            subtitle={t.savingsGoals.noGoalsHint}
            actionLabel={t.savingsGoals.createGoal}
            onAction={handleNewGoal}
          />
        ) : (
          // Render each savings goal as a progress card
          goals.map((goal) => {
            const progress = getProgress(goal.currentAmount, goal.targetAmount);
            const isComplete = progress >= 100;
            return (
              <TouchableOpacity key={goal.id} onPress={() => handleEditGoal(goal)} onLongPress={() => handleDelete(goal.id)}>
                <Card style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    {/* Goal icon with colored background */}
                    <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MaterialCommunityIcons name={goal.icon as any} size={28} color={goal.color} />
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={[styles.goalName, { color: theme.colors.text }]}>{goal.name}</Text>
                      <Text style={[styles.goalTarget, { color: theme.colors.textSecondary }]}>
                        {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                      </Text>
                    </View>
                    {/* Completion badge or contribute button */}
                    {isComplete ? (
                      <View style={[styles.badge, { backgroundColor: '#10B981' }]}>
                        <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.contributeBtn, { backgroundColor: goal.color + '15', borderColor: goal.color }]}
                        onPress={() => handleContribute(goal.id)}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color={goal.color} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Progress bar visualization */}
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.inputBackground }]}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: goal.color }]} />
                  </View>
                  {/* Progress percentage and status label */}
                  <View style={styles.goalFooter}>
                    <Text style={[styles.progressText, { color: goal.color }]}>{progress.toFixed(0)}%</Text>
                    <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
                      {isComplete ? t.savingsGoals.completed : `${formatCurrency(goal.targetAmount - goal.currentAmount)} ${t.savingsGoals.remaining}`}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB for creating new goals */}
      {goals.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={handleNewGoal}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Create/Edit Goal Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {editingGoalId ? t.savingsGoals.editGoal : t.savingsGoals.newGoal}
            </Text>

            {/* Goal name input */}
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={goalName}
              onChangeText={setGoalName}
              placeholder={t.savingsGoals.goalNamePlaceholder}
              placeholderTextColor={theme.colors.textTertiary}
            />

            {/* Target amount input */}
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder={t.savingsGoals.targetAmount}
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="decimal-pad"
            />

            {/* Icon selection grid */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.savingsGoals.icon}</Text>
            <View style={styles.iconGrid}>
              {GOAL_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <MaterialCommunityIcons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : theme.colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Color selection row */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.savingsGoals.color}</Text>
            <View style={styles.colorGrid}>
              {GOAL_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <Button title={t.common.cancel} variant="outline" onPress={() => setShowModal(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button
                title={editingGoalId ? t.savingsGoals.updateGoal : t.savingsGoals.createGoal}
                onPress={handleSaveGoal}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Contribute Modal */}
      <Modal visible={showContributeModal} animationType="fade" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t.savingsGoals.addContribution}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={contributeAmount}
              onChangeText={setContributeAmount}
              placeholder={t.savingsGoals.contributionAmount}
              placeholderTextColor={theme.colors.textTertiary}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button title={t.common.cancel} variant="outline" onPress={() => setShowContributeModal(false)} style={{ flex: 1, marginRight: 8 }} />
              <Button title={t.common.save} onPress={handleSaveContribution} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  goalCard: { marginBottom: 4 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  goalInfo: { flex: 1 },
  goalName: { fontSize: 16, fontWeight: '700' },
  goalTarget: { fontSize: 13, marginTop: 2 },
  badge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  contributeBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 13, fontWeight: '700' },
  statusText: { fontSize: 12 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconOption: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorOption: { width: 32, height: 32, borderRadius: 16 },
  colorSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  modalActions: { flexDirection: 'row', marginTop: 8 },
});

export default SavingsGoalsScreen;
