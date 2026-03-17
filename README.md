<p align="center">
  <img src="assets/icon.png" alt="Expense Tracker" width="100" height="100" />
</p>

<h1 align="center">Expense Tracker</h1>

<p align="center">
  <strong>A beautiful, offline-first personal finance app built with React Native & Expo</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-SDK_55-4630EB?logo=expo&logoColor=white" alt="Expo SDK 55" />
  <img src="https://img.shields.io/badge/React_Native-0.83-61DAFB?logo=react&logoColor=black" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-Android_|_iOS-green" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
  <a href="https://github.com/adityabhalsod/expense-tracker/actions/workflows/android-release.yml"><img src="https://github.com/adityabhalsod/expense-tracker/actions/workflows/android-release.yml/badge.svg" alt="Android Release" /></a>
  <a href="https://github.com/adityabhalsod/expense-tracker/releases/latest"><img src="https://img.shields.io/github/v/release/adityabhalsod/expense-tracker?include_prereleases&label=Latest%20Release" alt="Latest Release" /></a>
</p>

---

## What is Expense Tracker?

Expense Tracker helps you take control of your money. Track every rupee, dollar, or euro you spend — all from your phone, no internet required.

- **No account needed** — your data stays on your device
- **Works offline** — powered by a local SQLite database
- **Fast & lightweight** — optimized for smooth performance on any device

---

## Features

| | Feature | Description |
|---|---|---|
| 💰 | **Expense Tracking** | Add, edit, and delete expenses with categories, payment methods, notes, and tags |
| 👛 | **Monthly Wallets** | Set a starting balance each month — expenses auto-deduct in real time |
| 📊 | **Analytics Dashboard** | Pie charts, bar charts, and line charts to visualize spending patterns |
| 🏷️ | **15+ Categories** | Pre-loaded categories + create your own with custom icons and colors |
| 💱 | **Multi-Currency** | Supports 10 currencies — INR, USD, EUR, GBP, JPY, CAD, AUD, CNY, SGD, AED |
| 🔄 | **Recurring Expenses** | Auto-generate daily, weekly, biweekly, monthly, quarterly, or yearly entries |
| 🎯 | **Budgets** | Set per-category monthly limits with visual progress bars |
| 🔔 | **Budget Alerts** | Get notified at 80% and 100% of your budget limits |
| 🔍 | **Search** | Full-text search across notes, categories, and tags |
| 📤 | **Export Reports** | Export to JSON, CSV, Excel (XML), or HTML/PDF and share instantly |
| 🔒 | **PIN & Biometric Lock** | Protect your data with a 4–6 digit PIN or fingerprint/Face ID |
| 🌙 | **Dark Mode** | Automatic (follows system) or manual toggle |
| 🌐 | **Multi-Language** | English, हिन्दी (Hindi), ગુજરાતી (Gujarati) |
| 📱 | **UPI Detection** | Auto-detects UPI payment notifications (GPay, PhonePe, Paytm, etc.) and shows a popup to save as expense or income |
| 🏦 | **Payment Sources** | Manage bank accounts, UPI IDs, digital wallets, and credit cards — sensitive data encrypted at rest |
| 🔐 | **End-to-End Encryption** | AES-256-GCM encryption with PBKDF2 key derivation, hardware-backed key storage via Secure Store |

---

## Screenshots

### Light Mode

| Home | Expenses | Analytics | Wallet | Settings |
|------|----------|-----------|--------|----------|
| <img src="screenshots/light/light_home.jpg" width="160" /> | <img src="screenshots/light/light_expenses.jpg" width="160" /> | <img src="screenshots/light/light_analytics.jpg" width="160" /> | <img src="screenshots/light/light_wallet.jpg" width="160" /> | <img src="screenshots/light/light_settings.jpg" width="160" /> |

### Dark Mode

| Home | Expenses | Analytics | Wallet | Settings |
|------|----------|-----------|--------|----------|
| <img src="screenshots/dark/dark_home.jpg" width="160" /> | <img src="screenshots/dark/dark_expenses.jpg" width="160" /> | <img src="screenshots/dark/dark_analytics.jpg" width="160" /> | <img src="screenshots/dark/dark_wallet.jpg" width="160" /> | <img src="screenshots/dark/dark_settings.jpg" width="160" /> |

---

## Getting Started

### Prerequisites

- **Node.js** 18 or later — [Download](https://nodejs.org/)
- **Expo CLI** — installed automatically via `npx`
- **Android Studio** (for Android) or **Xcode** (for iOS)
- **Android SDK** with `ANDROID_HOME` set (see [Android setup](#android-setup) below)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/adityabhalsod/expense-tracker.git
cd expense-tracker

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

### Android Setup

Before building for Android, the SDK location must be configured. Do **one** of the following:

**Option A — Set environment variable (recommended, permanent):**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$PATH"

# Reload your shell
source ~/.bashrc
```

**Option B — Create `local.properties` (per-project):**
```bash
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties
```

> **Note:** `android/local.properties` is git-ignored (machine-specific). Each developer needs to create it once.

### Running on a Device

```bash
# Android (requires Android Studio or connected device)
npx expo run:android

# iOS (requires Xcode on macOS)
npx expo run:ios

# Scan QR code with Expo Go app for quick preview
npx expo start
```

### Building for Production

Always clear all caches before a production build to ensure fresh assets and code:

```bash
# 1. expo prebuild for android.
npx expo prebuild --platform android --no-install

# 2. Clear all caches (Metro, Gradle, node_modules cache)
rm -rf android/app/build android/.gradle/build-cache node_modules/.cache /tmp/metro-* /tmp/haste-map-*
cd android && ./gradlew clean && cd ..

# 3. Build release APK for Android
cd android && ANDROID_HOME=$HOME/Android/Sdk ./gradlew app:assembleRelease -x lint -x test --configure-on-demand --build-cache
```

The release APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

**iOS release build:**
```bash
npx expo run:ios --configuration Release
```

> **First build note:** The initial release build compiles native C++ modules (reanimated, gesture-handler) and can take **10–15 minutes**. Subsequent builds use the Gradle cache and are much faster.

### CI/CD — Automated Releases

Pushing to specific branches triggers a GitHub Actions pipeline that builds a clean APK and publishes a GitHub Release automatically:

| Branch | Channel | Version Example | Pre-release |
|--------|---------|-----------------|-------------|
| `main` | **Stable** | `v1.0.0` | No |
| `beta` | **Beta** | `v1.0.0-beta.3` | Yes |
| `alpha` | **Alpha** | `v1.0.0-alpha.7` | Yes |

**What the pipeline does:**
1. Reads the base version from `app.json` → `expo.version`
2. Appends `-alpha.N` or `-beta.N` suffix based on the branch (commit count since last tag)
3. Cleans all Gradle caches and builds a fresh release APK (`--no-build-cache`)
4. Generates a categorized changelog from commit messages (features, fixes, performance, etc.)
5. Creates a Git tag, publishes a GitHub Release, and uploads the versioned APK as a downloadable asset

**Download releases:** [GitHub Releases →](https://github.com/adityabhalsod/expense-tracker/releases)

> **Tip:** Use [conventional commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `perf:`) so the changelog is categorized automatically.

> **Skip CI:** Add `[skip ci]` or `[ci skip]` anywhere in your commit message or PR title to skip the release pipeline for that push.
> ```bash
> git commit -m "docs: update readme [skip ci]"
> ```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Expo SDK 55, React Native 0.83, React 19 | Cross-platform mobile runtime |
| **Language** | TypeScript 5.9 | Type-safe development |
| **Database** | expo-sqlite (WAL mode) | Fast local storage, offline-first |
| **State** | Zustand 5 | Lightweight reactive state management |
| **Navigation** | React Navigation 7 | Bottom tabs + native stack transitions |
| **UI** | react-native-paper, MaterialCommunityIcons | Material Design components |
| **Charts** | react-native-chart-kit, react-native-svg | Data visualization |
| **Dates** | date-fns 4 | Date formatting and range calculations |
| **Export** | expo-file-system, expo-sharing | File generation and sharing |
| **Security** | expo-local-authentication, expo-secure-store | Biometrics and encrypted storage |
| **Encryption** | SubtleCrypto (Web Crypto API), expo-crypto | AES-256-GCM + PBKDF2 key derivation |
| **Notifications** | expo-notifications | Budget alert push notifications |

---

## Project Structure

```
expense-tracker/
├── App.tsx                  # Root component with providers
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          #   Card, Button, EmptyState
│   │   └── PinLockScreen    #   Security lock gate
│   ├── constants/           # App constants, default categories, currencies
│   ├── database/            # SQLite service (all CRUD operations)
│   ├── i18n/                # Translations (en, hi, gu) + LanguageProvider
│   ├── navigation/          # Tab navigator + stack screens
│   ├── screens/             # 17 app screens
│   │   ├── HomeScreen       #   Dashboard with wallet summary
│   │   ├── ExpensesScreen   #   Filtered expense list
│   │   ├── AnalyticsScreen  #   Charts and insights
│   │   ├── WalletScreen     #   Balance and history
│   │   ├── SettingsScreen   #   Theme, language, security
│   │   ├── PaymentSources   #   Bank accounts & payment methods
│   │   ├── UPIPayments      #   UPI notification history
│   │   └── ...              #   Add, Detail, Search, Export, Budget, etc.
│   ├── hooks/               # Custom hooks (UPI listener, etc.)
│   ├── services/            # Recurring expenses, notifications
│   ├── store/               # Zustand global state
│   ├── theme/               # Light & dark theme definitions
│   ├── types/               # TypeScript interfaces
│   └── utils/               # Formatters, helpers, export service
├── android/                 # Native Android project
└── assets/                  # App icons and images
```

---

## Multi-Language Support

The app supports **3 languages** out of the box. Change the language anytime from **Settings > Language**.

| Language | Code | Status |
|----------|------|--------|
| English | `en` | ✅ Complete |
| हिन्दी (Hindi) | `hi` | ✅ Complete |
| ગુજરાતી (Gujarati) | `gu` | ✅ Complete |

Translation files are in `src/i18n/`. To add a new language, create a new translation file and register it in `src/i18n/index.tsx`.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/adityabhalsod">Aditya Bhalsod</a>
</p>
