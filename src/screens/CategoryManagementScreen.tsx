// Category management screen for creating, editing, and deleting expense categories
// Provides a grid of categories with color-coded icons

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories, selectSettings } from '../store';
import Button from '../components/common/Button';
import { formatCurrency } from '../utils/helpers';

// Predefined icon options for category selection
const ICON_OPTIONS = [
  'food', 'car', 'shopping', 'movie-open', 'flash', 'hospital-box',
  'school', 'airplane', 'cart', 'home', 'shield-check', 'face-man-shimmer',
  'gift', 'repeat', 'dots-horizontal', 'coffee', 'book-open', 'dumbbell',
  'music', 'palette', 'tools', 'phone', 'television', 'gamepad-variant',
  'baby-carriage', 'paw', 'flower', 'smoking', 'glass-cocktail', 'bank',
];

// Predefined color options for category visual identification
const COLOR_OPTIONS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
  '#98D8C8', '#F7DC6F', '#82E0AA', '#F0B27A', '#85C1E9', '#D7BDE2',
  '#F5B7B1', '#AED6F1', '#BDC3C7', '#E74C3C', '#3498DB', '#2ECC71',
  '#9B59B6', '#F39C12',
];

const CategoryManagementScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // Subscribe to individual store slices to avoid full-store re-renders
  const categories = useAppStore(selectCategories);
  const settings = useAppStore(selectSettings);
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

  // Modal state for add/edit form
  const [modalVisible, setModalVisible] = useState(false); // Whether the modal is shown
  const [editingId, setEditingId] = useState<string | null>(null); // Category being edited
  const [name, setName] = useState(''); // Category name input
  const [selectedIcon, setSelectedIcon] = useState('food'); // Selected icon
  const [selectedColor, setSelectedColor] = useState('#FF6B6B'); // Selected color
  const [budget, setBudget] = useState(''); // Optional budget limit

  // Open modal for creating a new category with default values
  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setSelectedIcon('food');
    setSelectedColor('#FF6B6B');
    setBudget('');
    setModalVisible(true);
  };

  // Open modal pre-filled with existing category data for editing
  const openEditModal = (category: typeof categories[0]) => {
    setEditingId(category.id);
    setName(category.name);
    setSelectedIcon(category.icon);
    setSelectedColor(category.color);
    setBudget(category.budget?.toString() || '');
    setModalVisible(true);
  };

  // Validate and save the category (create or update)
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }

    if (editingId) {
      // Update existing category
      await updateCategory(editingId, {
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        budget: budget ? parseFloat(budget) : undefined,
      });
    } else {
      // Create new category with the next sort order
      await addCategory({
        name: name.trim(),
        icon: selectedIcon,
        color: selectedColor,
        isDefault: false, // User-created categories are not default
        budget: budget ? parseFloat(budget) : undefined,
        order: categories.length + 1, // Append to end of list
      });
    }
    setModalVisible(false); // Close the modal after saving
  };

  // Confirm and delete a category
  const handleDelete = (id: string, isDefault: boolean) => {
    if (isDefault) {
      Alert.alert('Cannot Delete', 'Default categories cannot be deleted.');
      return;
    }
    Alert.alert('Delete Category', 'Are you sure? Existing expenses will keep this category name.', [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.delete, style: 'destructive', onPress: () => deleteCategory(id) },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Add new category button */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={openAddModal}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
        <Text style={styles.addButtonText}>{t.categoryManagement.addCategory}</Text>
      </TouchableOpacity>

      {/* Category list showing all categories */}
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.categoryItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={() => openEditModal(cat)}
          onLongPress={() => handleDelete(cat.id, cat.isDefault)} // Long press to delete
        >
          <View style={styles.categoryRow}>
            {/* Color-coded category icon */}
            <View style={[styles.iconCircle, { backgroundColor: cat.color + '20' }]}>
              <MaterialCommunityIcons name={cat.icon as any} size={24} color={cat.color} />
            </View>
            {/* Category name and budget display */}
            <View style={styles.categoryInfo}>
              <Text style={[styles.categoryName, { color: theme.colors.text }]}>{cat.name}</Text>
              {cat.budget && (
                <Text style={[styles.categoryBudget, { color: theme.colors.textSecondary }]}>
                  Budget: {formatCurrency(cat.budget, settings.defaultCurrency)}
                </Text>
              )}
            </View>
            {/* Default badge indicator */}
            {cat.isDefault && (
              <View style={[styles.defaultBadge, { backgroundColor: theme.colors.chipBackground }]}>
                <Text style={[styles.defaultText, { color: theme.colors.chipText }]}>{t.categoryManagement.defaultLabel}</Text>
              </View>
            )}
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />
          </View>
        </TouchableOpacity>
      ))}

      {/* Hint for long-press deletion */}
      <Text style={[styles.hint, { color: theme.colors.textTertiary }]}>
        Tap to edit • Long press to delete custom categories
      </Text>

      {/* Add/Edit Category Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Modal header with title and close button */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {editingId ? t.categoryManagement.editCategory : t.categoryManagement.newCategory}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Category name input */}
              <Text style={[styles.label, { color: theme.colors.text }]}>{t.categoryManagement.name}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder={t.categoryManagement.namePlaceholder}
                placeholderTextColor={theme.colors.textTertiary}
              />

              {/* Icon selection grid */}
              <Text style={[styles.label, { color: theme.colors.text }]}>{t.categoryManagement.icon}</Text>
              <View style={styles.optionsGrid}>
                {ICON_OPTIONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: selectedIcon === icon ? selectedColor + '30' : theme.colors.surfaceVariant,
                        borderColor: selectedIcon === icon ? selectedColor : 'transparent',
                        borderWidth: selectedIcon === icon ? 2 : 0,
                      },
                    ]}
                    onPress={() => setSelectedIcon(icon)} // Set selected icon
                  >
                    <MaterialCommunityIcons name={icon as any} size={24} color={selectedIcon === icon ? selectedColor : theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color selection grid */}
              <Text style={[styles.label, { color: theme.colors.text }]}>{t.categoryManagement.color}</Text>
              <View style={styles.optionsGrid}>
                {COLOR_OPTIONS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      {
                        backgroundColor: color,
                        borderWidth: selectedColor === color ? 3 : 0, // Highlight selected color
                        borderColor: theme.colors.text,
                      },
                    ]}
                    onPress={() => setSelectedColor(color)} // Set selected color
                  />
                ))}
              </View>

              {/* Optional budget limit input */}
              <Text style={[styles.label, { color: theme.colors.text }]}>{t.categoryManagement.monthlyBudget}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={budget}
                onChangeText={setBudget}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="decimal-pad"
              />

              {/* Save button */}
              <View style={styles.modalActions}>
                <Button title={t.categoryManagement.saveCategory} onPress={handleSave} fullWidth size="large" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  addButton: {
    flexDirection: 'row', // Plus icon and text side by side
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    gap: 8,
  },
  addButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  categoryItem: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 15, fontWeight: '600' },
  categoryBudget: { fontSize: 12, marginTop: 2 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8 },
  defaultText: { fontSize: 10, fontWeight: '600' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 16, marginBottom: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end', // Slide up from bottom
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%', // Don't cover the entire screen
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  optionsGrid: {
    flexDirection: 'row', // Grid layout for icons and colors
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18, // Circular color swatches
  },
  modalActions: { marginTop: 24, marginBottom: 20 },
});

export default CategoryManagementScreen;
