# Personal Expense Tracker

A modern, feature-rich personal expense tracker mobile application built with **React Native (Expo)** and an **offline-first architecture** using **SQLite**.

## Features

### Core
- **Expense CRUD** — Add, edit, delete expenses with categories, payment methods, notes, and tags
- **Wallet Management** — Monthly wallets with initial balance, auto-deduction on expense entry
- **Category Management** — 15 default categories + custom categories with icons and colors
- **Multi-Currency Support** — 10 currencies (INR, USD, EUR, GBP, JPY, CAD, AUD, CNY, SGD, AED)

### Analytics & Reports
- **Analytics Dashboard** — Pie chart, bar chart, line chart with time range filters
- **Category Breakdown** — See spending distribution by category
- **Daily/Weekly/Monthly Trends** — Visual spending trend analysis
- **Export Reports** — JSON, CSV, Excel (XML), and HTML/PDF formats with sharing

### Advanced
- **Recurring Expenses** — Auto-generate daily/weekly/biweekly/monthly/quarterly/yearly recurring entries
- **Budget Management** — Per-category monthly budget limits with progress bars
- **Budget Notifications** — Alerts when spending reaches 80% or exceeds budget limits
- **Search & Filter** — Full-text search across notes, categories, and tags

### Security & Backup
- **PIN Lock** — 4-6 digit PIN to protect the app
- **Biometric Authentication** — Fingerprint/Face ID support
- **Cloud Backup** — Local backup/restore with export of all data
- **Auto Backup** — Toggle for automatic data backup

### UI/UX
- **Light/Dark Mode** — Automatic (system) + manual toggle
- **Modern Material Design** — Clean UI with react-native-paper and MaterialCommunityIcons
- **Pull-to-Refresh** — Refresh data on all list screens
- **Smooth Navigation** — Bottom tabs (5 tabs) + stack navigation for detail views

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 55, React Native 0.83, React 19 |
| Database | expo-sqlite (WAL mode) |
| State | Zustand 5 |
| Navigation | @react-navigation 7 (bottom-tabs + stack) |
| UI | react-native-paper, MaterialCommunityIcons |
| Charts | react-native-chart-kit, react-native-svg |
| Dates | date-fns 4 |
| Export | expo-file-system, expo-sharing |
| Security | expo-local-authentication, expo-secure-store |
| Notifications | expo-notifications |
| Storage | @react-native-async-storage |

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── common/         # Card, Button, EmptyState
│   └── PinLockScreen   # Security gate for app lock
├── constants/          # App constants, default categories, currencies
├── database/           # SQLite database service (CRUD operations)
├── navigation/         # React Navigation config (tabs + stack)
├── screens/            # 15 app screens
├── services/           # Background services (recurring, notifications)
├── store/              # Zustand state management
├── theme/              # Light/dark theme system
├── types/              # TypeScript type definitions
└── utils/              # Helpers, formatters, export service
```

## Getting Started

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```
