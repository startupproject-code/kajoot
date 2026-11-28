export const TIMER_BOUNDARY_SAFETY_MS = 12;
export const TIMER_MAX_TICK_INTERVAL_MS = 500;
export const MAX_CLOCK_PROBE_RTT_MS = 10_000;

export interface WriteWindow {
  startLocalMs: number;
  endLocalMs: number | null;
}

export interface SnapshotSyncMetadata {
  fromCache?: boolean;
  hasPendingWrites?: boolean;
}

/**
 * Tracks the offset between Firestore server time and local device Date.now()
 * using bounded write-roundtrip windows so that Moderator and Player devices
 * share a synchronized server timebase even when device clocks differ.
 */
export class ServerClockTracker {
  private offsetMs = 0;
  private bestRttMs = Number.POSITIVE_INFINITY;
  private calibrated = false;
  private readonly writeWindows = new Map<string, WriteWindow>();

  hasCalibrated(): boolean {
    return this.calibrated;
  }

  getOffsetMs(): number {
    return this.offsetMs;
  }

  getBestRttMs(): number {
    return this.bestRttMs;
  }

  getEstimatedServerNowMs(localNowMs = Date.now()): number {
    return localNowMs + this.offsetMs;
  }

  beginWrite(channel: string, localNowMs = Date.now()): void {
    this.writeWindows.set(channel, {
      startLocalMs: localNowMs,
      endLocalMs: null,
    });
  }

  finishWrite(channel: string, localNowMs = Date.now()): void {
    const existing = this.writeWindows.get(channel);
    if (!existing) return;
    existing.endLocalMs = localNowMs;
  }

  recordConfirmedTimestamp(
    channel: string,
    serverTimestampMs: number | null | undefined,
    metadata: SnapshotSyncMetadata = {},
    localNowMs = Date.now()
  ): boolean {
    if (
      typeof serverTimestampMs !== 'number' ||
      !Number.isFinite(serverTimestampMs) ||
      metadata.hasPendingWrites ||
      metadata.fromCache
    ) {
      return false;
    }

    const window = this.writeWindows.get(channel);
    if (!window) {
      return false;
    }

    const endLocalMs = window.endLocalMs ?? localNowMs;
    const rttMs = Math.max(0, endLocalMs - window.startLocalMs);
    this.writeWindows.delete(channel);

    if (rttMs > MAX_CLOCK_PROBE_RTT_MS) {
      return false;
    }

    const midpointLocalMs = (window.startLocalMs + endLocalMs) / 2;
    const sampleOffsetMs = Math.round(serverTimestampMs - midpointLocalMs);

    if (!this.calibrated || rttMs <= this.bestRttMs) {
      this.offsetMs = sampleOffsetMs;
      this.bestRttMs = rttMs;
      this.calibrated = true;
      return true;
    }

    if (rttMs <= Math.max(400, this.bestRttMs * 1.5)) {
      this.offsetMs = Math.round(this.offsetMs * 0.7 + sampleOffsetMs * 0.3);
      return true;
    }

    return false;
  }

  reset(): void {
    this.offsetMs = 0;
    this.bestRttMs = Number.POSITIVE_INFINITY;
    this.calibrated = false;
    this.writeWindows.clear();
  }
}

export function computeRemainingSeconds(
  questionEndsAt: number | null | undefined,
  serverNowMs: number,
  timeLimitSec = 180
): number {
  if (!questionEndsAt || !Number.isFinite(questionEndsAt)) {
    return 0;
  }
  const safeLimit = Math.max(1, Math.round(timeLimitSec));
  return Math.max(
    0,
    Math.min(safeLimit, Math.ceil((questionEndsAt - serverNowMs) / 1000))
  );
}

/**
 * Computes the timeout delay aligned to the exact server-time boundary when
 * `remainingSec` will drop by 1 second, ensuring Moderator and Player clocks
 * flip numbers at the exact same instant without drift.
 */
export function computeNextCountdownTickDelayMs(
  questionEndsAt: number | null | undefined,
  serverNowMs: number,
  timeLimitSec = 180
): number | null {
  if (!questionEndsAt || !Number.isFinite(questionEndsAt)) {
    return null;
  }
  const remainingSec = computeRemainingSeconds(
    questionEndsAt,
    serverNowMs,
    timeLimitSec
  );
  if (remainingSec <= 0) {
    return null;
  }

  const nextDropServerMs = questionEndsAt - (remainingSec - 1) * 1000;
  const msUntilDrop = Math.max(0, nextDropServerMs - serverNowMs);
  return Math.max(
    16,
    Math.min(TIMER_MAX_TICK_INTERVAL_MS, msUntilDrop + TIMER_BOUNDARY_SAFETY_MS)
  );
}
