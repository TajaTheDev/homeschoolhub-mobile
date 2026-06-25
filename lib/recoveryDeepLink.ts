import { supabase } from '@/lib/supabase/client';

export const PASSWORD_RECOVERY_REDIRECT = 'homeschoolhubmobile://reset-password';

/**
 * Returns true only for password-recovery deep links — not regular app opens.
 */
export function isRecoveryDeepLink(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.includes('reset-password');
}

/**
 * Parses query/hash parameters from a deep link URL.
 */
function parseUrlParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  let paramString = '';

  if (hashIndex !== -1) {
    paramString = url.substring(hashIndex + 1);
  } else if (queryIndex !== -1) {
    paramString = url.substring(queryIndex + 1);
  }

  const params: Record<string, string> = {};
  if (!paramString) {
    return params;
  }

  paramString.split('&').forEach((pair) => {
    const [rawKey, rawValue] = pair.split('=');
    if (!rawKey) {
      return;
    }
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue ?? '');
  });

  return params;
}

/**
 * Establishes a Supabase recovery session from a password-reset deep link.
 * Returns true when a session was set successfully.
 */
export async function establishSessionFromRecoveryUrl(url: string): Promise<boolean> {
  if (!supabase || !isRecoveryDeepLink(url)) {
    return false;
  }

  const params = parseUrlParams(url);

  if (params.error || params.error_description) {
    console.error('Recovery deep link error:', params.error, params.error_description);
    return false;
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Failed to set recovery session:', error);
      return false;
    }

    return true;
  }

  const authCode = params.code;
  if (authCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(authCode);
    if (error) {
      console.error('Failed to exchange recovery code:', error);
      return false;
    }
    return true;
  }

  return false;
}
