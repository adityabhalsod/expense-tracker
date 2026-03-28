// Onboarding walkthrough screen — shown on first app launch
// Horizontal pager with feature highlights, skip option, and "Get Started" CTA

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import { useLanguage } from '../i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = '@onboarding_completed';

// Onboarding step configuration — icon, color, and translation keys
const STEPS = [
  { id: '1', icon: 'wallet', color: '#6C63FF' },
  { id: '2', icon: 'chart-arc', color: '#10B981' },
  { id: '3', icon: 'piggy-bank', color: '#F59E0B' },
  { id: '4', icon: 'shield-check', color: '#3B82F6' },
];

const OnboardingScreen = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Map step IDs to translated title/description using i18n keys
  const translatedSteps = STEPS.map((step, i) => ({
    ...step,
    title: [t.onboarding.welcome, t.onboarding.trackExpenses, t.onboarding.multiWallet, t.onboarding.analytics][i],
    description: [t.onboarding.welcomeDesc, t.onboarding.trackExpensesDesc, t.onboarding.multiWalletDesc, t.onboarding.analyticsDesc][i],
  }));

  // Mark onboarding as completed in persistent storage and navigate to main app
  const completeOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  // Advance to next step or finish if on last step
  const handleNext = () => {
    if (currentIndex < STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  // Track current visible page via scroll position
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  // Render a single onboarding step with large icon and text
  const renderStep = ({ item }: { item: typeof translatedSteps[0] }) => (
    <View style={[styles.step, { width: SCREEN_WIDTH }]}>
      {/* Large circular icon background */}
      <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <MaterialCommunityIcons name={item.icon as any} size={80} color={item.color} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{item.description}</Text>
    </View>
  );

  const isLastStep = currentIndex === STEPS.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Skip button — visible on all steps except the last */}
      {!isLastStep && (
        <TouchableOpacity style={styles.skipBtn} onPress={completeOnboarding}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>{t.onboarding.skip}</Text>
        </TouchableOpacity>
      )}

      {/* Horizontal pager — snap to each step */}
      <FlatList
        ref={flatListRef}
        data={translatedSteps}
        renderItem={renderStep}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Pagination dots and action button */}
      <View style={styles.footer}>
        {/* Page indicator dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentIndex ? theme.colors.primary : theme.colors.border },
                i === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Next/Get Started button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: theme.colors.primary }]}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>
            {isLastStep ? t.onboarding.getStarted : t.onboarding.next}
          </Text>
          {!isLastStep && <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  skipText: { fontSize: 15, fontWeight: '600' },
  step: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconContainer: { width: 160, height: 160, borderRadius: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: 24, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: '100%', gap: 8,
  },
  nextText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});

export default OnboardingScreen;
