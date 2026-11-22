// Theme system providing light and dark color palettes
// Used by ThemeContext to provide consistent styling across the app
// Supports user-selectable accent palettes layered on top of the base light/dark themes

// Accent palettes the user can pick from Settings → Appearance
// Each accent defines the brand colour for light and dark mode plus a two-stop hero gradient
export type AccentName = 'indigo' | 'emerald' | 'ocean' | 'sunset' | 'rose' | 'graphite';

export interface AccentPalette {
  name: AccentName; // Stable identifier persisted to storage
  label: string; // Human-readable name for the picker
  light: { primary: string; primaryLight: string; primaryDark: string; gradient: [string, string] };
  dark: { primary: string; primaryLight: string; primaryDark: string; gradient: [string, string] };
}

export const ACCENTS: AccentPalette[] = [
  {
    name: 'indigo',
    label: 'Indigo',
    light: { primary: '#5B5BF6', primaryLight: '#8183FA', primaryDark: '#4338CA', gradient: ['#6366F1', '#8B5CF6'] },
    dark: { primary: '#8B8CFB', primaryLight: '#A5A6FC', primaryDark: '#6366F1', gradient: ['#4F46E5', '#7C3AED'] },
  },
  {
    name: 'emerald',
    label: 'Emerald',
    light: { primary: '#059669', primaryLight: '#34D399', primaryDark: '#047857', gradient: ['#10B981', '#0D9488'] },
    dark: { primary: '#34D399', primaryLight: '#6EE7B7', primaryDark: '#10B981', gradient: ['#047857', '#0F766E'] },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    light: { primary: '#0284C7', primaryLight: '#38BDF8', primaryDark: '#0369A1', gradient: ['#0EA5E9', '#2563EB'] },
    dark: { primary: '#38BDF8', primaryLight: '#7DD3FC', primaryDark: '#0EA5E9', gradient: ['#0369A1', '#1D4ED8'] },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    light: { primary: '#EA580C', primaryLight: '#FB923C', primaryDark: '#C2410C', gradient: ['#F97316', '#E11D48'] },
    dark: { primary: '#FB923C', primaryLight: '#FDBA74', primaryDark: '#F97316', gradient: ['#C2410C', '#BE123C'] },
  },
  {
    name: 'rose',
    label: 'Rose',
    light: { primary: '#DB2777', primaryLight: '#F472B6', primaryDark: '#BE185D', gradient: ['#EC4899', '#A855F7'] },
    dark: { primary: '#F472B6', primaryLight: '#F9A8D4', primaryDark: '#EC4899', gradient: ['#BE185D', '#7E22CE'] },
  },
  {
    name: 'graphite',
    label: 'Graphite',
    light: { primary: '#334155', primaryLight: '#64748B', primaryDark: '#1E293B', gradient: ['#1E293B', '#475569'] },
    dark: { primary: '#64748B', primaryLight: '#CBD5E1', primaryDark: '#475569', gradient: ['#1E293B', '#334155'] },
  },
];

export const DEFAULT_ACCENT: AccentName = 'indigo';

// Light mode color palette for daytime use
export const lightTheme = {
  dark: false, // Indicates this is a light theme
  colors: {
    primary: '#5B5BF6', // Main brand/action color (overridden by accent)
    primaryLight: '#8183FA', // Lighter shade for backgrounds
    primaryDark: '#4338CA', // Darker shade for pressed states
    gradient: ['#6366F1', '#8B5CF6'] as [string, string], // Hero card gradient stops
    onPrimary: '#FFFFFF', // Text/icon colour drawn on top of the primary colour
    secondary: '#F43F5E', // Accent color for highlights
    background: '#F5F6FA', // Main screen background
    surface: '#FFFFFF', // Card and modal backgrounds
    surfaceVariant: '#EEF0F6', // Subtle surface differentiation
    surfaceElevated: '#FFFFFF', // Floating surfaces (tab bar, sheets)
    card: '#FFFFFF', // Card component background
    text: '#0F172A', // Primary text color
    textSecondary: '#64748B', // Secondary/muted text color
    textTertiary: '#94A3B8', // Tertiary/hint text color
    border: '#E6E8F0', // Border and divider color
    notification: '#F43F5E', // Badge and notification color
    error: '#EF4444', // Error/destructive action color
    success: '#10B981', // Success/positive color
    warning: '#F59E0B', // Warning/caution color
    info: '#3B82F6', // Informational color
    income: '#10B981', // Income/positive balance color
    expense: '#EF4444', // Expense/negative balance color
    shadow: 'rgba(15, 23, 42, 0.08)', // Shadow color for elevation
    overlay: 'rgba(15, 23, 42, 0.45)', // Modal overlay backdrop
    tabBar: '#FFFFFF', // Bottom tab bar background
    tabBarInactive: '#94A3B8', // Inactive tab icon color
    statusBar: 'dark' as 'dark' | 'light', // Status bar text style
    inputBackground: '#F1F3F8', // Text input background
    chipBackground: '#EEF0FF', // Chip/tag background color
    chipText: '#5B5BF6', // Chip/tag text color
  },
  spacing: {
    xs: 4, // Extra small spacing
    sm: 8, // Small spacing
    md: 16, // Medium spacing
    lg: 24, // Large spacing
    xl: 32, // Extra large spacing
    xxl: 48, // Double extra large spacing
  },
  borderRadius: {
    sm: 10, // Small radius for chips and small elements
    md: 14, // Medium radius for inputs and buttons
    lg: 20, // Large radius for cards
    xl: 28, // Extra large radius for hero cards and sheets
    full: 9999, // Fully rounded (circles)
  },
  typography: {
    h1: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36, letterSpacing: -0.5 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30, letterSpacing: -0.3 },
    h3: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
    h4: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  },
};

// Dark mode color palette for nighttime use
export const darkTheme = {
  ...lightTheme, // Inherit spacing, borderRadius, and typography
  dark: true, // Indicates this is a dark theme
  colors: {
    primary: '#8B8CFB', // Brighter primary for dark backgrounds
    primaryLight: '#A5A6FC', // Lighter variant
    primaryDark: '#6366F1', // Darker variant
    gradient: ['#4F46E5', '#7C3AED'] as [string, string], // Hero card gradient stops
    onPrimary: '#FFFFFF', // Text/icon colour drawn on top of the primary colour
    secondary: '#FB7185', // Brighter accent
    background: '#0B0D14', // Deep neutral background
    surface: '#151821', // Surface elevation level 1
    surfaceVariant: '#1C2030', // Surface elevation level 2
    surfaceElevated: '#1A1E2A', // Floating surfaces (tab bar, sheets)
    card: '#151821', // Card background
    text: '#F1F5F9', // Primary text on dark
    textSecondary: '#94A3B8', // Muted text
    textTertiary: '#64748B', // Hint text
    border: '#252A38', // Subtle borders on dark
    notification: '#FB7185', // Notification badge
    error: '#F87171', // Error color
    success: '#34D399', // Success color
    warning: '#FBBF24', // Warning color
    info: '#60A5FA', // Info color
    income: '#34D399', // Income highlight
    expense: '#F87171', // Expense highlight
    shadow: 'rgba(0, 0, 0, 0.45)', // Deeper shadow for dark
    overlay: 'rgba(0, 0, 0, 0.65)', // Darker overlay
    tabBar: '#151821', // Tab bar background
    tabBarInactive: '#64748B', // Inactive tab icon
    statusBar: 'light' as 'dark' | 'light', // Light status bar text
    inputBackground: '#1C2030', // Input background
    chipBackground: '#232842', // Chip background
    chipText: '#A5A6FC', // Chip text
  },
};

// Type export for the theme object used across the app
export type Theme = typeof lightTheme;

// Build a concrete theme by layering an accent palette on top of the base light/dark theme
export const buildTheme = (isDark: boolean, accentName: AccentName): Theme => {
  const base = isDark ? darkTheme : lightTheme;
  const accent = ACCENTS.find((a) => a.name === accentName) ?? ACCENTS[0];
  const tone = isDark ? accent.dark : accent.light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: tone.primary,
      primaryLight: tone.primaryLight,
      primaryDark: tone.primaryDark,
      gradient: tone.gradient,
      chipText: isDark ? tone.primaryLight : tone.primary,
      chipBackground: tone.primary + (isDark ? '26' : '14'),
    },
  };
};
