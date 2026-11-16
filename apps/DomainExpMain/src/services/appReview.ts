import * as StoreReview from 'expo-store-review';
import { Platform, Linking } from 'react-native';
import { getItem, setItem, STORAGE_KEYS } from './storage';

// Trigger review popup after exactly 2 minutes (120 seconds) of active app usage
export const REVIEW_THRESHOLD_SECONDS = 120;

export interface AppReviewState {
  totalUsageSeconds: number;
  hasReviewed: boolean;
  neverAskAgain: boolean;
  snoozedUntil: number | null;
  lastPromptedAt: number | null;
}

const DEFAULT_REVIEW_STATE: AppReviewState = {
  totalUsageSeconds: 0,
  hasReviewed: false,
  neverAskAgain: false,
  snoozedUntil: null,
  lastPromptedAt: null,
};

export const APP_PACKAGE_ID = 'com.domainpulse.mobile';
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE_ID}`;
export const PLAY_STORE_MARKET_URL = `market://details?id=${APP_PACKAGE_ID}&showAllReviews=true`;
export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_PACKAGE_ID}?action=write-review`;

/**
 * Retrieves the persisted review state.
 */
export async function getAppReviewState(): Promise<AppReviewState> {
  try {
    const raw = await getItem(STORAGE_KEYS.APP_REVIEW_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_REVIEW_STATE,
        ...parsed,
      };
    }
  } catch {}
  return DEFAULT_REVIEW_STATE;
}

/**
 * Saves review state to persistent storage.
 */
export async function saveAppReviewState(state: AppReviewState): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.APP_REVIEW_STATE, JSON.stringify(state));
  } catch {}
}

/**
 * Determines whether the user is eligible to see the review popup.
 */
export function shouldShowReviewPrompt(state: AppReviewState): boolean {
  if (state.hasReviewed || state.neverAskAgain) {
    return false;
  }
  if (state.snoozedUntil && Date.now() < state.snoozedUntil) {
    return false;
  }
  return (state.totalUsageSeconds || 0) >= REVIEW_THRESHOLD_SECONDS;
}

/**
 * Adds active foreground usage seconds and checks if prompt should trigger.
 */
export async function addAppUsageSeconds(
  seconds: number,
): Promise<{ state: AppReviewState; shouldPrompt: boolean }> {
  const current = await getAppReviewState();

  if (current.hasReviewed || current.neverAskAgain) {
    return { state: current, shouldPrompt: false };
  }

  const updated: AppReviewState = {
    ...current,
    totalUsageSeconds: (current.totalUsageSeconds || 0) + seconds,
  };

  await saveAppReviewState(updated);
  const shouldPrompt = shouldShowReviewPrompt(updated);

  return { state: updated, shouldPrompt };
}

/**
 * Marks that user completed rating/review.
 */
export async function markAppReviewed(): Promise<void> {
  const current = await getAppReviewState();
  await saveAppReviewState({
    ...current,
    hasReviewed: true,
    lastPromptedAt: Date.now(),
  });
}

/**
 * Marks that user explicitly declined to be asked again.
 */
export async function markNeverAskAgain(): Promise<void> {
  const current = await getAppReviewState();
  await saveAppReviewState({
    ...current,
    neverAskAgain: true,
    lastPromptedAt: Date.now(),
  });
}

/**
 * Snoozes the review prompt for a specified number of hours (default: 24h).
 */
export async function snoozeReviewPrompt(hours: number = 24): Promise<void> {
  const current = await getAppReviewState();
  await saveAppReviewState({
    ...current,
    snoozedUntil: Date.now() + hours * 60 * 60 * 1000,
    lastPromptedAt: Date.now(),
  });
}

/**
 * Triggers the official Google Play In-App Review dialog (or App Store review on iOS).
 * When Google Play's in-app review sheet opens, the user submits their rating directly
 * into Google Play Store without leaving the app.
 * If native dialog is not supported on the device, it falls back to the Play Store review URL.
 */
export async function triggerOfficialStoreReview(): Promise<void> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    const hasAction = await StoreReview.hasAction();

    if (isAvailable && hasAction) {
      await StoreReview.requestReview();
      await markAppReviewed();
      return;
    }
  } catch (err) {
    console.warn('StoreReview.requestReview fallback:', err);
  }

  // Fallback to opening Google Play Store app directly to the reviews section
  await openStoreReviewUrl();
  await markAppReviewed();
}

/**
 * Opens Google Play Store / App Store app directly to the review section.
 */
export async function openStoreReviewUrl(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      const canOpen = await Linking.canOpenURL(PLAY_STORE_MARKET_URL);
      if (canOpen) {
        await Linking.openURL(PLAY_STORE_MARKET_URL);
        return;
      }
    } catch {}
    await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
  } else if (Platform.OS === 'ios') {
    await Linking.openURL(APP_STORE_URL).catch(() => {});
  } else {
    await Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
  }
}

/**
 * Resets the review state (useful for developer testing or debugging).
 */
export async function resetAppReviewState(): Promise<void> {
  await saveAppReviewState(DEFAULT_REVIEW_STATE);
}
