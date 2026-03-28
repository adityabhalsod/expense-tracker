// Theme context provider enabling light/dark mode switching across the app

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme } from './colors';

// Storage key for persisting theme preference
const THEME_STORAGE_KEY = '@expense_tracker_theme';

// Shape of the theme context value
interface ThemeContextType {
  theme: Theme; // Current active theme object
  isDark: boolean; // Whether dark mode is active
  themeMode: 'light' | 'dark' | 'system'; // User's theme preference
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void; // Change theme preference
}

// Create context with light theme as the default fallback
const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  themeMode: 'system',
  setThemeMode: () => {},
});

// Custom hook for consuming theme context in child components
export const useTheme = () => useContext(ThemeContext);

// ThemeProvider component that manages theme state and persistence
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detect system color scheme (light or dark) from OS settings
  const systemColorScheme = useColorScheme();
  // Track user's theme mode preference (defaults to system)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');

  // Load saved theme preference from async storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeMode(saved); // Restore persisted preference
      }
    };
    loadTheme();
  }, []);

  // Persist theme preference whenever it changes
  const handleSetThemeMode = async (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  // Resolve whether dark mode should be active based on preference and system setting
  const isDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  // Select the appropriate theme object
  const theme = isDark ? darkTheme : lightTheme;

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      theme,
      isDark,
      themeMode,
      setThemeMode: handleSetThemeMode,
    }),
    [theme, isDark, themeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export { lightTheme, darkTheme, Theme };
