import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, logout as requestLogout } from '@/lib/api';

interface UseLogoutOptions {
  onAuthRequired?: () => void;
}

/** A failed request must not imply that the server-side session has ended. */
export function useLogout({ onAuthRequired }: UseLogoutOptions = {}) {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const clearError = useCallback(() => setFailed(false), []);

  // Always resolves, so event handlers may safely call this without awaiting it.
  const logout = useCallback(async (): Promise<boolean> => {
    // State alone cannot guard two submissions in the same render/event turn.
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setLoggingOut(true);
    setFailed(false);
    try {
      try {
        await requestLogout();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          setFailed(true);
          return false;
        }
        // A 401 confirms that the session is already invalid.
      }

      try {
        await onAuthRequired?.();
      } catch {
        // Logout is confirmed; a notification callback must not reject the action.
      }
      return true;
    } finally {
      pendingRef.current = false;
      setLoggingOut(false);
    }
  }, [onAuthRequired]);

  return { logout, loggingOut, error: failed ? t('auth.logout_failed') : null, clearError };
}
