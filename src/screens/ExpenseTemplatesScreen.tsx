// Expense Templates screen — manage and quickly apply saved expense patterns
// Templates store frequently-used expense configurations for one-tap creation

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectExpenseTemplates, selectCategories } from '../store';
import { formatCurrency } from '../utils/helpers';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';

// Predefined icons for template visual identification
const TEMPLATE_ICONS = [
  'coffee', 'food', 'bus', 'gas-station', 'cart', 'pill',
  'dumbbell', 'movie-open', 'book-open-variant', 'gamepad-variant', 'wifi', 'phone',
];

// Color palette for template cards
const TEMPLATE_COLORS = [
  '#6C63FF', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#EC4899',
  '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#A855F7',
];

const ExpenseTemplatesScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const templates = useAppStore(selectExpenseTemplates);
  const categories = useAppStore(selectCategories);
  const addExpenseTemplate = useAppStore((s) => s.addExpenseTemplate);
  const applyTemplate = useAppStore((s) => s.useExpenseTemplate);
  const deleteExpenseTemplate = useAppStore((s) => s.deleteExpenseTemplate);

  // Modal state for creating new templates
  const [showModal, setShowModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateAmount, setTemplateAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('coffee');
  const [selectedColor, setSelectedColor] = useState('#6C63FF');
  const [loading, setLoading] = useState(false);

  // Reset all form fields when opening a fresh modal
  const resetForm = useCallback(() => {
    setTemplateName('');
    setTemplateAmount('');
    setSelectedCategory('');
    setNotes('');
    setSelectedIcon('coffee');
    setSelectedColor('#6C63FF');
  }, []);

  // Use a template: navigate to AddExpense with pre-filled data, increment usage count
  const handleUseTemplate = async (template: typeof templates[0]) => {
    await applyTemplate(template.id);
    navigation.navigate('AddExpense', {
      prefillCategory: template.category,
      prefillAmount: template.amount.toString(),
      prefillNotes: template.notes || '',
    });
  };

  // Save a new expense template from form data
  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !selectedCategory) return;
    const amount = parseFloat(templateAmount);
    if (!amount || amount <= 0) return;

    setLoading(true);
    try {
      await addExpenseTemplate({
        name: templateName.trim(),
        amount,
        category: selectedCategory,
        notes: notes.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
      });
      setShowModal(false);
      resetForm();
    } catch {
      Alert.alert(t.common.error, t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // Delete template with confirmation dialog
  const handleDelete = (id: string, name: string) => {
    Alert.alert(t.common.delete, `${t.templates.deleteConfirm} "${name}"?`, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => deleteExpenseTemplate(id) },
    ]);
  };

  // Sort templates by usage frequency (most used first) for quick access
  const sortedTemplates = [...templates].sort((a, b) => b.usageCount - a.usageCount);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {sortedTemplates.length === 0 ? (
          // Empty state when no templates exist
          <EmptyState
            icon="lightning-bolt"
            title={t.templates.noTemplates}
            subtitle={t.templates.noTemplatesHint}
            actionLabel={t.templates.createTemplate}
            onAction={() => { resetForm(); setShowModal(true); }}
          />
        ) : (
          // Template list grouped by usage
          <>
            {/* Usage-ordered template cards */}
            {sortedTemplates.map((template) => (
              <TouchableOpacity
                key={template.id}
                onPress={() => handleUseTemplate(template)}
                onLongPress={() => handleDelete(template.id, template.name)}
              >
                <Card style={styles.templateCard}>
                  <View style={styles.templateRow}>
                    {/* Template icon with colored background */}
                    <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <MaterialCommunityIcons name={template.icon as any} size={24} color={template.color} />
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={[styles.templateName, { color: theme.colors.text }]}>{template.name}</Text>
                      <Text style={[styles.templateCategory, { color: theme.colors.textSecondary }]}>{template.category}</Text>
                    </View>
                    {/* Amount and usage count */}
                    <View style={styles.templateRight}>
                      <Text style={[styles.templateAmount, { color: theme.colors.text }]}>{formatCurrency(template.amount)}</Text>
                      {template.usageCount > 0 && (
                        <Text style={[styles.usageCount, { color: theme.colors.textTertiary }]}>
                          {t.templates.used} {template.usageCount}×
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB for creating new templates */}
      {sortedTemplates.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => { resetForm(); setShowModal(true); }}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Create Template Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{t.templates.createTemplate}</Text>

              {/* Template name input */}
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={templateName}
                onChangeText={setTemplateName}
                placeholder={t.templates.templateName}
                placeholderTextColor={theme.colors.textTertiary}
              />

              {/* Amount input */}
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={templateAmount}
                onChangeText={setTemplateAmount}
                placeholder={t.templates.amount}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="decimal-pad"
              />

              {/* Category picker as scrollable chip grid */}
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.templates.category}</Text>
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border },
                      selectedCategory === cat.name && { backgroundColor: cat.color + '20', borderColor: cat.color },
                    ]}
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <MaterialCommunityIcons name={cat.icon as any} size={16} color={selectedCategory === cat.name ? cat.color : theme.colors.textSecondary} />
                    <Text style={[styles.categoryChipText, { color: selectedCategory === cat.name ? cat.color : theme.colors.text }]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes input (optional) */}
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t.templates.notes}
                placeholderTextColor={theme.colors.textTertiary}
              />

              {/* Icon selection grid */}
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.templates.icon}</Text>
              <View style={styles.iconGrid}>
                {TEMPLATE_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, selectedIcon === icon && { backgroundColor: selectedColor + '20', borderColor: selectedColor }]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <MaterialCommunityIcons name={icon as any} size={22} color={selectedIcon === icon ? selectedColor : theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color selection row */}
              <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{t.templates.color}</Text>
              <View style={styles.colorGrid}>
                {TEMPLATE_COLORS.map((color) => (
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
                <Button title={t.templates.createTemplate} onPress={handleSaveTemplate} loading={loading} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  templateCard: { marginBottom: 4 },
  templateRow: { flexDirection: 'row', alignItems: 'center' },
  templateIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  templateInfo: { flex: 1 },
  templateName: { fontSize: 15, fontWeight: '700' },
  templateCategory: { fontSize: 13, marginTop: 2 },
  templateRight: { alignItems: 'flex-end' },
  templateAmount: { fontSize: 16, fontWeight: '700' },
  usageCount: { fontSize: 11, marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, gap: 4,
  },
  categoryChipText: { fontSize: 13 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  iconOption: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  colorOption: { width: 32, height: 32, borderRadius: 16 },
  colorSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  modalActions: { flexDirection: 'row', marginTop: 8 },
});

export default ExpenseTemplatesScreen;
