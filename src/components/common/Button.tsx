// Reusable themed button component with multiple variants
// Supports primary, secondary, outline, and text styles

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

interface ButtonProps {
  title: string; // Button label text
  onPress: () => void; // Press handler callback
  variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'danger'; // Visual style variant
  size?: 'small' | 'medium' | 'large'; // Size variant
  loading?: boolean; // Show loading spinner instead of text
  disabled?: boolean; // Disable interaction
  icon?: React.ReactNode; // Optional leading icon element
  style?: ViewStyle; // Custom container styles
  textStyle?: TextStyle; // Custom text styles
  fullWidth?: boolean; // Stretch to fill parent width
}

// Themed button with loading state, disabled state, and variant support
const Button: React.FC<ButtonProps> = ({
  title, onPress, variant = 'primary', size = 'medium',
  loading = false, disabled = false, icon, style, textStyle, fullWidth = false,
}) => {
  const { theme } = useTheme();

  // Determine background color based on variant
  const getBackgroundColor = () => {
    if (disabled) return theme.colors.border; // Grey out when disabled
    switch (variant) {
      case 'primary': return theme.colors.primary;
      case 'secondary': return theme.colors.primaryLight;
      case 'outline': return 'transparent'; // No background for outline
      case 'text': return 'transparent'; // No background for text
      case 'danger': return theme.colors.error;
      default: return theme.colors.primary;
    }
  };

  // Determine text color based on variant
  const getTextColor = () => {
    if (disabled) return theme.colors.textTertiary;
    switch (variant) {
      case 'primary': return '#FFFFFF'; // White text on solid backgrounds
      case 'secondary': return theme.colors.primary;
      case 'outline': return theme.colors.primary;
      case 'text': return theme.colors.primary;
      case 'danger': return '#FFFFFF';
      default: return '#FFFFFF';
    }
  };

  // Determine padding based on size variant
  const getPadding = () => {
    switch (size) {
      case 'small': return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'medium': return { paddingVertical: 12, paddingHorizontal: 24 };
      case 'large': return { paddingVertical: 16, paddingHorizontal: 32 };
    }
  };

  // Determine font size based on size variant
  const getFontSize = () => {
    switch (size) {
      case 'small': return 13;
      case 'medium': return 15;
      case 'large': return 17;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? theme.colors.primary : 'transparent', // Border for outline only
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: disabled ? 0.6 : 1, // Visual feedback for disabled state
        },
        fullWidth && styles.fullWidth, // Expand to full width if specified
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading} // Block presses when loading or disabled
      activeOpacity={0.7} // Slight dim on press for feedback
    >
      {loading ? (
        // Show spinner during loading state
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {typeof icon === 'string' ? (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <MaterialCommunityIcons name={icon as any} size={getFontSize() + 2} color={getTextColor()} />
          ) : icon}
          <Text style={[styles.text, { color: getTextColor(), fontSize: getFontSize() }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12, // Rounded corners for modern feel
    flexDirection: 'row', // Layout icon and text horizontally
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8, // Space between icon and text
  },
  text: {
    fontWeight: '600', // Semi-bold for button labels
  },
  fullWidth: {
    width: '100%', // Stretch to parent width
  },
});

export default React.memo(Button);
