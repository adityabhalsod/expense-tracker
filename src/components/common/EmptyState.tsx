// Empty state component displayed when lists have no data
// Shows an icon, title, and optional action button

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import Button from './Button';

interface EmptyStateProps {
  icon: string; // MaterialCommunityIcons icon name
  title: string; // Main message text
  subtitle?: string; // Optional secondary description
  actionLabel?: string; // Optional button label
  onAction?: () => void; // Optional button press handler
}

// Centered empty state with icon, messaging, and optional CTA button
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, subtitle, actionLabel, onAction }) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Large icon to visually indicate empty state */}
      <MaterialCommunityIcons
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name={icon as any}
        size={80}
        color={theme.colors.textTertiary}
      />
      {/* Main empty state message */}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {/* Optional description below the title */}
      {subtitle && (
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      )}
      {/* Optional action button for user to create first item */}
      {actionLabel && onAction && (
        <View style={styles.buttonContainer}>
          <Button title={actionLabel} onPress={onAction} variant="primary" size="medium" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
    padding: 32,
    minHeight: 300, // Minimum height so it's visible
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: 24,
  },
});

export default React.memo(EmptyState);
