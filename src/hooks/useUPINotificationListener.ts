// Custom hook to listen for UPI payment notifications in real-time
// Uses react-native-notification-listener to capture Android notifications
// Filters for UPI apps, parses payment data, and invokes a callback

import { useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import { UPINotification } from '../types';
import { parseUPINotification, isUPIApp } from '../utils/upiParser';
import * as Crypto from 'expo-crypto';

// Event name emitted by react-native-notification-listener when a notification arrives
const NOTIFICATION_EVENT = 'notificationReceived';

// Callback type for when a valid UPI payment notification is detected
type UPINotificationCallback = (notification: UPINotification) => void;

// Hook that listens for UPI payment notifications and returns parsed data
export const useUPINotificationListener = (
  onNotification: UPINotificationCallback,
  enabled: boolean = true
) => {
  // Use ref to always call the latest callback without re-subscribing
  const callbackRef = useRef<UPINotificationCallback>(onNotification);
  callbackRef.current = onNotification;

  // Handler for incoming notification events from the native listener service
  const handleNotification = useCallback((data: any) => {
    // Only process notifications from recognized UPI apps
    const packageName = data?.app || data?.packageName || '';
    if (!isUPIApp(packageName)) return;

    // Extract notification text from various possible fields
    const text = data?.text || data?.title || data?.body || '';
    if (!text) return;

    // Parse the notification text into structured payment data
    const parsed = parseUPINotification(packageName, text);

    // Only forward valid UPI payment notifications with amount and type
    if (parsed.isUPIPayment && parsed.amount !== null && parsed.transactionType !== null) {
      const notification: UPINotification = {
        id: Crypto.randomUUID(),
        appPackage: packageName,
        appName: parsed.appName,
        transactionType: parsed.transactionType,
        amount: parsed.amount,
        message: text,
        timestamp: new Date().toISOString(),
        isProcessed: false,
      };

      // Invoke the callback with the structured notification data
      callbackRef.current(notification);
    }
  }, []);

  useEffect(() => {
    // Only listen on Android (iOS doesn't support notification listener services)
    if (Platform.OS !== 'android' || !enabled) return;

    // Subscribe to notification events from the native module
    const subscription = DeviceEventEmitter.addListener(
      NOTIFICATION_EVENT,
      handleNotification
    );

    // Clean up subscription when the hook unmounts or is disabled
    return () => {
      subscription.remove();
    };
  }, [enabled, handleNotification]);
};
