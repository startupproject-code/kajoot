import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { DEFAULT_POSE_ID, isValidPoseForAvatar } from '../shared/characterPoses';
import { calculatePoints, generateRoomCode, isValidRoomCode, rankPlayers } from '../shared/quizLogic';
import {
  buildPublicQuestionPayload,
  MAX_PLAYER_NAME_LEN,
  sanitizePlayerName,
  sanitizeQuizForFirebase,
} from '../shared/firebaseValidation';
import {
  AnswerIndex,
  AvatarId,
  MAX_PLAYERS_PER_ROOM,
  PlayerPublic,
  PublicQuestionView,
  QuizSet,
  RoomPhase,
  RoomPublicState,
} from '../shared/types';
import { db, handleFirestoreError, OperationType } from './firebaseClient';

const GUEST_PLAYER_STORAGE_KEY = 'quizarena_guest_player_id';

export function getOrCreateGuestPlayerId(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_PLAYER_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_\-]{12,128}$/.test(existing)) {
      return existing;
    }
  } catch {
    // ignore storage errors
  }

  const rawUuid =
    typeof window !== 'undefined' && window.crypto?.randomUUID
      ? window.crypto.randomUUID().replace(/-/g, '')
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2)}`;
  const generated = `p_${rawUuid}`.slice(0, 64);

  try {
    window.localStorage.setItem(GUEST_PLAYER_STORAGE_KEY, generated);
  } catch {
    // ignore storage errors
  }
  return generated;
}

export interface FirestoreRoomDoc {
  code: string;
  hostUid: string;
  quizTitle: string;
  phase: RoomPhase;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: PublicQuestionView | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  answeredCount: number;
  totalPlayers: number;
  maxPlayers: number;
  answerCounts: [number, number, number, number];
  leaderboard: PlayerPublic[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FirestorePlayerDoc {
  id: string;
  uid: string;
  roomCode: string;
  hostUid: string;
  name: string;
  avatarId: AvatarId;
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
  joinedAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface FirestoreAnswerDoc {
  id: string;
  roomCode: string;
  hostUid: string;
  playerUid: string;
  questionIndex: number;
  choice: AnswerIndex;
  submittedAt?: Timestamp | null;
}

export function roomDocToPublicState(
  room: FirestoreRoomDoc,
  now = Date.now(),
  overridePlayers?: PlayerPublic[]
): RoomPublicState {
  const remainingSec =
    room.phase === 'QUESTION' && room.questionEndsAt
      ? Math.max(
          0,
          Math.min(
            room.currentQuestion?.timeLimitSec ?? 180,
            Math.ceil((room.questionEndsAt - now) / 1000)
          )
        )
      : 0;

  const players = overridePlayers ?? room.leaderboard ?? [];
  return {
    code: room.code,
    quizTitle: room.quizTitle,
    phase: room.phase,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.totalQuestions,
    currentQuestion: room.currentQuestion,
    questionStartedAt: room.questionStartedAt,
    questionEndsAt: room.questionEndsAt,
    remainingSec,
    answeredCount: room.answeredCount,
    totalPlayers: overridePlayers ? overridePlayers.length : room.totalPlayers,
    maxPlayers: room.maxPlayers || MAX_PLAYERS_PER_ROOM,
    answerCounts: room.answerCounts || [0, 0, 0, 0],
    players,
    topPlayers: players.slice(0, 10),
  };
}

// ===========================================================================
// SAVED QUIZZES (Moderator persistence under /users/{uid}/quizzes/default)
// ===========================================================================
export async function loadSavedDefaultQuiz(uid: string): Promise<QuizSet | null> {
  const path = `users/${uid}/quizzes/default`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'quizzes', 'default'));
    if (!snap.exists()) return null;
    const data = snap.data() as {
      id: string;
      title: string;
      description: string;
      coverImageUrl?: string;
      questions: QuizSet['questions'];
    };
    return sanitizeQuizForFirebase({
      id: data.id,
      title: data.title,
      description: data.description || '',
      ...(data.coverImageUrl ? { coverImageUrl: data.coverImageUrl } : {}),
      questions: data.questions || [],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveDefaultQuizForUser(uid: string, quiz: QuizSet): Promise<void> {
  const clean = sanitizeQuizForFirebase(quiz);
  const path = `users/${uid}/quizzes/default`;
  const ref = doc(db, 'users', uid, 'quizzes', 'default');

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: 'default',
        ownerUid: uid,
        title: clean.title,
        description: clean.description,
        coverImageUrl: clean.coverImageUrl ?? '',
        questions: clean.questions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: clean.title,
        description: clean.description,
        coverImageUrl: clean.coverImageUrl ?? '',
        questions: clean.questions,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadAllSavedQuizzes(uid: string): Promise<QuizSet[]> {
  const path = `users/${uid}/quizzes`;
  try {
    const q = query(collection(db, 'users', uid, 'quizzes'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data() as {
          id: string;
          title: string;
          description?: string;
          coverImageUrl?: string;
          questions?: QuizSet['questions'];
        };
        return sanitizeQuizForFirebase({
          id: data.id || d.id,
          title: data.title || 'ชุดคำถามใหม่',
          description: data.description || '',
          ...(data.coverImageUrl ? { coverImageUrl: data.coverImageUrl } : {}),
          questions: data.questions || [],
        });
      })
      .filter((item) => item.questions.length > 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveQuizForUser(uid: string, quiz: QuizSet): Promise<QuizSet> {
  const clean = sanitizeQuizForFirebase(quiz);
  const quizId = clean.id;
  const path = `users/${uid}/quizzes/${quizId}`;
  const ref = doc(db, 'users', uid, 'quizzes', quizId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: quizId,
        ownerUid: uid,
        title: clean.title,
        description: clean.description,
        coverImageUrl: clean.coverImageUrl ?? '',
        questions: clean.questions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: clean.title,
        description: clean.description,
        coverImageUrl: clean.coverImageUrl ?? '',
        questions: clean.questions,
        updatedAt: serverTimestamp(),
      });
    }
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteQuizForUser(uid: string, quizId: string): Promise<void> {
  const path = `users/${uid}/quizzes/${quizId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quizzes', quizId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ===========================================================================
// HOST ROOM LIFECYCLE
// ===========================================================================
export async function createFirebaseRoom(
  hostUid: string,
  quizInput: QuizSet
): Promise<{ code: string; quiz: QuizSet }> {
  const cleanQuiz = sanitizeQuizForFirebase(quizInput);
  if (cleanQuiz.questions.length === 0) {
    throw new Error('ชุดคำถามต้องมีอย่างน้อย 1 ข้อ');
  }

  let chosenCode = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateRoomCode(new Set());
    try {
      const existing = await getDoc(doc(db, 'rooms', candidate));
      if (!existing.exists()) {
        chosenCode = candidate;
        break;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `rooms/${candidate}`);
    }
  }

  if (!chosenCode) {
    throw new Error('ไม่สามารถสุ่มรหัสห้องว่างได้ กรุณาลองใหม่อีกครั้ง');
  }

  const roomPath = `rooms/${chosenCode}`;
  const hostDataPath = `rooms/${chosenCode}/hostData/quiz`;

  try {
    await setDoc(doc(db, 'rooms', chosenCode), {
      code: chosenCode,
      hostUid,
      quizTitle: cleanQuiz.title,
      phase: 'LOBBY',
      currentQuestionIndex: -1,
      totalQuestions: cleanQuiz.questions.length,
      currentQuestion: null,
      questionStartedAt: null,
      questionEndsAt: null,
      answeredCount: 0,
      totalPlayers: 0,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      answerCounts: [0, 0, 0, 0],
      leaderboard: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, roomPath);
  }

  try {
    await setDoc(doc(db, 'rooms', chosenCode, 'hostData', 'quiz'), {
      roomCode: chosenCode,
      hostUid,
      quiz: cleanQuiz,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, hostDataPath);
  }

  return { code: chosenCode, quiz: cleanQuiz };
}

export function subscribeHostRoom(
  code: string,
  hostUid: string,
  callbacks: {
    onRoom: (room: FirestoreRoomDoc) => void;
    onPlayers: (players: FirestorePlayerDoc[]) => void;
    onAnswers: (answers: FirestoreAnswerDoc[]) => void;
  }
): () => void {
  const roomPath = `rooms/${code}`;
  const playersPath = `rooms/${code}/players`;
  const answersPath = `rooms/${code}/answers`;

  const unsubRoom = onSnapshot(
    doc(db, 'rooms', code),
    (snap) => {
      if (snap.exists()) {
        callbacks.onRoom(snap.data() as FirestoreRoomDoc);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }
  );

  const unsubPlayers = onSnapshot(
    query(collection(db, 'rooms', code, 'players'), where('hostUid', '==', hostUid)),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as FirestorePlayerDoc);
      callbacks.onPlayers(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, playersPath);
    }
  );

  const unsubAnswers = onSnapshot(
    query(collection(db, 'rooms', code, 'answers'), where('hostUid', '==', hostUid)),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as FirestoreAnswerDoc);
      callbacks.onAnswers(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, answersPath);
    }
  );

  return () => {
    unsubRoom();
    unsubPlayers();
    unsubAnswers();
  };
}

export async function syncHostRoomStats(params: {
  code: string;
  players: FirestorePlayerDoc[];
  answeredCount: number;
  answerCounts: [number, number, number, number];
}): Promise<void> {
  const roomPath = `rooms/${params.code}`;
  const ranked = rankPlayers(params.players);
  try {
    await updateDoc(doc(db, 'rooms', params.code), {
      answeredCount: params.answeredCount,
      totalPlayers: Math.min(MAX_PLAYERS_PER_ROOM, ranked.length),
      answerCounts: params.answerCounts,
      leaderboard: ranked.slice(0, MAX_PLAYERS_PER_ROOM),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, roomPath);
  }
}

export async function hostStartOrAdvanceQuestion(params: {
  code: string;
  quiz: QuizSet;
  questionIndex: number;
  players: FirestorePlayerDoc[];
}): Promise<void> {
  const { code, quiz, questionIndex, players } = params;
  const q = quiz.questions[questionIndex];
  if (!q) return;

  const now = Date.now();
  const questionEndsAt = now + q.timeLimitSec * 1000;
  const publicQuestion = buildPublicQuestionPayload(q, 'QUESTION');

  const resetPlayers = players.map((p) => ({
    ...p,
    lastPoints: 0,
    lastCorrect: null,
    lastChoice: null,
  }));
  const ranked = rankPlayers(resetPlayers);

  const batch = writeBatch(db);
  for (const p of ranked) {
    const pRef = doc(db, 'rooms', code, 'players', p.id);
    batch.update(pRef, {
      score: p.score,
      streak: p.streak,
      bestStreak: p.bestStreak,
      correctCount: p.correctCount,
      answeredCount: p.answeredCount,
      lastPoints: 0,
      lastCorrect: null,
      lastChoice: null,
      rank: p.rank,
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(doc(db, 'rooms', code), {
    phase: 'QUESTION',
    currentQuestionIndex: questionIndex,
    currentQuestion: publicQuestion,
    questionStartedAt: now,
    questionEndsAt,
    answeredCount: 0,
    totalPlayers: Math.min(MAX_PLAYERS_PER_ROOM, ranked.length),
    answerCounts: [0, 0, 0, 0],
    leaderboard: ranked.slice(0, MAX_PLAYERS_PER_ROOM),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${code}`);
  }
}

export async function hostRevealCurrentQuestion(params: {
  code: string;
  quiz: QuizSet;
  questionIndex: number;
  questionEndsAt: number | null;
  players: FirestorePlayerDoc[];
  answers: FirestoreAnswerDoc[];
  targetPhase?: 'REVEAL' | 'ENDED';
}): Promise<void> {
  const { code, quiz, questionIndex, questionEndsAt, players, answers } = params;
  const targetPhase = params.targetPhase ?? 'REVEAL';
  const q = quiz.questions[questionIndex];
  if (!q) return;

  const totalMs = q.timeLimitSec * 1000;
  const endsAt = questionEndsAt ?? Date.now();

  const answerMap = new Map<string, FirestoreAnswerDoc>();
  const answerCounts: [number, number, number, number] = [0, 0, 0, 0];
  for (const ans of answers) {
    if (ans.questionIndex !== questionIndex) continue;
    answerMap.set(ans.playerUid, ans);
    if ([0, 1, 2, 3].includes(ans.choice)) {
      answerCounts[ans.choice] += 1;
    }
  }

  const updatedPlayers = players.map((p) => {
    const sub = answerMap.get(p.id);
    if (!sub) {
      return {
        ...p,
        streak: 0,
        lastPoints: 0,
        lastCorrect: false,
        lastChoice: null,
      };
    }

    const isCorrect = sub.choice === q.correctIndex;
    const submittedMs = sub.submittedAt ? sub.submittedAt.toMillis() : Date.now();
    const remainingMs = Math.max(0, endsAt - submittedMs);

    if (isCorrect) {
      const nextStreak = p.streak + 1;
      const pts = calculatePoints({
        isCorrect: true,
        remainingMs,
        totalMs,
        streak: nextStreak,
      });
      return {
        ...p,
        score: p.score + pts,
        streak: nextStreak,
        bestStreak: Math.max(p.bestStreak, nextStreak),
        correctCount: p.correctCount + 1,
        answeredCount: p.answeredCount + 1,
        lastPoints: pts,
        lastCorrect: true,
        lastChoice: sub.choice,
      };
    }

    return {
      ...p,
      streak: 0,
      answeredCount: p.answeredCount + 1,
      lastPoints: 0,
      lastCorrect: false,
      lastChoice: sub.choice,
    };
  });

  const ranked = rankPlayers(updatedPlayers);
  const publicQuestion = buildPublicQuestionPayload(q, targetPhase);

  const batch = writeBatch(db);
  for (const r of ranked) {
    batch.update(doc(db, 'rooms', code, 'players', r.id), {
      score: r.score,
      streak: r.streak,
      bestStreak: r.bestStreak,
      correctCount: r.correctCount,
      answeredCount: r.answeredCount,
      lastPoints: r.lastPoints,
      lastCorrect: r.lastCorrect,
      lastChoice: r.lastChoice,
      rank: r.rank,
      updatedAt: serverTimestamp(),
    });
  }

  const roomPatch: Record<string, unknown> = {
    phase: targetPhase,
    currentQuestion: publicQuestion,
    answeredCount: answerMap.size,
    totalPlayers: Math.min(MAX_PLAYERS_PER_ROOM, ranked.length),
    answerCounts,
    leaderboard: ranked.slice(0, MAX_PLAYERS_PER_ROOM),
    updatedAt: serverTimestamp(),
  };

  if (targetPhase === 'ENDED') {
    roomPatch.questionStartedAt = null;
    roomPatch.questionEndsAt = null;
  }

  batch.update(doc(db, 'rooms', code), roomPatch);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rooms/${code}`);
  }
}

export async function hostTransitionPhase(params: {
  code: string;
  phase: 'LEADERBOARD' | 'ENDED';
  quiz: QuizSet;
  currentQuestionIndex: number;
  players: FirestorePlayerDoc[];
}): Promise<void> {
  const { code, phase, quiz, currentQuestionIndex, players } = params;
  const q = currentQuestionIndex >= 0 ? quiz.questions[currentQuestionIndex] : null;
  const publicQuestion = q ? buildPublicQuestionPayload(q, phase) : null;
  const ranked = rankPlayers(players);

  try {
    await updateDoc(doc(db, 'rooms', code), {
      phase,
      currentQuestion: publicQuestion,
      questionStartedAt: null,
      questionEndsAt: null,
      totalPlayers: Math.min(MAX_PLAYERS_PER_ROOM, ranked.length),
      leaderboard: ranked.slice(0, MAX_PLAYERS_PER_ROOM),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rooms/${code}`);
  }
}

// ===========================================================================
// PLAYER ACTIONS (Check Room via QR / PIN, Join, Submit Answer, Listen)
// ===========================================================================
export async function checkFirebaseRoom(codeInput: string): Promise<{
  code: string;
  exists: boolean;
  hostUid?: string;
  quizTitle?: string;
  totalPlayers?: number;
  maxPlayers: number;
  isFull?: boolean;
  phase?: RoomPhase;
  error?: string;
}> {
  const cleanCode = codeInput.trim();
  if (!isValidRoomCode(cleanCode)) {
    return {
      code: cleanCode,
      exists: false,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      error: 'รหัสห้องต้องเป็นตัวเลข 4 หลัก',
    };
  }

  const roomPath = `rooms/${cleanCode}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', cleanCode));
    if (!snap.exists()) {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: 'ไม่พบห้องแข่งขันนี้ กรุณาตรวจสอบรหัส 4 หลักอีกครั้ง',
      };
    }

    const room = snap.data() as FirestoreRoomDoc;
    if (room.phase === 'ENDED') {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: 'ห้องแข่งขันนี้จบเกมแล้ว กรุณาขอรหัสห้องใหม่จาก Moderator',
      };
    }

    const isFull = (room.totalPlayers ?? 0) >= MAX_PLAYERS_PER_ROOM;
    return {
      code: room.code,
      exists: true,
      hostUid: room.hostUid,
      quizTitle: room.quizTitle,
      totalPlayers: room.totalPlayers,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      isFull,
      phase: room.phase,
      error: isFull ? `ห้องเต็มแล้ว (รองรับสูงสุด ${MAX_PLAYERS_PER_ROOM} คน)` : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, roomPath);
  }
}

export async function hostKickFirebasePlayer(params: {
  code: string;
  playerId: string;
  players: FirestorePlayerDoc[];
  answeredCount?: number;
  answerCounts?: [number, number, number, number];
}): Promise<void> {
  const { code, playerId, players } = params;
  const remaining = players.filter((p) => p.id !== playerId);
  const ranked = rankPlayers(remaining);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'rooms', code, 'players', playerId));
  batch.update(doc(db, 'rooms', code), {
    totalPlayers: Math.min(MAX_PLAYERS_PER_ROOM, ranked.length),
    leaderboard: ranked.slice(0, MAX_PLAYERS_PER_ROOM),
    ...(params.answeredCount !== undefined ? { answeredCount: params.answeredCount } : {}),
    ...(params.answerCounts ? { answerCounts: params.answerCounts } : {}),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rooms/${code}/players/${playerId}`);
  }
}

export async function joinFirebaseRoom(params: {
  code: string;
  hostUid: string;
  uid: string;
  name: string;
  avatarId: AvatarId;
  poseId?: string;
}): Promise<void> {
  const cleanName = sanitizePlayerName(params.name).slice(0, MAX_PLAYER_NAME_LEN);
  if (!cleanName) {
    throw new Error('กรุณากรอกชื่อผู้เล่นก่อนเข้าห้อง');
  }

  const safePoseId = isValidPoseForAvatar(params.avatarId, params.poseId)
    ? String(params.poseId)
    : DEFAULT_POSE_ID;
  const playerPath = `rooms/${params.code}/players/${params.uid}`;
  const playerRef = doc(db, 'rooms', params.code, 'players', params.uid);

  try {
    const existingSnap = await getDoc(playerRef);
    if (existingSnap.exists()) {
      await updateDoc(playerRef, {
        name: cleanName,
        avatarId: params.avatarId,
        poseId: safePoseId,
        connected: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(playerRef, {
        id: params.uid,
        uid: params.uid,
        roomCode: params.code,
        hostUid: params.hostUid,
        name: cleanName,
        avatarId: params.avatarId,
        poseId: safePoseId,
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
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }
}

export async function updateFirebasePlayerPose(params: {
  code: string;
  uid: string;
  avatarId: AvatarId;
  poseId: string;
}): Promise<void> {
  const safePoseId = isValidPoseForAvatar(params.avatarId, params.poseId)
    ? params.poseId
    : DEFAULT_POSE_ID;
  const playerPath = `rooms/${params.code}/players/${params.uid}`;
  try {
    await updateDoc(doc(db, 'rooms', params.code, 'players', params.uid), {
      poseId: safePoseId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, playerPath);
  }
}

export async function submitFirebaseAnswer(params: {
  code: string;
  hostUid: string;
  playerUid: string;
  questionIndex: number;
  choice: AnswerIndex;
}): Promise<void> {
  const answerId = `${params.questionIndex}_${params.playerUid}`;
  const answerPath = `rooms/${params.code}/answers/${answerId}`;

  try {
    await setDoc(doc(db, 'rooms', params.code, 'answers', answerId), {
      id: answerId,
      roomCode: params.code,
      hostUid: params.hostUid,
      playerUid: params.playerUid,
      questionIndex: params.questionIndex,
      choice: params.choice,
      submittedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, answerPath);
  }
}

export function subscribePlayerRoom(
  code: string,
  playerUid: string,
  callbacks: {
    onRoom: (room: FirestoreRoomDoc) => void;
    onPlayerSelf: (player: FirestorePlayerDoc | null) => void;
    onMissing?: () => void;
  }
): () => void {
  const roomPath = `rooms/${code}`;
  const playerPath = `rooms/${code}/players/${playerUid}`;

  const unsubRoom = onSnapshot(
    doc(db, 'rooms', code),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onMissing?.();
        return;
      }
      callbacks.onRoom(snap.data() as FirestoreRoomDoc);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }
  );

  const unsubPlayer = onSnapshot(
    doc(db, 'rooms', code, 'players', playerUid),
    (snap) => {
      callbacks.onPlayerSelf(snap.exists() ? (snap.data() as FirestorePlayerDoc) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, playerPath);
    }
  );

  return () => {
    unsubRoom();
    unsubPlayer();
  };
}
