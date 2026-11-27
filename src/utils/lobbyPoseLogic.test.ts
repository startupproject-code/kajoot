import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerPublic } from '../shared/types';
import {
  MAX_LOBBY_CARDS_PER_ROW,
  MAX_LOBBY_VISIBLE_CARDS,
  getWindowedCarouselItems,
  partitionLobbyPlayers,
  rotateItems,
} from './lobbyPoseLogic';

function makePlayer(idx: number): PlayerPublic {
  return {
    id: `player_${idx}`,
    name: `ผู้เล่น ${idx}`,
    avatarId: 'char_05',
    poseId: idx % 2 === 0 ? 'pose_1' : 'default',
    score: 0,
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

describe('lobbyPoseLogic', () => {
  it('keeps 1-3 players static without dual carousel', () => {
    const res = partitionLobbyPlayers([makePlayer(1), makePlayer(2), makePlayer(3)]);
    assert.equal(res.mode, 'static_few');
    assert.equal(res.topRow.length, 3);
    assert.equal(res.bottomRow.length, 0);
  });

  it('keeps 4-10 players in static grid without dual carousel', () => {
    const players = Array.from({ length: 10 }, (_, i) => makePlayer(i + 1));
    const res = partitionLobbyPlayers(players);
    assert.equal(res.mode, 'static_grid');
    assert.equal(res.topRow.length, 10);
    assert.equal(res.bottomRow.length, 0);
  });

  it('splits >10 players into 2 strictly disjoint rows (zero duplicates across top & bottom)', () => {
    const players = Array.from({ length: 15 }, (_, i) => makePlayer(i + 1));
    const res = partitionLobbyPlayers(players);
    assert.equal(res.mode, 'dual_carousel');
    assert.equal(res.topRow.length, 8);
    assert.equal(res.bottomRow.length, 7);

    const topIds = new Set(res.topRow.map((p) => p.id));
    const bottomIds = new Set(res.bottomRow.map((p) => p.id));
    assert.equal(topIds.size, 8);
    assert.equal(bottomIds.size, 7);
    for (const id of topIds) {
      assert.equal(bottomIds.has(id), false, `Duplicate player ${id} found across rows`);
    }
  });

  it('rotates rows cleanly in both directions for 2-second loop scrolling', () => {
    const arr = ['A', 'B', 'C', 'D'];
    // Rightward scroll uses negative offset (last element moves to front)
    assert.deepEqual(rotateItems(arr, -1), ['D', 'A', 'B', 'C']);
    // Leftward scroll uses positive offset (first element moves to end)
    assert.deepEqual(rotateItems(arr, 1), ['B', 'C', 'D', 'A']);
  });

  it('virtualizes 200 players to at most 20 DOM cards (10 per row) and cycles all items over ticks', () => {
    const players = Array.from({ length: 200 }, (_, i) => makePlayer(i + 1));
    const res = partitionLobbyPlayers(players);
    assert.equal(res.mode, 'dual_carousel');
    assert.equal(res.topRow.length, 100);
    assert.equal(res.bottomRow.length, 100);

    const topWindow0 = getWindowedCarouselItems(res.topRow, 0);
    const bottomWindow0 = getWindowedCarouselItems(res.bottomRow, 0);
    assert.equal(topWindow0.length, MAX_LOBBY_CARDS_PER_ROW);
    assert.equal(bottomWindow0.length, MAX_LOBBY_CARDS_PER_ROW);
    assert.ok(topWindow0.length + bottomWindow0.length <= MAX_LOBBY_VISIBLE_CARDS);

    // Every tick shifts cleanly across the 100-player ring without duplicates
    const seenTopIds = new Set<string>();
    for (let tick = 0; tick < res.topRow.length; tick += 1) {
      const win = getWindowedCarouselItems(res.topRow, -tick);
      assert.equal(win.length, MAX_LOBBY_CARDS_PER_ROW);
      seenTopIds.add(win[0].id);
    }
    assert.equal(seenTopIds.size, 100);

    // Wrap-around boundary check for leftward ticks
    const leftWin = getWindowedCarouselItems(res.bottomRow, 98);
    assert.equal(leftWin[0].id, res.bottomRow[98].id);
    assert.equal(leftWin[1].id, res.bottomRow[99].id);
    assert.equal(leftWin[2].id, res.bottomRow[0].id);
  });
});
