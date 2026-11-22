// Rounded tinted square holding an icon — the app's standard icon treatment

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface IconBadgeProps {
  icon: string; // MaterialCommunityIcons name
  color: string; // Icon colour; background is a translucent tint of it
  size?: number; // Outer size in dp
  style?: StyleProp<ViewStyle>;
}

const IconBadge: React.FC<IconBadgeProps> = ({ icon, color, size = 44, style }) => (
  <View
    style={[
      styles.badge,
      { width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '1F' },
      style,
    ]}
  >
    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
    <MaterialCommunityIcons name={icon as any} size={size * 0.5} color={color} />
  </View>
);

const styles = StyleSheet.create({
  badge: { justifyContent: 'center', alignItems: 'center' },
});

export default React.memo(IconBadge);
