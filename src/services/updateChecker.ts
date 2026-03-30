// Service to check for new app versions via GitHub Releases API
// Shows a one-time alert per version when an update is available

import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// GitHub repository coordinates for the release check
const GITHUB_OWNER = 'adityabhalsod';
const GITHUB_REPO = 'expense-tracker';

// AsyncStorage key to persist the last dismissed version — prevents repeated alerts
const DISMISSED_VERSION_KEY = '@dismissed_update_version';

// GitHub release API endpoint — fetches only the latest published release
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Compare two semver strings (e.g. "1.3.0" vs "1.4.0")
// Returns true if remote is strictly newer than local
function isNewerVersion(local: string, remote: string): boolean {
  // Split into numeric parts for accurate comparison
  const localParts = local.split('.').map(Number);
  const remoteParts = remote.split('.').map(Number);

  // Walk through major, minor, patch segments
  for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
    const l = localParts[i] || 0; // Default missing segments to 0
    const r = remoteParts[i] || 0;
    if (r > l) return true; // Remote segment is larger — newer version
    if (r < l) return false; // Remote segment is smaller — older version
  }
  // All segments equal — same version
  return false;
}

// Fetch the latest release tag from GitHub, compare with local version,
// and show an alert if a newer version is available (once per version)
export async function checkForUpdate(translations: {
  title: string;
  message: string;
  update: string;
  later: string;
}): Promise<void> {
  try {
    // Read the current app version from Expo constants (sourced from app.json)
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

    // Fetch the latest release metadata from GitHub
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    // Bail silently if the API request fails (no network, rate-limited, etc.)
    if (!response.ok) return;

    const release = await response.json();

    // Strip the leading "v" from tag names like "v1.4.0"
    const latestVersion = (release.tag_name ?? '').replace(/^v/, '');

    // Skip if the tag couldn't be parsed or isn't newer
    if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) return;

    // Check if the user already dismissed this specific version
    const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
    if (dismissedVersion === latestVersion) return;

    // Build the direct download URL for the APK asset (if attached to the release)
    const apkAsset = release.assets?.find((a: { name: string }) => a.name?.endsWith('.apk'));
    // Fall back to the release page if no APK asset is found
    const downloadUrl = apkAsset?.browser_download_url ?? release.html_url;

    // Show a non-blocking alert with Update / Later options
    Alert.alert(translations.title, translations.message.replace('{version}', latestVersion), [
      {
        text: translations.later,
        style: 'cancel',
        // Persist the dismissed version so we don't nag again for this release
        onPress: () => AsyncStorage.setItem(DISMISSED_VERSION_KEY, latestVersion),
      },
      {
        text: translations.update,
        // Open the APK download link or release page in the browser
        onPress: () => Linking.openURL(downloadUrl),
      },
    ]);
  } catch {
    // Silently ignore — update check is non-critical
  }
}

// Manual version check triggered from Settings — always shows user feedback
// Unlike the automatic check, this never skips silently
export async function manualCheckForUpdate(translations: {
  title: string;
  message: string;
  update: string;
  later: string;
  upToDate: string;
  upToDateMessage: string;
  checkFailed: string;
}): Promise<void> {
  try {
    // Read the current app version from Expo constants
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

    // Fetch the latest release from GitHub
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    // Show error feedback if the API call fails
    if (!response.ok) {
      Alert.alert(translations.checkFailed);
      return;
    }

    const release = await response.json();

    // Strip leading "v" from tag (e.g. "v1.4.0" → "1.4.0")
    const latestVersion = (release.tag_name ?? '').replace(/^v/, '');

    // If no newer version exists, tell the user they're up to date
    if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) {
      Alert.alert(translations.upToDate, translations.upToDateMessage.replace('{version}', currentVersion));
      return;
    }

    // Build APK download URL or fall back to release page
    const apkAsset = release.assets?.find((a: { name: string }) => a.name?.endsWith('.apk'));
    const downloadUrl = apkAsset?.browser_download_url ?? release.html_url;

    // Show update alert with download option
    Alert.alert(translations.title, translations.message.replace('{version}', latestVersion), [
      { text: translations.later, style: 'cancel' },
      {
        text: translations.update,
        onPress: () => Linking.openURL(downloadUrl),
      },
    ]);
  } catch {
    // Show error feedback for manual checks — user expects a response
    Alert.alert(translations.checkFailed);
  }
}
