import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ServerClockTracker,
  computeNextCountdownTickDelayMs,
  computeRemainingSeconds,
} from './questionTimerSync';

describe('questionTimerSync', () => {
  it('calibrates skewed Moderator and Player clocks to the exact same server timebase', () => {
    const modClock = new ServerClockTracker();
    const playerClock = new ServerClockTracker();

    // True server time = 1_700_000_000_000
    // Moderator device clock is 5,000ms FAST; Player device clock is 4,000ms SLOW
    const trueServerTime = 1_700_000_000_000;
    const modLocalAtStart = trueServerTime + 5_000;
    const playerLocalAtStart = trueServerTime - 4_000;

    modClock.beginWrite('room', modLocalAtStart);
    modClock.finishWrite('room', modLocalAtStart + 100);
    assert.equal(
      modClock.recordConfirmedTimestamp(
        'room',
        trueServerTime + 50,
        { fromCache: false, hasPendingWrites: false },
        modLocalAtStart + 105
      ),
      true
    );

    playerClock.beginWrite('player', playerLocalAtStart);
    playerClock.finishWrite('player', playerLocalAtStart + 120);
    assert.equal(
      playerClock.recordConfirmedTimestamp(
        'player',
        trueServerTime + 60,
        { fromCache: false, hasPendingWrites: false },
        playerLocalAtStart + 125
      ),
      true
    );

    assert.equal(modClock.getOffsetMs(), -5_000);
    assert.equal(playerClock.getOffsetMs(), 4_000);

    // At the same true server instant, both compute identical remaining seconds
    const checkServerNow = trueServerTime + 2_000;
    const questionEndsAt = checkServerNow + 20_000;
    const modNow = modClock.getEstimatedServerNowMs(checkServerNow + 5_000);
    const playerNow = playerClock.getEstimatedServerNowMs(checkServerNow - 4_000);

    assert.equal(modNow, checkServerNow);
    assert.equal(playerNow, checkServerNow);
    assert.equal(computeRemainingSeconds(questionEndsAt, modNow, 20), 20);
    assert.equal(computeRemainingSeconds(questionEndsAt, playerNow, 20), 20);
  });

  it('ignores cached, pending-write, or unrequested stale snapshots', () => {
    const clock = new ServerClockTracker();

    // Unrequested snapshot (no write window open) must be ignored
    assert.equal(
      clock.recordConfirmedTimestamp('room', 1_700_000_000_000, {}, 1_700_000_120_000),
      false
    );
    assert.equal(clock.hasCalibrated(), false);

    clock.beginWrite('room', 1_000);
    clock.finishWrite('room', 1_100);
    assert.equal(
      clock.recordConfirmedTimestamp(
        'room',
        1_050,
        { hasPendingWrites: true, fromCache: false },
        1_100
      ),
      false
    );
    assert.equal(clock.hasCalibrated(), false);
  });

  it('aligns next countdown tick to exact second boundary of questionEndsAt', () => {
    const endsAt = 30_000;
    // At 10,750ms -> 19,250ms remaining (20s), drops to 19s at 11,000ms (250ms away + 12ms safety)
    assert.equal(computeRemainingSeconds(endsAt, 10_750, 20), 20);
    assert.equal(computeNextCountdownTickDelayMs(endsAt, 10_750, 20), 262);

    // After 262ms (at 11,012ms) -> 18,988ms remaining -> drops cleanly to 19s
    assert.equal(computeRemainingSeconds(endsAt, 11_012, 20), 19);

    // When >500ms away from boundary, caps tick at 500ms
    assert.equal(computeNextCountdownTickDelayMs(endsAt, 10_100, 20), 500);

    // At expiry, no further ticks are scheduled
    assert.equal(computeRemainingSeconds(endsAt, 30_000, 20), 0);
    assert.equal(computeNextCountdownTickDelayMs(endsAt, 30_000, 20), null);
  });
});
