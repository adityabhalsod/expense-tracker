// Language context provider for multi-language support (English, Gujarati, Hindi)
// Persists language preference via AsyncStorage and provides t() translation function

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en, { TranslationKeys } from './en';
import gu from './gu';
import hi from './hi';

// Supported language codes
export type LanguageCode = 'en' | 'gu' | 'hi';

// Storage key for persisting language preference
const LANGUAGE_STORAGE_KEY = '@expense_tracker_language';

// Map of language codes to their translation objects
const translations: Record<LanguageCode, TranslationKeys> = { en, gu, hi };

// Display labels for the language picker
export const LANGUAGES: { code: LanguageCode; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
];

// Shape of the language context value
interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: TranslationKeys;
}

// Create context with English as default
const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: en,
});

// Custom hook for consuming language context
export const useLanguage = () => useContext(LanguageContext);

// Provider component that manages language state and persistence
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'gu' || saved === 'hi') {
        setLanguageState(saved);
      }
    };
    loadLanguage();
  }, []);

  // Update language and persist to storage
  const setLanguage = useCallback(async (lang: LanguageCode) => {
    setLanguageState(lang);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  // Get the current translation object
  const t = translations[language];

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
