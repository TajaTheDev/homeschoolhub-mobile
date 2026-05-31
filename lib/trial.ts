/**
 * Trial management service
 * Handles free trial tracking via Supabase with local AsyncStorage fallback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInDays } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import type { SubscriptionPlan, TrialStatus, UserTrial } from '@/types/database';

export const TRIAL_DURATION_DAYS = 30;
const LEGACY_TRIAL_STORAGE_KEY = 'trial_start_date';
const LOCAL_TRIAL_KEY_PREFIX = 'local_user_trial_';

export interface TrialInfo {
  trial: UserTrial;
  daysRemaining: number;
  isActive: boolean;
  isExpired: boolean;
  isConverted: boolean;
}

/**
 * Returns true when Supabase trial RPC/table is unavailable.
 */
function isTrialSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === 'PGRST202' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.includes('ensure_user_trial') === true ||
    error.message?.includes('user_trials') === true
  );
}

/**
 * Calculates days remaining in a trial from the expiration date.
 */
export function getDaysRemaining(expiresAt: string | Date): number {
  const expiration = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const daysUntilExpiration = differenceInDays(expiration, new Date());
  return Math.max(0, daysUntilExpiration);
}

/**
 * Derives trial access state from a trial record.
 */
export function getTrialInfo(trial: UserTrial): TrialInfo {
  const daysRemaining = getDaysRemaining(trial.expires_at);
  const isConverted = trial.status === 'converted';
  const isExpired = trial.status === 'expired' || (trial.status === 'active' && daysRemaining === 0);
  const isActive = trial.status === 'active' && daysRemaining > 0;

  return {
    trial,
    daysRemaining,
    isActive,
    isExpired,
    isConverted,
  };
}

/**
 * Builds an in-memory trial record from a start date.
 */
function buildTrialRecord(
  userId: string,
  startedAt: Date,
  durationDays: number,
  status?: TrialStatus
): UserTrial {
  const expiresAt = new Date(startedAt);
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const daysRemaining = getDaysRemaining(expiresAt);
  const resolvedStatus: TrialStatus =
    status ?? (daysRemaining > 0 ? 'active' : 'expired');

  return {
    id: 'local',
    user_id: userId,
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    duration_days: durationDays,
    status: resolvedStatus,
    converted_at: null,
    subscription_plan: null,
    created_at: startedAt.toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Reads legacy AsyncStorage trial start date if present.
 */
async function getLegacyTrialStartDate(): Promise<Date | null> {
  const legacyStart = await AsyncStorage.getItem(LEGACY_TRIAL_STORAGE_KEY);
  if (!legacyStart) {
    return null;
  }

  const legacyStartDate = new Date(legacyStart);
  if (Number.isNaN(legacyStartDate.getTime())) {
    await AsyncStorage.removeItem(LEGACY_TRIAL_STORAGE_KEY);
    return null;
  }

  return legacyStartDate;
}

/**
 * Ensures trial data exists in AsyncStorage when Supabase migration is missing.
 */
async function ensureLocalUserTrial(
  userId: string,
  legacyStartDate: Date | null
): Promise<TrialInfo> {
  const storageKey = `${LOCAL_TRIAL_KEY_PREFIX}${userId}`;
  const stored = await AsyncStorage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { started_at: string; status?: TrialStatus };
      const startedAt = new Date(parsed.started_at);
      if (!Number.isNaN(startedAt.getTime())) {
        return getTrialInfo(
          buildTrialRecord(userId, startedAt, TRIAL_DURATION_DAYS, parsed.status)
        );
      }
    } catch {
      await AsyncStorage.removeItem(storageKey);
    }
  }

  const startedAt = legacyStartDate ?? new Date();
  const trial = buildTrialRecord(userId, startedAt, TRIAL_DURATION_DAYS);

  await AsyncStorage.setItem(
    storageKey,
    JSON.stringify({ started_at: trial.started_at, status: trial.status })
  );

  if (legacyStartDate) {
    await AsyncStorage.removeItem(LEGACY_TRIAL_STORAGE_KEY);
  }

  console.warn('⚠️ Using local trial fallback — apply user_trials migration in Supabase');
  return getTrialInfo(trial);
}

/**
 * Expires an active trial record if past its end date.
 */
function expireTrialIfNeeded(trial: UserTrial): UserTrial {
  if (trial.status !== 'active') {
    return trial;
  }

  if (getDaysRemaining(trial.expires_at) > 0) {
    return trial;
  }

  return {
    ...trial,
    status: 'expired',
    updated_at: new Date().toISOString(),
  };
}

/**
 * Ensures the authenticated user has a trial record and returns current trial info.
 */
export async function ensureUserTrial(): Promise<TrialInfo | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const legacyStartDate = await getLegacyTrialStartDate();

  const { data, error } = await supabase.rpc('ensure_user_trial', {
    p_duration_days: TRIAL_DURATION_DAYS,
    p_started_at: legacyStartDate?.toISOString() ?? null,
  });

  if (error) {
    if (isTrialSchemaMissing(error)) {
      return ensureLocalUserTrial(user.id, legacyStartDate);
    }

    console.error('Error ensuring user trial:', error);
    return ensureLocalUserTrial(user.id, legacyStartDate);
  }

  if (legacyStartDate) {
    await AsyncStorage.removeItem(LEGACY_TRIAL_STORAGE_KEY);
  }

  return getTrialInfo(expireTrialIfNeeded(data as UserTrial));
}

/**
 * Fetches the current user's trial record without creating one.
 */
export async function getUserTrial(): Promise<TrialInfo | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_trials')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (isTrialSchemaMissing(error)) {
      return ensureLocalUserTrial(user.id, await getLegacyTrialStartDate());
    }

    console.error('Error fetching user trial:', error);
    return null;
  }

  if (!data) {
    return ensureUserTrial();
  }

  return getTrialInfo(expireTrialIfNeeded(data as UserTrial));
}

/**
 * Marks the user's trial as converted after subscribing.
 */
export async function convertUserTrial(plan?: SubscriptionPlan): Promise<TrialInfo | null> {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.rpc('convert_user_trial', {
    p_plan: plan ?? null,
  });

  if (error) {
    if (isTrialSchemaMissing(error)) {
      const storageKey = `${LOCAL_TRIAL_KEY_PREFIX}${user.id}`;
      const stored = await AsyncStorage.getItem(storageKey);
      const startedAt = stored
        ? new Date(JSON.parse(stored).started_at)
        : new Date();

      const convertedTrial = buildTrialRecord(user.id, startedAt, TRIAL_DURATION_DAYS, 'converted');
      convertedTrial.converted_at = new Date().toISOString();
      convertedTrial.subscription_plan = plan ?? null;

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          started_at: convertedTrial.started_at,
          status: 'converted',
          subscription_plan: plan ?? null,
        })
      );

      return getTrialInfo(convertedTrial);
    }

    console.error('Error converting user trial:', error);
    return null;
  }

  return getTrialInfo(data as UserTrial);
}
