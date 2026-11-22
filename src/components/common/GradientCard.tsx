// Monotonic counter so every mounted card gets its own SVG gradient id
// (stacked screens stay mounted, and duplicate ids make url(#id) resolve to a hidden card)
let gradientCounter = 0;

// Hero surface painted with the active accent gradient
// Built on react-native-svg so no extra native gradient dependency is required

import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';

interface GradientCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  colors?: [string, string]; // Override the accent gradient stops
  decorative?: boolean; // Draw soft translucent orbs for depth
}

const GradientCard: React.FC<GradientCardProps> = ({ children, style, colors, decorative = true }) => {
  const { theme } = useTheme();
  const [from, to] = colors ?? theme.colors.gradient;
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = `heroGradient${++gradientCounter}`;
  const gradientId = idRef.current;

  return (
    <View style={[styles.container, { shadowColor: from }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        {decorative && (
          <>
            <Circle cx="92%" cy="8%" r="90" fill="#FFFFFF" fillOpacity={0.09} />
            <Circle cx="78%" cy="105%" r="70" fill="#FFFFFF" fillOpacity={0.06} />
          </>
        )}
      </Svg>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 22,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
});

export default React.memo(GradientCard);
