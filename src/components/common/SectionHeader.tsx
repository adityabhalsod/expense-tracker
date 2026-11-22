// Section title row with an optional trailing action link

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: React.ReactNode; // Custom trailing element (overrides action link)
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actionLabel, onAction, right }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {right ??
        (actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[styles.action, { color: theme.colors.primary }]}>{actionLabel}</Text>
          </Pressable>
        ) : null)}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  action: { fontSize: 14, fontWeight: '600' },
});

export default React.memo(SectionHeader);
