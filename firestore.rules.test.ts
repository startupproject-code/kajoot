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
    assert.match(rulesText, /'SHOWCASE'/);
    assert.match(fs.readFileSync('firestore.rules', 'utf8'), /'SHOWCASE'/);
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
        avatarId: 'char_01',
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
        avatarId: 'char_02',
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

  it('11. Rejects invalid room code, oversized IDs, oversized names, and >100 players', () => {
    const prodRules = fs.readFileSync('firestore.rules', 'utf8');
    assert.equal(isValidRoomCode('12345'), false);
    assert.equal(isValidFirebaseId('a'.repeat(129)), false);
    assert.equal(sanitizePlayerName('a'.repeat(50)).length, 24);
    assert.match(rulesText, /data\.maxPlayers == 100/);
    assert.match(rulesText, /data\.totalPlayers < 100/);
    assert.match(prodRules, /data\.maxPlayers == 100/);
    assert.match(prodRules, /data\.totalPlayers < 100/);

    const fullRoom = validateRoomPlayerPayload(
      {
        id: 'p101',
        uid: 'p101',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Late',
        avatarId: 'char_01',
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
      { authUid: 'p101', roomCode: '4829', totalPlayersInRoom: 100, isCreate: true }
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

  it('allows all 19 newly uploaded character avatars and rejects removed old avatars', async () => {
    const { AVATARS } = await import('./src/shared/types');
    const { isValidAvatarId } = await import('./src/shared/quizLogic');
    const prodRules = fs.readFileSync('firestore.rules', 'utf8');

    assert.equal(AVATARS.length, 19);
    for (const av of AVATARS) {
      assert.equal(isValidAvatarId(av.id), true, `Expected isValidAvatarId(${av.id}) to be true`);
      assert.match(rulesText, new RegExp(`'${av.id}'`), `Expected ${av.id} in DRAFT_firestore.rules`);
      assert.match(prodRules, new RegExp(`'${av.id}'`), `Expected ${av.id} in firestore.rules`);
    }
    assert.equal(isValidAvatarId('cat'), false);
    assert.equal(isValidAvatarId('kid_01'), false);
  });

  it('validates character poseId assets on players and allows poseId self-update + host kick delete in rules', async () => {
    const {
      CHARACTER_POSES,
      isValidPoseForAvatar,
      getCharacterPoses,
      resolvePlayerPoseImage,
    } = await import('./src/shared/characterPoses');
    const { AVATARS } = await import('./src/shared/types');
    const prodRules = fs.readFileSync('firestore.rules', 'utf8');

    const char05Poses = getCharacterPoses('char_05');
    assert.equal(char05Poses.length, 7);
    assert.equal(isValidPoseForAvatar('char_05', 'pose_6'), true);
    assert.equal(isValidPoseForAvatar('char_05', 'pose_999'), false);
    assert.equal(isValidPoseForAvatar('char_01', 'pose_1'), true);
    assert.equal(isValidPoseForAvatar('char_14', 'pose_6'), true);
    assert.equal(isValidPoseForAvatar('char_09', 'pose_1'), true);
    assert.equal(isValidPoseForAvatar('char_19', 'pose_6'), true);
    assert.equal(isValidPoseForAvatar('char_19', 'pose_999'), false);
    assert.equal(resolvePlayerPoseImage('char_05', 'pose_1').imagePath, '/assets/actions/น้องหมวกแก๊ปเขียว/1_ตาเหล่.webp');
    assert.equal(resolvePlayerPoseImage('char_19', 'pose_999').id, 'default');

    // Every avatar and pose asset must be a .webp file present under public/
    const poseCharacters = Object.keys(CHARACTER_POSES);
    assert.equal(poseCharacters.length, 19);
    const seenPosePaths = new Set<string>();
    for (const av of AVATARS) {
      assert.match(av.imagePath, /\.webp$/, `Expected ${av.id} to use .webp`);
      assert.equal(fs.existsSync(`public${av.imagePath}`), true, `Missing avatar file public${av.imagePath}`);
      for (const pose of getCharacterPoses(av.id)) {
        assert.match(pose.imagePath, /\.webp$/, `Expected ${av.id}/${pose.id} to use .webp`);
        assert.equal(fs.existsSync(`public${pose.imagePath}`), true, `Missing pose file public${pose.imagePath}`);
        if (pose.id !== 'default') {
          assert.equal(seenPosePaths.has(pose.imagePath), false, `Duplicate pose image ${pose.imagePath}`);
          seenPosePaths.add(pose.imagePath);
        }
      }
    }
    assert.equal(seenPosePaths.size, 114);

    const validPosePayload = validateRoomPlayerPayload(
      {
        id: 'p_123456789012',
        uid: 'p_123456789012',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Ton',
        avatarId: 'char_14',
        poseId: 'pose_4',
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
      { authUid: 'p_123456789012', roomCode: '4829', totalPlayersInRoom: 1, isCreate: true }
    );
    assert.equal(validPosePayload.ok, true);

    const invalidPosePayload = validateRoomPlayerPayload(
      {
        id: 'p_123456789012',
        uid: 'p_123456789012',
        roomCode: '4829',
        hostUid: 'host-1',
        name: 'Ton',
        avatarId: 'char_19',
        poseId: 'pose_999',
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
      { authUid: 'p_123456789012', roomCode: '4829', totalPlayersInRoom: 1, isCreate: true }
    );
    assert.equal(invalidPosePayload.ok, false);

    assert.match(rulesText, /isValidPoseId\(/);
    assert.match(prodRules, /isValidPoseId\(/);
    assert.match(prodRules, /isSafeMediaUrl\(/);
    assert.match(prodRules, /data\.phase != 'SHOWCASE'/);
    assert.match(prodRules, /incoming\(\)\.connected == true/);
    assert.match(prodRules, /data\.questionEndsAt > data\.questionStartedAt/);
    assert.match(prodRules, /data\.currentQuestionIndex < data\.totalQuestions/);
    assert.match(prodRules, /hasOnly\(\['name', 'avatarId', 'poseId', 'connected', 'updatedAt'\]\)/);
    assert.match(prodRules, /match \/players\/\{playerId\}[\s\S]*allow delete: if isVerifiedUser\(\)[\s\S]*existing\(\)\.hostUid == request\.auth\.uid;/);
  });
});
