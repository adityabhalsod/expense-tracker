// Slim rounded progress bar used for budgets, goals and debt repayment

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../theme';

interface ProgressBarProps {
  progress: number; // 0..1 (values outside are clamped)
  color?: string; // Fill colour (defaults to primary)
  trackColor?: string; // Track colour (defaults to surfaceVariant)
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color, trackColor, height = 8, style }) => {
  const { theme } = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? theme.colors.surfaceVariant },
        style,
      ]}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});

export default React.memo(ProgressBar);
