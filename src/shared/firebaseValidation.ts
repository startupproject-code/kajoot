import { isValidPoseForAvatar } from './characterPoses';
import { isValidAvatarId, isValidRoomCode } from './quizLogic';
import { AnswerIndex, AvatarId, MAX_PLAYERS_PER_ROOM, PublicQuestionView, QuizSet, RoomPhase } from './types';

// Constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const FIREBASE_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const MAX_FIREBASE_ID_LEN = 128;
export const MAX_QUIZ_TITLE_LEN = 120;
export const MAX_QUIZ_DESC_LEN = 300;
export const MAX_QUESTIONS_PER_QUIZ = 100;
export const MAX_QUESTION_TEXT_LEN = 500;
export const MAX_OPTION_TEXT_LEN = 200;
export const MAX_MEDIA_URL_LEN = 2048;
export const MAX_IMAGE_DATA_URL_LEN = 700_000;
export const MAX_PLAYER_NAME_LEN = 24;
export const MAX_POSE_ID_LEN = 32;
export const MAX_ANSWER_ID_LEN = 140;

export function isValidFirebaseId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= MAX_FIREBASE_ID_LEN && FIREBASE_ID_PATTERN.test(id);
}

export function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, MAX_PLAYER_NAME_LEN);
}

export function sanitizeQuizForFirebase(quiz: QuizSet): QuizSet {
  const cleanQuestions = (quiz.questions || [])
    .slice(0, MAX_QUESTIONS_PER_QUIZ)
    .map((q, idx) => {
      const cleanId = isValidFirebaseId(q.id) ? q.id : `q_${idx + 1}`;
      const rawImg = q.imageUrl?.trim();
      const imageUrl = rawImg && rawImg.length <= MAX_IMAGE_DATA_URL_LEN ? rawImg : rawImg?.slice(0, MAX_IMAGE_DATA_URL_LEN);
      const videoUrl = q.videoUrl?.trim().slice(0, MAX_MEDIA_URL_LEN);

      return {
        id: cleanId,
        text: (q.text || '').trim().slice(0, MAX_QUESTION_TEXT_LEN) || `คำถามข้อที่ ${idx + 1}`,
        options: [
          (q.options?.[0] || '').trim().slice(0, MAX_OPTION_TEXT_LEN) || 'ตัวเลือก A',
          (q.options?.[1] || '').trim().slice(0, MAX_OPTION_TEXT_LEN) || 'ตัวเลือก B',
          (q.options?.[2] || '').trim().slice(0, MAX_OPTION_TEXT_LEN) || 'ตัวเลือก C',
          (q.options?.[3] || '').trim().slice(0, MAX_OPTION_TEXT_LEN) || 'ตัวเลือก D',
        ] as [string, string, string, string],
        correctIndex: ([0, 1, 2, 3].includes(q.correctIndex) ? q.correctIndex : 0) as AnswerIndex,
        timeLimitSec: Math.max(5, Math.min(180, Math.round(Number(q.timeLimitSec) || 20))),
        ...(imageUrl ? { imageUrl } : {}),
        ...(videoUrl ? { videoUrl } : {}),
      };
    });

  const rawCover = quiz.coverImageUrl?.trim();
  const coverImageUrl =
    rawCover && rawCover.length <= MAX_IMAGE_DATA_URL_LEN
      ? rawCover
      : rawCover?.slice(0, MAX_IMAGE_DATA_URL_LEN);

  return {
    id: isValidFirebaseId(quiz.id) ? quiz.id : `quiz_${Date.now().toString(36)}`,
    title: (quiz.title || 'เกมตอบคำถามความรู้ทั่วไป').trim().slice(0, MAX_QUIZ_TITLE_LEN) || 'เกมตอบคำถามความรู้ทั่วไป',
    description: (quiz.description || '').trim().slice(0, MAX_QUIZ_DESC_LEN),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    questions: cleanQuestions,
  };
}

export function buildPublicQuestionPayload(
  q: QuizSet['questions'][number],
  phase: RoomPhase
): PublicQuestionView {
  const rawImg = q.imageUrl?.trim();
  const imageUrl = rawImg && rawImg.length <= MAX_IMAGE_DATA_URL_LEN ? rawImg : rawImg?.slice(0, MAX_IMAGE_DATA_URL_LEN);
  const videoUrl = q.videoUrl?.trim().slice(0, MAX_MEDIA_URL_LEN);

  return {
    id: isValidFirebaseId(q.id) ? q.id : `q_${Date.now().toString(36)}`,
    text: q.text.trim().slice(0, MAX_QUESTION_TEXT_LEN),
    options: [
      q.options[0].trim().slice(0, MAX_OPTION_TEXT_LEN),
      q.options[1].trim().slice(0, MAX_OPTION_TEXT_LEN),
      q.options[2].trim().slice(0, MAX_OPTION_TEXT_LEN),
      q.options[3].trim().slice(0, MAX_OPTION_TEXT_LEN),
    ],
    timeLimitSec: Math.max(5, Math.min(180, Math.round(q.timeLimitSec || 20))),
    ...(imageUrl ? { imageUrl } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    ...(phase !== 'QUESTION' ? { correctIndex: q.correctIndex } : {}),
  };
}

export function validateRoomPayload(input: {
  authUid: string | null;
  emailVerified: boolean;
  roomCode: string;
  hostUid: string;
  phase: RoomPhase;
  currentQuestion: PublicQuestionView | null;
  totalPlayers: number;
  leaderboard: unknown[];
}): { ok: boolean; reason?: string } {
  if (!input.authUid) return { ok: false, reason: 'Unauthenticated' };
  if (!input.emailVerified) return { ok: false, reason: 'Email not verified' };
  if (!isValidRoomCode(input.roomCode)) return { ok: false, reason: 'Invalid room code' };
  if (!isValidFirebaseId(input.hostUid) || input.hostUid !== input.authUid) {
    return { ok: false, reason: 'Host UID mismatch' };
  }
  if (input.totalPlayers < 0 || input.totalPlayers > MAX_PLAYERS_PER_ROOM) {
    return { ok: false, reason: 'Player count out of bounds' };
  }
  if (input.leaderboard.length > MAX_PLAYERS_PER_ROOM) {
    return { ok: false, reason: 'Leaderboard exceeds max capacity' };
  }
  if (input.phase === 'QUESTION' && input.currentQuestion && 'correctIndex' in input.currentQuestion) {
    return { ok: false, reason: 'correctIndex must not be exposed during QUESTION phase' };
  }
  return { ok: true };
}

export function validateRoomPlayerPayload(
  data: Record<string, unknown>,
  ctx: { authUid: string | null; roomCode: string; totalPlayersInRoom: number; isCreate: boolean }
): { ok: boolean; reason?: string } {
  if (!ctx.authUid) return { ok: false, reason: 'Unauthenticated' };
  const allowedKeys = new Set([
    'id',
    'uid',
    'roomCode',
    'hostUid',
    'name',
    'avatarId',
    'poseId',
    'score',
    'streak',
    'bestStreak',
    'correctCount',
    'answeredCount',
    'lastPoints',
    'lastCorrect',
    'lastChoice',
    'rank',
    'connected',
  ]);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) return { ok: false, reason: `Unexpected field: ${key}` };
  }
  if (data.uid !== ctx.authUid || data.id !== ctx.authUid) {
    return { ok: false, reason: 'Player UID mismatch' };
  }
  if (data.roomCode !== ctx.roomCode || !isValidRoomCode(String(data.roomCode))) {
    return { ok: false, reason: 'Room code mismatch' };
  }
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > MAX_PLAYER_NAME_LEN) {
    return { ok: false, reason: 'Invalid player name' };
  }
  if (!isValidAvatarId(String(data.avatarId))) {
    return { ok: false, reason: 'Invalid avatar ID' };
  }
  if (data.poseId !== undefined && !isValidPoseForAvatar(data.avatarId as AvatarId, data.poseId)) {
    return { ok: false, reason: 'Invalid character pose ID' };
  }
  if (ctx.isCreate) {
    if (ctx.totalPlayersInRoom >= MAX_PLAYERS_PER_ROOM) {
      return { ok: false, reason: 'Room is full' };
    }
    if (
      data.score !== 0 ||
      data.streak !== 0 ||
      data.bestStreak !== 0 ||
      data.correctCount !== 0 ||
      data.answeredCount !== 0 ||
      data.lastPoints !== 0 ||
      data.lastCorrect !== null ||
      data.lastChoice !== null ||
      data.rank !== 1
    ) {
      return { ok: false, reason: 'Initial player stats must be zeroed' };
    }
  }
  return { ok: true };
}

export function validateRoomAnswerPayload(
  data: Record<string, unknown>,
  ctx: {
    authUid: string | null;
    roomCode: string;
    roomPhase: RoomPhase;
    currentQuestionIndex: number;
  }
): { ok: boolean; reason?: string } {
  if (!ctx.authUid) return { ok: false, reason: 'Unauthenticated' };
  if (ctx.roomPhase !== 'QUESTION') return { ok: false, reason: 'Room is not in QUESTION phase' };
  if (data.playerUid !== ctx.authUid) return { ok: false, reason: 'Player UID mismatch' };
  if (data.roomCode !== ctx.roomCode) return { ok: false, reason: 'Room code mismatch' };
  if (data.questionIndex !== ctx.currentQuestionIndex) {
    return { ok: false, reason: 'Question index mismatch' };
  }
  const expectedId = `${ctx.currentQuestionIndex}_${ctx.authUid}`;
  if (data.id !== expectedId || expectedId.length > MAX_ANSWER_ID_LEN) {
    return { ok: false, reason: 'Invalid answer document ID' };
  }
  if (![0, 1, 2, 3].includes(Number(data.choice))) {
    return { ok: false, reason: 'Invalid answer choice' };
  }
  return { ok: true };
}
