// Reusable card component with theme-aware styling and shadow
// Used as a container for content blocks across the app

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

interface CardProps {
  children: React.ReactNode; // Card content
  style?: ViewStyle; // Optional custom styles to merge
  onPress?: () => void; // Optional press handler (unused here, container only)
}

// Card wraps children in a themed surface with consistent shadow and radius
const Card: React.FC<CardProps> = ({ children, style }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface, // Theme-aware background
          shadowColor: theme.colors.shadow, // Theme-aware shadow
          borderColor: theme.colors.border, // Subtle border for definition
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16, // Rounded corners for modern look
    padding: 16, // Inner spacing
    marginHorizontal: 16, // Horizontal margin from screen edges
    marginVertical: 8, // Vertical spacing between cards
    shadowOffset: { width: 0, height: 2 }, // Shadow direction
    shadowOpacity: 1, // Full opacity (color controls transparency)
    shadowRadius: 8, // Shadow blur radius
    elevation: 3, // Android shadow elevation
    borderWidth: 0.5, // Subtle border for light mode definition
  },
});

export default Card;
