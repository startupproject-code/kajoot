export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const LAST_ACTIVITY_STORAGE_KEY = 'quizarena_moderator_last_activity_ms';

export function isSessionExpired(
  lastActivityMs: number | null | undefined,
  nowMs = Date.now(),
  timeoutMs = INACTIVITY_TIMEOUT_MS
): boolean {
  if (typeof lastActivityMs !== 'number' || !Number.isFinite(lastActivityMs) || lastActivityMs <= 0) {
    return false;
  }
  return nowMs - lastActivityMs >= timeoutMs;
}

export function readLastActivityMs(): number | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLastActivityMs(timestampMs = Date.now()): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestampMs));
  } catch {
    // ignore storage errors
  }
}

export function clearLastActivityMs(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
