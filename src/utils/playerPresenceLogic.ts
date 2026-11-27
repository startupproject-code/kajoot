import { AnswerIndex, RoomPhase } from '../shared/types';

export const PLAYER_HEARTBEAT_INTERVAL_MS = 8_000;
export const PLAYER_HEARTBEAT_JITTER_MS = 3_000;
export const PLAYER_BACKGROUND_DISCONNECT_MS = 5_000;
export const PLAYER_DISCONNECTED_GRACE_MS = 1_500;
export const PLAYER_STALE_TIMEOUT_MS = 25_000;
export const MODERATOR_PRUNE_SWEEP_INTERVAL_MS = 2_000;
export const MODERATOR_SLEEP_GAP_THRESHOLD_MS = 10_000;

export interface PresencePlayerLike {
  id: string;
  name: string;
  avatarId: string;
  poseId?: string;
  score: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  answeredCount: number;
  lastPoints: number;
  lastCorrect: boolean | null;
  lastChoice: AnswerIndex | null;
  rank: number;
  connected: boolean;
  updatedAt?: { toMillis?: () => number } | number | null;
}

export interface PresenceAnswerLike {
  playerUid: string;
  questionIndex: number;
  choice: AnswerIndex;
  submittedAt?: { toMillis?: () => number } | number | null;
}

interface TrackedPlayerState {
  lastSeenLocalMs: number;
  lastServerUpdatedMs: number | null;
  disconnectedSinceLocalMs: number | null;
  hostFieldsSig: string;
  profileSig: string;
  lastConnected: boolean;
  answerCount: number;
}

export function timestampToMillis(
  ts?: { toMillis?: () => number } | number | null
): number | null {
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts;
  }
  if (ts && typeof ts === 'object' && typeof ts.toMillis === 'function') {
    const ms = ts.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export function buildHostFieldsSignature(p: PresencePlayerLike): string {
  return [
    p.score,
    p.streak,
    p.bestStreak,
    p.correctCount,
    p.answeredCount,
    p.lastPoints,
    p.lastCorrect === null ? 'n' : p.lastCorrect ? '1' : '0',
    p.lastChoice === null ? 'n' : p.lastChoice,
    p.rank,
  ].join('|');
}

export function buildPlayerProfileSignature(p: PresencePlayerLike): string {
  return `${p.name}|${p.avatarId}|${p.poseId || 'default'}`;
}

export function computeRemainingQuestionStats(
  remainingPlayers: Pick<PresencePlayerLike, 'id'>[],
  answers: PresenceAnswerLike[],
  questionIndex: number
): {
  answeredCount: number;
  answerCounts: [number, number, number, number];
} {
  const activeIds = new Set(remainingPlayers.map((p) => p.id));
  const counts: [number, number, number, number] = [0, 0, 0, 0];
  const answeredPlayerIds = new Set<string>();

  for (const ans of answers) {
    if (ans.questionIndex !== questionIndex) continue;
    if (!activeIds.has(ans.playerUid)) continue;
    answeredPlayerIds.add(ans.playerUid);
    if (ans.choice === 0 || ans.choice === 1 || ans.choice === 2 || ans.choice === 3) {
      counts[ans.choice] += 1;
    }
  }

  return {
    answeredCount: answeredPlayerIds.size,
    answerCounts: counts,
  };
}

export class PlayerPresenceTracker {
  private readonly tracked = new Map<string, TrackedPlayerState>();

  reset(): void {
    this.tracked.clear();
  }

  syncSnapshot(
    players: PresencePlayerLike[],
    answers: PresenceAnswerLike[],
    nowMs: number,
    options?: { isHostWriteWindow?: boolean }
  ): void {
    const activeIds = new Set<string>();
    const answerCountsByPlayer = new Map<string, number>();
    for (const ans of answers) {
      answerCountsByPlayer.set(
        ans.playerUid,
        (answerCountsByPlayer.get(ans.playerUid) ?? 0) + 1
      );
    }

    for (const p of players) {
      activeIds.add(p.id);
      const serverUpdatedMs = timestampToMillis(p.updatedAt);
      const hostFieldsSig = buildHostFieldsSignature(p);
      const profileSig = buildPlayerProfileSignature(p);
      const answerCount = answerCountsByPlayer.get(p.id) ?? 0;

      const prev = this.tracked.get(p.id);
      if (!prev) {
        this.tracked.set(p.id, {
          lastSeenLocalMs: nowMs,
          lastServerUpdatedMs: serverUpdatedMs,
          disconnectedSinceLocalMs: p.connected ? null : nowMs,
          hostFieldsSig,
          profileSig,
          lastConnected: p.connected,
          answerCount,
        });
        continue;
      }

      const disconnectedSinceLocalMs = p.connected
        ? null
        : prev.disconnectedSinceLocalMs ?? nowMs;

      const reconnected = !prev.lastConnected && p.connected;
      const profileChanged = profileSig !== prev.profileSig;
      const submittedNewAnswer = answerCount > prev.answerCount;
      const hostFieldsUnchanged = hostFieldsSig === prev.hostFieldsSig;
      const serverTimestampAdvanced =
        serverUpdatedMs !== null &&
        (prev.lastServerUpdatedMs === null || serverUpdatedMs > prev.lastServerUpdatedMs);
      const playerHeartbeatObserved =
        serverTimestampAdvanced &&
        hostFieldsUnchanged &&
        !options?.isHostWriteWindow &&
        p.connected;

      const lastSeenLocalMs =
        reconnected || profileChanged || submittedNewAnswer || playerHeartbeatObserved
          ? nowMs
          : prev.lastSeenLocalMs;

      this.tracked.set(p.id, {
        lastSeenLocalMs,
        lastServerUpdatedMs: serverUpdatedMs ?? prev.lastServerUpdatedMs,
        disconnectedSinceLocalMs,
        hostFieldsSig,
        profileSig,
        lastConnected: p.connected,
        answerCount,
      });
    }

    for (const id of this.tracked.keys()) {
      if (!activeIds.has(id)) {
        this.tracked.delete(id);
      }
    }
  }

  shiftForHostWakeup(gapMs: number): void {
    if (gapMs <= 0) return;
    for (const entry of this.tracked.values()) {
      entry.lastSeenLocalMs += gapMs;
      if (entry.disconnectedSinceLocalMs !== null) {
        entry.disconnectedSinceLocalMs += gapMs;
      }
    }
  }

  getDisconnectedPlayerIds(
    players: PresencePlayerLike[],
    phase: RoomPhase,
    nowMs: number,
    options?: {
      disconnectedGraceMs?: number;
      staleTimeoutMs?: number;
    }
  ): string[] {
    if (phase === 'ENDED' || phase === 'SHOWCASE') return [];

    const graceMs = options?.disconnectedGraceMs ?? PLAYER_DISCONNECTED_GRACE_MS;
    const staleMs = options?.staleTimeoutMs ?? PLAYER_STALE_TIMEOUT_MS;
    const toRemove: string[] = [];

    for (const p of players) {
      const entry = this.tracked.get(p.id);
      if (!entry) continue;

      if (!p.connected) {
        const since = entry.disconnectedSinceLocalMs ?? nowMs;
        if (nowMs - since >= graceMs) {
          toRemove.push(p.id);
          continue;
        }
      }

      if (nowMs - entry.lastSeenLocalMs >= staleMs) {
        toRemove.push(p.id);
      }
    }

    return toRemove;
  }
}
