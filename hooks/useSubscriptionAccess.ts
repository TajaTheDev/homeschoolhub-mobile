/**
 * Subscription access helpers for UI gating (read-only vs full edit).
 */

import { useSubscriptionStore, type AccessLevel } from '@/store/subscriptionStore';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

/** Fallback action phrase when requireEdit() is called without a label. */
export const DEFAULT_EDIT_ACTION = 'add and edit lessons';

/** Builds the short action phrase shown in the subscribe nudge body. */
export function formatSubscribeNudgeAction(actionLabel?: string): string {
  return actionLabel?.trim() || DEFAULT_EDIT_ACTION;
}

export type SubscribeNudgeProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  onSubscribe: () => void;
};

export type UseSubscriptionAccessResult = {
  accessLevel: AccessLevel;
  canEnterApp: boolean;
  canEdit: boolean;
  /** Returns true when the caller may proceed with a mutating action. */
  requireEdit: (actionLabel?: string) => boolean;
  /** Props for {@link SubscribeToEditNudge} — render once on screens that call requireEdit. */
  subscribeNudgeProps: SubscribeNudgeProps;
};

/**
 * Reads access flags from the subscription store and provides requireEdit + shared nudge UI props.
 */
export function useSubscriptionAccess(): UseSubscriptionAccessResult {
  const router = useRouter();
  const subscriptionInfo = useSubscriptionStore((state) => state.subscriptionInfo);

  const accessLevel: AccessLevel = subscriptionInfo?.accessLevel ?? 'locked';
  const canEnterApp = subscriptionInfo?.canEnterApp ?? false;
  const canEdit = subscriptionInfo?.canEdit ?? false;

  const [nudgeVisible, setNudgeVisible] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState(DEFAULT_EDIT_ACTION);

  const requireEdit = useCallback(
    (actionLabel?: string): boolean => {
      if (canEdit) {
        return true;
      }
      setNudgeMessage(formatSubscribeNudgeAction(actionLabel));
      setNudgeVisible(true);
      return false;
    },
    [canEdit]
  );

  const dismissNudge = useCallback(() => {
    setNudgeVisible(false);
  }, []);

  const subscribeFromNudge = useCallback(() => {
    setNudgeVisible(false);
    router.push('/subscribe' as const);
  }, [router]);

  const subscribeNudgeProps = useMemo(
    (): SubscribeNudgeProps => ({
      visible: nudgeVisible,
      message: nudgeMessage,
      onDismiss: dismissNudge,
      onSubscribe: subscribeFromNudge,
    }),
    [dismissNudge, nudgeMessage, nudgeVisible, subscribeFromNudge]
  );

  return {
    accessLevel,
    canEnterApp,
    canEdit,
    requireEdit,
    subscribeNudgeProps,
  };
}
