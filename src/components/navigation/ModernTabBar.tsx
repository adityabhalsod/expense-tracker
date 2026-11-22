// Custom bottom tab bar: rounded docked bar with a raised centre "create" button
// The centre button opens a compact action menu (expense / income / transfer)

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useLanguage } from '../../i18n';
import { useAppStore, selectWallets } from '../../store';

// Icon pairs (inactive / active) for each tab route
const TAB_ICONS: Record<string, [string, string]> = {
  Home: ['home-variant-outline', 'home-variant'],
  Expenses: ['receipt-text-outline', 'receipt-text'],
  Analytics: ['chart-donut', 'chart-donut-variant'],
  Wallet: ['wallet-outline', 'wallet'],
  Settings: ['cog-outline', 'cog'],
};

const ModernTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const wallets = useAppStore(selectWallets);
  const [menuOpen, setMenuOpen] = useState(false);

  // Split the routes so the create button sits in the middle
  const mid = Math.ceil(state.routes.length / 2);

  // Navigate to a root-stack screen from inside the tab navigator
  const openStack = (screen: string, params?: object) => {
    setMenuOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigation as any).navigate(screen, params);
  };

  const renderTab = (index: number) => {
    const route = state.routes[index];
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
    const [iconOff, iconOn] = TAB_ICONS[route.name] ?? ['circle-outline', 'circle'];
    const color = focused ? theme.colors.primary : theme.colors.tabBarInactive;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.tab}
      >
        <View style={[styles.iconPill, focused && { backgroundColor: theme.colors.chipBackground }]}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <MaterialCommunityIcons name={(focused ? iconOn : iconOff) as any} size={22} color={color} />
        </View>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  const menuItems = [
    {
      key: 'expense',
      label: t.home.addExpense,
      icon: 'arrow-up-bold',
      color: theme.colors.expense,
      action: () => openStack('AddExpense', {}),
    },
    {
      key: 'income',
      label: t.homeIncome.addIncome,
      icon: 'arrow-down-bold',
      color: theme.colors.income,
      action: () => openStack('AddIncome', {}),
    },
    {
      key: 'transfer',
      label: t.homeIncome.transfer,
      icon: 'swap-horizontal-bold',
      color: theme.colors.info,
      action: () => {
        if (wallets.length < 2) {
          setMenuOpen(false);
          Alert.alert(t.transfer.noWallet, t.transfer.noWalletMsg);
          return;
        }
        openStack('Transfer');
      },
    },
    {
      key: 'debt',
      label: t.debts.title,
      icon: 'handshake',
      color: theme.colors.warning,
      action: () => openStack('Debts'),
    },
  ];

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.tabBar,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, 8),
            borderTopWidth: isDark ? StyleSheet.hairlineWidth : 0,
          },
        ]}
      >
        {state.routes.slice(0, mid).map((_, i) => renderTab(i))}
        {/* Raised centre create button */}
        <View style={styles.centerSlot}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.home.addExpense}
            style={({ pressed }) => [
              styles.centerButton,
              {
                backgroundColor: theme.colors.primary,
                shadowColor: theme.colors.primary,
                borderColor: theme.colors.tabBar,
              },
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={30} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
        {state.routes.slice(mid).map((_, i) => renderTab(i + mid))}
      </View>

      {/* Quick-create menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={[
              styles.menu,
              { backgroundColor: theme.colors.surfaceElevated, marginBottom: Math.max(insets.bottom, 8) + 84 },
            ]}
          >
            {menuItems.map((item) => (
              <Pressable
                key={item.key}
                onPress={item.action}
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '1F' }]}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={[styles.menuLabel, { color: theme.colors.text }]}>{item.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 16,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  iconPill: { width: 48, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '600' },
  centerSlot: { width: 72, alignItems: 'center' },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -30,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  menu: {
    width: '86%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});

export default ModernTabBar;
