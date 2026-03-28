// Search and filter screen for finding expenses by keyword, category, or date range
// Provides real-time search with results list

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';
import { useAppStore, selectCategories } from '../store';
import { Expense } from '../types';
import { formatCurrency, formatRelativeDate } from '../utils/helpers';

const SearchScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const searchExpenses = useAppStore((s) => s.searchExpenses); // Action — stable reference
  const categories = useAppStore(selectCategories); // Only subscribe to categories slice

  const [query, setQuery] = useState(''); // Search input text
  const [results, setResults] = useState<Expense[]>([]); // Search results
  const [searched, setSearched] = useState(false); // Whether a search has been performed
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Category filter

  // Execute search when input changes or category filter is applied
  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      // Search requires minimum 2 characters to reduce noise
      const data = await searchExpenses(text);
      // Apply optional category filter to search results
      const filtered = selectedCategory
        ? data.filter(e => e.category === selectedCategory)
        : data;
      setResults(filtered);
      setSearched(true);
    } else {
      setResults([]);
      setSearched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Toggle category filter on/off
  const toggleCategoryFilter = async (catName: string) => {
    const newCat = selectedCategory === catName ? null : catName; // Toggle off if already selected
    setSelectedCategory(newCat);

    if (query.length >= 2) {
      const data = await searchExpenses(query);
      // Apply category filter to existing results
      setResults(newCat ? data.filter(e => e.category === newCat) : data);
    }
  };

  // Find category info for icon and color display
  const getCategoryInfo = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    return { icon: cat?.icon || 'help-circle', color: cat?.color || '#999' };
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search input bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          value={query}
          onChangeText={handleSearch}
          placeholder={t.search.placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          autoFocus // Focus immediately when screen opens
          returnKeyType="search"
        />
        {/* Clear button shown when query has text */}
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips (horizontal scroll) */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedCategory === item.name ? item.color + '30' : theme.colors.surfaceVariant,
                borderColor: selectedCategory === item.name ? item.color : theme.colors.border,
                borderWidth: selectedCategory === item.name ? 2 : 1,
              },
            ]}
            onPress={() => toggleCategoryFilter(item.name)}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <MaterialCommunityIcons name={item.icon as any} size={16} color={item.color} />
            <Text style={[styles.filterChipText, { color: selectedCategory === item.name ? item.color : theme.colors.text }]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Search results list */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const catInfo = getCategoryInfo(item.category);
          return (
            <TouchableOpacity
              style={[styles.resultItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => navigation.navigate('ExpenseDetail', { expenseId: item.id })}
            >
              <View style={styles.resultRow}>
                {/* Category icon */}
                <View style={[styles.iconCircle, { backgroundColor: catInfo.color + '20' }]}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <MaterialCommunityIcons name={catInfo.icon as any} size={22} color={catInfo.color} />
                </View>
                {/* Expense details */}
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultCategory, { color: theme.colors.text }]}>{item.category}</Text>
                  <Text style={[styles.resultMeta, { color: theme.colors.textSecondary }]}>
                    {formatRelativeDate(item.date)}{item.notes ? ` • ${item.notes}` : ''}
                  </Text>
                  {/* Show tags if present */}
                  {item.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {item.tags.map((tag, i) => (
                        <View key={i} style={[styles.tagChip, { backgroundColor: theme.colors.chipBackground }]}>
                          <Text style={[styles.tagText, { color: theme.colors.chipText }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {/* Amount */}
                <Text style={[styles.resultAmount, { color: theme.colors.expense }]}>
                  -{formatCurrency(item.amount, item.currency)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searched ? (
            // No results found message
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="magnify" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{t.search.noResults}</Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                {t.search.noResultsHint}
              </Text>
            </View>
          ) : (
            // Initial prompt before searching
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="magnify" size={48} color={theme.colors.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {t.search.searchExpenses}
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.textTertiary }]}>
                {t.search.searchHint}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row', // Search icon, input, and clear button in a row
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 16 },
  categoryFilter: {
    maxHeight: 48, // Fixed height for horizontal scroll
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  resultsList: { paddingHorizontal: 16, paddingBottom: 100 },
  resultItem: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 0.5,
  },
  resultRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultInfo: { flex: 1 },
  resultCategory: { fontSize: 15, fontWeight: '600' },
  resultMeta: { fontSize: 12, marginTop: 2 },
  resultAmount: { fontSize: 15, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tagChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
});

export default SearchScreen;
