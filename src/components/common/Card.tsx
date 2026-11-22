// Reusable card component with theme-aware styling and soft elevation
// Used as a container for content blocks across the app

import React from 'react';
import { View, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode; // Card content
  style?: StyleProp<ViewStyle>; // Optional custom styles to merge
  onPress?: () => void; // Optional press handler — renders a pressable card with feedback
  onLongPress?: () => void; // Optional long-press handler
  variant?: 'elevated' | 'outlined' | 'flat'; // Visual treatment
}

// Card wraps children in a themed surface with consistent shadow and radius
const Card: React.FC<CardProps> = ({ children, style, onPress, onLongPress, variant = 'elevated' }) => {
  const { theme, isDark } = useTheme();

  const surfaceStyle: ViewStyle = {
    backgroundColor: variant === 'flat' ? theme.colors.surfaceVariant : theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: variant === 'outlined' || isDark ? StyleSheet.hairlineWidth : 0,
    shadowColor: '#0F172A',
    shadowOpacity: variant === 'elevated' && !isDark ? 0.06 : 0,
    elevation: variant === 'elevated' && !isDark ? 2 : 0,
  };

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          styles.card,
          surfaceStyle,
          style,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, surfaceStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20, // Generous rounding for a modern look
    padding: 16, // Inner spacing
    marginHorizontal: 16, // Horizontal margin from screen edges
    marginVertical: 6, // Vertical spacing between cards
    shadowOffset: { width: 0, height: 6 }, // Soft, diffused shadow
    shadowRadius: 16,
  },
});

export default React.memo(Card);
