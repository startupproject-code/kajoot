import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARK_PLAYABLE_BOUNDS,
  stepParkActors,
  syncParkActors,
  triggerParkReaction,
} from './lobbyParkLogic';
import { PlayerPublic } from '../shared/types';

function makePlayer(id: string, name: string, avatarId: PlayerPublic['avatarId']): PlayerPublic {
  return {
    id,
    name,
    avatarId,
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
  };
}

test('syncParkActors spawns actors inside playable lawn bounds and removes departed players', () => {
  const players = [
    makePlayer('p1', 'ต้นกล้า', 'kid_01'),
    makePlayer('p2', 'มะลิ', 'kid_02'),
  ];
  const actors = syncParkActors([], players, 45, 1000, () => 0.5);
  assert.equal(actors.length, 2);

  for (const a of actors) {
    assert.ok(a.x >= PARK_PLAYABLE_BOUNDS.minX && a.x <= PARK_PLAYABLE_BOUNDS.maxX);
    assert.ok(a.y >= PARK_PLAYABLE_BOUNDS.minY && a.y <= PARK_PLAYABLE_BOUNDS.maxY);
  }

  const reduced = syncParkActors(actors, [players[0]], 45, 2000, () => 0.5);
  assert.equal(reduced.length, 1);
  assert.equal(reduced[0].id, 'p1');
});

test('stepParkActors moves walking/running actors within bounds and triggerParkReaction updates actions', () => {
  const players = [
    makePlayer('p1', 'เอ', 'kid_03'),
    makePlayer('p2', 'บี', 'cat'),
  ];
  let actors = syncParkActors([], players, 45, 1000, () => 0.4);
  actors = triggerParkReaction(actors, 'all', 'run', 1200, () => 0.8);

  assert.equal(actors[0].action, 'run');
  const startX = actors[0].x;
  const startY = actors[0].y;

  actors = stepParkActors(actors, 0.15, 1350, () => 0.8);
  const movedDist = Math.hypot(actors[0].x - startX, actors[0].y - startY);
  assert.ok(movedDist > 0.1, 'Expected running actor to move on step');

  actors = triggerParkReaction(actors, 'p1', 'sit', 1500, () => 0.2);
  assert.equal(actors[0].action, 'sit');
  assert.equal(actors[1].action, 'run');

  actors = triggerParkReaction(actors, 'p2', 'wave', 1600, () => 0.3);
  assert.equal(actors[1].action, 'wave');
  assert.ok(actors[1].emote);
});
