import { getItem, setItem, deleteItem, STORAGE_KEYS } from './storage';

/**
 * Checks if the user has already seen and completed or dismissed the app tour.
 */
export async function isAppTourCompleted(): Promise<boolean> {
  try {
    const raw = await getItem(STORAGE_KEYS.APP_TOUR_COMPLETED);
    return raw === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the tour as completed so it does not auto-open on future launches.
 */
export async function markAppTourCompleted(): Promise<void> {
  try {
    await setItem(STORAGE_KEYS.APP_TOUR_COMPLETED, 'true');
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Resets the tour state so it can be re-tested or re-run on demand.
 */
export async function resetAppTourState(): Promise<void> {
  try {
    await deleteItem(STORAGE_KEYS.APP_TOUR_COMPLETED);
  } catch {
    // Non-blocking fallback
  }
}

