import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPublicQuestionPayload,
  sanitizePlayerName,
  sanitizeQuizForFirebase,
  validateRoomAnswerPayload,
  validateRoomPlayerPayload,
  validateRoomPayload,
  isValidFirebaseId,
} from './src/shared/firebaseValidation';
import { isValidRoomCode } from './src/shared/quizLogic';

describe('Phase 0 Dirty Dozen Security Invariants & Rules Checks', () => {
  const rulesText = fs.readFileSync('DRAFT_firestore.rules', 'utf8');

  it('enforces global safety net, verified email, and Eight Pillars structure in rules', () => {
    assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
    assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
    assert.match(rulesText, /isValidRoom\(/);
    assert.match(rulesText, /isValidRoomPlayer\(/);
    assert.match(rulesText, /isValidRoomAnswer\(/);
    assert.match(rulesText, /existing\(\)\.phase != 'ENDED'/);
    assert.match(rulesText, /allow update: if false;/);
  });

  it('1. Rejects unauthenticated room creation', () => {
    const res = validateRoomPayload({
      authUid: null,
      emailVerified: false,
      roomCode: '4829',
      hostUid: 'host-1',
      phase: 'LOBBY',
      currentQuestion: null,
      totalPlayers: 0,
      leaderboard: [],
    });
    assert.equal(res.ok, false);
  });

  it('2. Rejects unverified email writes', () => {
    const res = validateRoomPayload({
      authUid: 'host-1',
      emailVerified: false,
      roomCode: '4829',
      hostUid: 'host-1',
      phase: 'LOBBY',
      currentQuestion: null,
      totalPlayers: 0,
      leaderboard: [],
    });
    assert.equal(res.ok, false);
  });

  it('3. Rejects hostUid spoofing', () => {
    const res = validateRoomPayload({
      authUid: 'attacker-1',
      emailVerified: true,
      roomCode: '4829',
      hostUid: 'victim-host',
      phase: 'LOBBY',
      currentQuestion: null,
      totalPlayers: 0,
      leaderboard: [],
    });
    assert.equal(res.ok, false);
  });

  it('4. Rejects ghost fields / shadow updates on player payload', () => {
    const res = validateRoomPlayerPayload(
      {
        id: 'p1',
        uid: 'p1',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Alice',
        avatarId: 'cat',
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
        isAdmin: true,
      },
      { authUid: 'p1', roomCode: '4829', totalPlayersInRoom: 1, isCreate: true }
    );
    assert.equal(res.ok, false);
  });

  it('5. Rejects self-awarded non-zero score on player create', () => {
    const res = validateRoomPlayerPayload(
      {
        id: 'p1',
        uid: 'p1',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Cheater',
        avatarId: 'fox',
        score: 99999,
        streak: 5,
        bestStreak: 5,
        correctCount: 5,
        answeredCount: 5,
        lastPoints: 1000,
        lastCorrect: true,
        lastChoice: 0,
        rank: 1,
        connected: true,
      },
      { authUid: 'p1', roomCode: '4829', totalPlayersInRoom: 1, isCreate: true }
    );
    assert.equal(res.ok, false);
  });

  it('6. Rejects leaking correctIndex during QUESTION phase', () => {
    const res = validateRoomPayload({
      authUid: 'host-1',
      emailVerified: true,
      roomCode: '4829',
      hostUid: 'host-1',
      phase: 'QUESTION',
      currentQuestion: {
        id: 'q1',
        text: '1+1=?',
        options: ['1', '2', '3', '4'],
        timeLimitSec: 20,
        correctIndex: 1,
      },
      totalPlayers: 1,
      leaderboard: [],
    });
    assert.equal(res.ok, false);
  });

  it('7. Protects hostData collection strictly for hostUid in rules', () => {
    assert.match(
      rulesText,
      /match \/hostData\/\{docId\}[\s\S]*existing\(\)\.hostUid == request\.auth\.uid/
    );
  });

  it('8 & 9. Rejects answer spoofing, wrong questionIndex, and duplicate/mutated answers', () => {
    const wrongPlayer = validateRoomAnswerPayload(
      {
        id: '0_victim',
        roomCode: '4829',
        hostUid: 'host-1',
        playerUid: 'victim',
        questionIndex: 0,
        choice: 1,
      },
      { authUid: 'attacker', roomCode: '4829', roomPhase: 'QUESTION', currentQuestionIndex: 0 }
    );
    assert.equal(wrongPlayer.ok, false);

    const wrongQ = validateRoomAnswerPayload(
      {
        id: '2_p1',
        roomCode: '4829',
        hostUid: 'host-1',
        playerUid: 'p1',
        questionIndex: 2,
        choice: 1,
      },
      { authUid: 'p1', roomCode: '4829', roomPhase: 'QUESTION', currentQuestionIndex: 0 }
    );
    assert.equal(wrongQ.ok, false);
  });

  it('10. Rejects cross-user PII reads on /users/{userId} in rules', () => {
    assert.match(rulesText, /match \/users\/\{userId\}[\s\S]*allow get: if isValidId\(userId\) && isOwner\(userId\);/);
    assert.match(rulesText, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
  });

  it('11. Rejects invalid room code, oversized IDs, oversized names, and >200 players', () => {
    assert.equal(isValidRoomCode('12345'), false);
    assert.equal(isValidFirebaseId('a'.repeat(129)), false);
    assert.equal(sanitizePlayerName('a'.repeat(50)).length, 24);

    const fullRoom = validateRoomPlayerPayload(
      {
        id: 'p201',
        uid: 'p201',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Late',
        avatarId: 'cat',
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
      },
      { authUid: 'p201', roomCode: '4829', totalPlayersInRoom: 200, isCreate: true }
    );
    assert.equal(fullRoom.ok, false);
  });

  it('12. Locks rooms and players once phase reaches ENDED', () => {
    const res = validateRoomAnswerPayload(
      {
        id: '0_p1',
        roomCode: '4829',
        hostUid: 'host-1',
        playerUid: 'p1',
        questionIndex: 0,
        choice: 0,
      },
      { authUid: 'p1', roomCode: '4829', roomPhase: 'ENDED', currentQuestionIndex: 0 }
    );
    assert.equal(res.ok, false);
  });

  it('preserves compressed Base64 images up to 500KB for Firestore without truncation', () => {
    const sampleDataUrl = `data:image/jpeg;base64,${'A'.repeat(450_000)}`;
    const sanitized = sanitizeQuizForFirebase({
      id: 'quiz_1',
      title: 'Test Quiz',
      description: '',
      coverImageUrl: sampleDataUrl,
      questions: [
        {
          id: 'q_1',
          text: 'Question 1',
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          timeLimitSec: 20,
          imageUrl: sampleDataUrl,
        },
      ],
    });
    assert.equal(sanitized.coverImageUrl?.length, sampleDataUrl.length);
    assert.equal(sanitized.questions[0].imageUrl?.length, sampleDataUrl.length);

    const publicQ = buildPublicQuestionPayload(sanitized.questions[0], 'QUESTION');
    assert.equal(publicQ.imageUrl?.length, sampleDataUrl.length);
    assert.match(rulesText, /q\.imageUrl\.size\(\) <= 700000/);
    assert.match(rulesText, /data\.coverImageUrl\.size\(\) <= 700000/);
  });
});
