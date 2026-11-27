import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_DISCONNECTED_GRACE_MS,
  PLAYER_STALE_TIMEOUT_MS,
  PlayerPresenceTracker,
  PresenceAnswerLike,
  PresencePlayerLike,
  computeRemainingQuestionStats,
} from './playerPresenceLogic';

function makePlayer(overrides: Partial<PresencePlayerLike> = {}): PresencePlayerLike {
  return {
    id: 'p_player_001',
    name: 'Alice',
    avatarId: 'char_01',
    poseId: 'default',
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    answeredCount: 0,
    lastPoints: 0,
    lastCorrect: null,
    lastChoice: null,
    rank: 1,
    connected: true,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('playerPresenceLogic', () => {
  it('immediately removes explicitly disconnected players after short grace window', () => {
    const tracker = new PlayerPresenceTracker();
    const p1 = makePlayer({ id: 'p_1', connected: true, updatedAt: 1000 });
    const p2 = makePlayer({ id: 'p_2', connected: true, updatedAt: 1000 });

    tracker.syncSnapshot([p1, p2], [], 1000);
    assert.deepEqual(tracker.getDisconnectedPlayerIds([p1, p2], 'LOBBY', 1000), []);

    // p2 closes app / switches away -> sets connected: false
    const p2Closed = makePlayer({ id: 'p_2', connected: false, updatedAt: 2000 });
    tracker.syncSnapshot([p1, p2Closed], [], 2000);

    // Within grace period -> not removed yet
    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([p1, p2Closed], 'LOBBY', 2000 + PLAYER_DISCONNECTED_GRACE_MS - 100),
      []
    );

    // Past grace period -> removed automatically
    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([p1, p2Closed], 'LOBBY', 2000 + PLAYER_DISCONNECTED_GRACE_MS),
      ['p_2']
    );
  });

  it('cancels removal if player reconnects before grace expires', () => {
    const tracker = new PlayerPresenceTracker();
    const p1 = makePlayer({ id: 'p_1', connected: true, updatedAt: 1000 });
    tracker.syncSnapshot([p1], [], 1000);

    const p1Hidden = makePlayer({ id: 'p_1', connected: false, updatedAt: 2000 });
    tracker.syncSnapshot([p1Hidden], [], 2000);

    const p1Returned = makePlayer({ id: 'p_1', connected: true, updatedAt: 2500 });
    tracker.syncSnapshot([p1Returned], [], 2500);

    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([p1Returned], 'LOBBY', 2500 + PLAYER_DISCONNECTED_GRACE_MS + 500),
      []
    );
  });

  it('removes silent/crashed players whose heartbeat stops even if connected remains true', () => {
    const tracker = new PlayerPresenceTracker();
    const pAlive = makePlayer({ id: 'p_alive', connected: true, updatedAt: 1000 });
    const pDead = makePlayer({ id: 'p_dead', connected: true, updatedAt: 1000 });

    tracker.syncSnapshot([pAlive, pDead], [], 1000);

    // pAlive heartbeats at 9s, 17s, 25s; pDead is frozen/force-killed
    tracker.syncSnapshot(
      [makePlayer({ id: 'p_alive', connected: true, updatedAt: 9000 }), pDead],
      [],
      9000
    );
    tracker.syncSnapshot(
      [makePlayer({ id: 'p_alive', connected: true, updatedAt: 17000 }), pDead],
      [],
      17000
    );
    tracker.syncSnapshot(
      [makePlayer({ id: 'p_alive', connected: true, updatedAt: 25000 }), pDead],
      [],
      25000
    );

    assert.deepEqual(
      tracker.getDisconnectedPlayerIds(
        [makePlayer({ id: 'p_alive', connected: true, updatedAt: 25000 }), pDead],
        'LOBBY',
        1000 + PLAYER_STALE_TIMEOUT_MS
      ),
      ['p_dead']
    );
  });

  it('does NOT falsely treat host score/reveal batch writes as a dead player heartbeat', () => {
    const tracker = new PlayerPresenceTracker();
    const pDead = makePlayer({ id: 'p_dead', connected: true, updatedAt: 1000, score: 0 });
    tracker.syncSnapshot([pDead], [], 1000);

    // At 15s, Host runs reveal/advance which updates score/lastCorrect/updatedAt for everyone
    const pDeadAfterHostWrite = makePlayer({
      id: 'p_dead',
      connected: true,
      updatedAt: 15000,
      lastCorrect: false,
      streak: 0,
    });
    tracker.syncSnapshot([pDeadAfterHostWrite], [], 15000, { isHostWriteWindow: true });

    // At 26s (25s after original join with zero player heartbeats), pDead is STILL pruned
    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([pDeadAfterHostWrite], 'QUESTION', 1000 + PLAYER_STALE_TIMEOUT_MS),
      ['p_dead']
    );
  });

  it('treats pose changes and submitted answers as live player activity', () => {
    const tracker = new PlayerPresenceTracker();
    const p1 = makePlayer({ id: 'p_1', connected: true, updatedAt: 1000, poseId: 'default' });
    tracker.syncSnapshot([p1], [], 1000);

    // Pose changed at 20s
    const p1Pose = makePlayer({ id: 'p_1', connected: true, updatedAt: 20000, poseId: 'pose_2' });
    tracker.syncSnapshot([p1Pose], [], 20000);

    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([p1Pose], 'LOBBY', 26000),
      []
    );

    // Answer submitted at 40s
    const answers: PresenceAnswerLike[] = [
      { playerUid: 'p_1', questionIndex: 0, choice: 1, submittedAt: 40000 },
    ];
    tracker.syncSnapshot([p1Pose], answers, 40000);

    assert.deepEqual(
      tracker.getDisconnectedPlayerIds([p1Pose], 'QUESTION', 50000),
      []
    );
  });

  it('protects players from pruning when Moderator wakes from sleep or game is ENDED', () => {
    const tracker = new PlayerPresenceTracker();
    const p1 = makePlayer({ id: 'p_1', connected: true, updatedAt: 1000 });
    tracker.syncSnapshot([p1], [], 1000);

    // Moderator laptop slept 40s and wakes up
    tracker.shiftForHostWakeup(40000);
    assert.deepEqual(tracker.getDisconnectedPlayerIds([p1], 'LOBBY', 41000), []);

    // Never prune once phase is SHOWCASE or ENDED (preserve final podium winners)
    const pDisconnected = makePlayer({ id: 'p_2', connected: false, updatedAt: 1000 });
    tracker.syncSnapshot([p1, pDisconnected], [], 1000);
    assert.deepEqual(tracker.getDisconnectedPlayerIds([p1, pDisconnected], 'SHOWCASE', 999999), []);
    assert.deepEqual(tracker.getDisconnectedPlayerIds([p1, pDisconnected], 'ENDED', 999999), []);
  });

  it('recomputes question answer counts excluding deleted/disconnected players', () => {
    const remaining = [makePlayer({ id: 'p_stay' })];
    const answers: PresenceAnswerLike[] = [
      { playerUid: 'p_left', questionIndex: 0, choice: 0 },
      { playerUid: 'p_stay', questionIndex: 0, choice: 2 },
      { playerUid: 'p_stay', questionIndex: 1, choice: 3 },
    ];
    const stats = computeRemainingQuestionStats(remaining, answers, 0);
    assert.equal(stats.answeredCount, 1);
    assert.deepEqual(stats.answerCounts, [0, 0, 1, 0]);
  });
});
