import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from './roomManager';
import { DEFAULT_QUIZ } from '../shared/defaultQuiz';
import { MAX_PLAYERS_PER_ROOM } from '../shared/types';

test('RoomManager supports up to 200 players and rejects the 201st player', () => {
  const manager = new RoomManager();
  const room = manager.createRoom(DEFAULT_QUIZ, 1000);

  for (let i = 1; i <= MAX_PLAYERS_PER_ROOM; i++) {
    const joined = manager.joinPlayer({
      code: room.code,
      name: `ผู้เล่น ${i}`,
      avatarId: 'char_01',
    });
    assert.ok(joined.player.id);
  }

  assert.equal(room.players.size, 200);
  const status = manager.checkRoomStatus(room.code);
  assert.equal(status.isFull, true);

  assert.throws(
    () =>
      manager.joinPlayer({
        code: room.code,
        name: 'คนที่ 201',
        avatarId: 'char_02',
      }),
    /200/
  );
});

test('RoomManager runs full quiz lifecycle, hides correctIndex during QUESTION, and updates scores', () => {
  const manager = new RoomManager();
  const room = manager.createRoom(DEFAULT_QUIZ, 1000);

  const p1 = manager.joinPlayer({ code: room.code, name: 'มิ้นท์', avatarId: 'char_01' });
  const p2 = manager.joinPlayer({ code: room.code, name: 'ต้นกล้า', avatarId: 'char_03' });

  manager.startGame(room.code, 2000);
  assert.equal(room.phase, 'QUESTION');

  const playerStateDuringQ = manager.toPublicState(room, false);
  assert.equal(playerStateDuringQ.currentQuestion?.correctIndex, undefined);

  const hostStateDuringQ = manager.toPublicState(room, true);
  assert.equal(hostStateDuringQ.currentQuestion?.correctIndex, DEFAULT_QUIZ.questions[0].correctIndex);

  const correctChoice = DEFAULT_QUIZ.questions[0].correctIndex;
  const wrongChoice = ((correctChoice + 1) % 4) as 0 | 1 | 2 | 3;

  const sub1 = manager.submitAnswer(room.code, p1.player.id, correctChoice, 3000);
  assert.equal(sub1.accepted, true);
  assert.equal(sub1.allAnswered, false);

  const sub2 = manager.submitAnswer(room.code, p2.player.id, wrongChoice, 4000);
  assert.equal(sub2.accepted, true);
  assert.equal(sub2.allAnswered, true);

  manager.revealQuestion(room.code);
  assert.equal(room.phase, 'REVEAL');

  const revealedState = manager.toPublicState(room, false);
  assert.equal(revealedState.currentQuestion?.correctIndex, correctChoice);
  assert.equal(revealedState.players[0].name, 'มิ้นท์');
  assert.ok(revealedState.players[0].score > 500);
  assert.equal(revealedState.players[1].name, 'ต้นกล้า');
  assert.equal(revealedState.players[1].score, 0);

  manager.showLeaderboard(room.code);
  assert.equal(room.phase, 'LEADERBOARD');

  manager.endGame(room.code);
  assert.equal(room.phase, 'ENDED');
});
