// Theme context provider enabling light/dark mode switching, accent palettes and privacy mode across the app

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme, AccentName, ACCENTS, DEFAULT_ACCENT, buildTheme } from './colors';

// Storage keys for persisting appearance preferences
const THEME_STORAGE_KEY = '@expense_tracker_theme';
const ACCENT_STORAGE_KEY = '@expense_tracker_accent';
const PRIVACY_STORAGE_KEY = '@expense_tracker_hide_amounts';

type ThemeMode = 'light' | 'dark' | 'system';

// Shape of the theme context value
interface ThemeContextType {
  theme: Theme; // Current active theme object
  isDark: boolean; // Whether dark mode is active
  themeMode: ThemeMode; // User's theme preference
  setThemeMode: (mode: ThemeMode) => void; // Change theme preference
  accent: AccentName; // Selected accent palette
  setAccent: (accent: AccentName) => void; // Change accent palette
  hideAmounts: boolean; // Privacy mode: mask balances on dashboard surfaces
  toggleHideAmounts: () => void; // Flip privacy mode
}

// Create context with light theme as the default fallback
const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  themeMode: 'system',
  setThemeMode: () => {},
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
  hideAmounts: false,
  toggleHideAmounts: () => {},
});

// Custom hook for consuming theme context in child components
export const useTheme = () => useContext(ThemeContext);

// ThemeProvider component that manages theme state and persistence
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detect system color scheme (light or dark) from OS settings
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<AccentName>(DEFAULT_ACCENT);
  const [hideAmounts, setHideAmounts] = useState(false);

  // Load saved appearance preferences from async storage on mount
  useEffect(() => {
    const load = async () => {
      try {
        const [savedMode, savedAccent, savedPrivacy] = await Promise.all([
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem(ACCENT_STORAGE_KEY),
          AsyncStorage.getItem(PRIVACY_STORAGE_KEY),
        ]);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') setThemeModeState(savedMode);
        if (savedAccent && ACCENTS.some((a) => a.name === savedAccent)) setAccentState(savedAccent as AccentName);
        if (savedPrivacy === '1') setHideAmounts(true);
      } catch (e) {
        console.warn('Failed to load appearance preferences:', e);
      }
    };
    load();
  }, []);

  // Persist theme preference whenever it changes
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  // Persist accent preference whenever it changes
  const setAccent = useCallback((next: AccentName) => {
    setAccentState(next);
    AsyncStorage.setItem(ACCENT_STORAGE_KEY, next).catch(() => {});
  }, []);

  // Flip privacy mode and persist it
  const toggleHideAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      AsyncStorage.setItem(PRIVACY_STORAGE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  // Resolve whether dark mode should be active based on preference and system setting
  const isDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  // Build the theme object from base mode + accent palette
  const theme = useMemo(() => buildTheme(isDark, accent), [isDark, accent]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({ theme, isDark, themeMode, setThemeMode, accent, setAccent, hideAmounts, toggleHideAmounts }),
    [theme, isDark, themeMode, setThemeMode, accent, setAccent, hideAmounts, toggleHideAmounts],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { lightTheme, darkTheme, ACCENTS };
export type { Theme, AccentName };
