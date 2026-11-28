import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PlayerPublic } from '../shared/types';
import {
  SHOWCASE_AUDIO,
  SHOWCASE_TIMINGS,
  buildShowcaseQueue,
  getPlacedPlacesForStep,
  getShowcaseAudioForPlace,
} from './showcaseLogic';

function makePlayer(idx: number, score: number): PlayerPublic {
  return {
    id: `p_${idx}`,
    name: `Player ${idx}`,
    avatarId: 'char_01',
    poseId: 'default',
    score,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    answeredCount: 0,
    lastPoints: 0,
    lastCorrect: null,
    lastChoice: null,
    rank: idx,
    connected: true,
  };
}

describe('showcaseLogic', () => {
  it('returns empty queue for 0 players and supports 1, 2, and 3+ players in 3 -> 2 -> 1 order', () => {
    assert.deepEqual(buildShowcaseQueue([]), []);

    const one = buildShowcaseQueue([makePlayer(1, 3000)]);
    assert.deepEqual(
      one.map((e) => e.place),
      [1]
    );
    assert.equal(one[0].audioPath, SHOWCASE_AUDIO.rank1);

    const two = buildShowcaseQueue([makePlayer(1, 3000), makePlayer(2, 2000)]);
    assert.deepEqual(
      two.map((e) => e.place),
      [2, 1]
    );
    assert.equal(two[0].audioPath, SHOWCASE_AUDIO.rank2And3);
    assert.equal(two[0].postSettlePauseMs, 10000);
    assert.equal(two[1].audioPath, SHOWCASE_AUDIO.rank1);

    const four = buildShowcaseQueue([
      makePlayer(1, 4000),
      makePlayer(2, 3000),
      makePlayer(3, 2000),
      makePlayer(4, 1000),
    ]);
    assert.deepEqual(
      four.map((e) => e.place),
      [3, 2, 1]
    );
    assert.equal(four[0].player.id, 'p_3');
    assert.equal(four[0].postSettlePauseMs, 5000);
    assert.equal(four[1].player.id, 'p_2');
    assert.equal(four[1].postSettlePauseMs, 10000);
    assert.equal(four[2].player.id, 'p_1');
  });

  it('uses exact audio assets present on disk and requested inter-rank timings', () => {
    assert.equal(getShowcaseAudioForPlace(3), '/assets/audio/rank_2_3.mp3');
    assert.equal(getShowcaseAudioForPlace(2), '/assets/audio/rank_2_3.mp3');
    assert.equal(getShowcaseAudioForPlace(1), '/assets/audio/rank_1.mp3');

    assert.equal(fs.existsSync(`public${SHOWCASE_AUDIO.rank2And3}`), true);
    assert.equal(fs.existsSync(`public${SHOWCASE_AUDIO.rank1}`), true);

    assert.equal(SHOWCASE_TIMINGS.AFTER_RANK_3_WAIT_MS, 5000);
    assert.equal(SHOWCASE_TIMINGS.AFTER_RANK_2_WAIT_MS, 10000);
    assert.ok(SHOWCASE_TIMINGS.RANK_2_3_NAME_REVEAL_MS >= 1000);
    assert.ok(SHOWCASE_TIMINGS.RANK_1_NAME_REVEAL_MS >= 4400);
  });

  it('tracks visible podium places across announcement and settle steps', () => {
    const queue = buildShowcaseQueue([
      makePlayer(1, 4000),
      makePlayer(2, 3000),
      makePlayer(3, 2000),
    ]);

    assert.deepEqual(getPlacedPlacesForStep(queue, -1, false), []);
    assert.deepEqual(getPlacedPlacesForStep(queue, 0, false), []);
    assert.deepEqual(getPlacedPlacesForStep(queue, 0, true), [3]);
    assert.deepEqual(getPlacedPlacesForStep(queue, 1, false), [3]);
    assert.deepEqual(getPlacedPlacesForStep(queue, 1, true), [3, 2]);
    assert.deepEqual(getPlacedPlacesForStep(queue, 2, false), [3, 2]);
    assert.deepEqual(getPlacedPlacesForStep(queue, 2, true), [3, 2, 1]);
  });
});
