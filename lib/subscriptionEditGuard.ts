/**
 * Store-level safety net for read-only subscription access (no UI).
 */

import { useSubscriptionStore } from '@/store/subscriptionStore';

/** Stable error string for callers that surface store results. */
export const SUBSCRIPTION_EDIT_BLOCKED_ERROR = 'Subscribe to add and edit.';

/**
 * Whether the current user may perform mutating operations.
 */
export function canMutateSubscriptionData(): boolean {
  return useSubscriptionStore.getState().subscriptionInfo?.canEdit ?? false;
}

/**
 * Standard failed result for guarded async store actions.
 */
export function subscriptionEditBlockedResult(): { success: false; error: string } {
  return { success: false, error: SUBSCRIPTION_EDIT_BLOCKED_ERROR };
}
