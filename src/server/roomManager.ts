import crypto from 'crypto';
import { DEFAULT_POSE_ID, isValidPoseForAvatar } from '../shared/characterPoses';
import {
  assignCorrectAnswerOrder,
  calculatePoints,
  generateRoomCode,
  isValidAvatarId,
  isValidRoomCode,
  rankPlayers,
} from '../shared/quizLogic';
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

export interface InternalPlayer {
  id: string;
  name: string;
  avatarId: AvatarId;
  poseId: string;
  score: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  answeredCount: number;
  lastPoints: number;
  lastCorrect: boolean | null;
  lastChoice: AnswerIndex | null;
  connected: boolean;
}

export interface QuizRoom {
  code: string;
  hostToken: string;
  quiz: QuizSet;
  phase: RoomPhase;
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  remainingSec: number;
  answersThisQuestion: Map<string, { choice: AnswerIndex; answeredAt: number }>;
  answerCounts: [number, number, number, number];
  players: Map<string, InternalPlayer>;
  createdAt: number;
}

export class RoomManager {
  private rooms = new Map<string, QuizRoom>();

  getRoomCount(): number {
    return this.rooms.size;
  }

  getRoom(code: string): QuizRoom | undefined {
    return this.rooms.get(code.trim());
  }

  createRoom(quiz: QuizSet, now = Date.now()): QuizRoom {
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      throw new Error('ชุดคำถามต้องมีอย่างน้อย 1 ข้อ');
    }

    const existing = new Set(this.rooms.keys());
    const code = generateRoomCode(existing);
    const hostToken = `host-${crypto.randomBytes(16).toString('hex')}`;

    const sanitizedQuiz: QuizSet = {
      id: quiz.id || `quiz-${now}`,
      title: (quiz.title || 'เกมตอบคำถามความรู้ทั่วไป').trim(),
      description: (quiz.description || '').trim(),
      questions: quiz.questions.map((q, idx) => ({
        id: q.id || `q-${idx + 1}`,
        text: q.text.trim(),
        options: [
          q.options[0]?.trim() || 'ตัวเลือก A',
          q.options[1]?.trim() || 'ตัวเลือก B',
          q.options[2]?.trim() || 'ตัวเลือก C',
          q.options[3]?.trim() || 'ตัวเลือก D',
        ],
        correctIndex: ([0, 1, 2, 3].includes(q.correctIndex) ? q.correctIndex : 0) as AnswerIndex,
        timeLimitSec: Math.max(5, Math.min(180, Math.round(q.timeLimitSec || 20))),
        imageUrl: q.imageUrl?.trim() || undefined,
        videoUrl: q.videoUrl?.trim() || undefined,
      })),
    };

    const room: QuizRoom = {
      code,
      hostToken,
      quiz: sanitizedQuiz,
      phase: 'LOBBY',
      currentQuestionIndex: -1,
      questionStartedAt: null,
      questionEndsAt: null,
      remainingSec: 0,
      answersThisQuestion: new Map(),
      answerCounts: [0, 0, 0, 0],
      players: new Map(),
      createdAt: now,
    };

    this.rooms.set(code, room);
    return room;
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code.trim());
  }

  checkRoomStatus(code: string): {
    code: string;
    exists: boolean;
    quizTitle?: string;
    totalPlayers?: number;
    maxPlayers: number;
    isFull?: boolean;
    phase?: RoomPhase;
    error?: string;
  } {
    const cleanCode = code.trim();
    if (!isValidRoomCode(cleanCode)) {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: 'รหัสห้องต้องเป็นตัวเลข 4 หลัก',
      };
    }

    const room = this.rooms.get(cleanCode);
    if (!room) {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: 'ไม่พบห้องแข่งขันนี้ กรุณาตรวจสอบรหัส 4 หลักอีกครั้ง',
      };
    }

    const isFull = room.players.size >= MAX_PLAYERS_PER_ROOM;
    return {
      code: room.code,
      exists: true,
      quizTitle: room.quiz.title,
      totalPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      isFull,
      phase: room.phase,
      error: isFull ? `ห้องเต็มแล้ว (รองรับสูงสุด ${MAX_PLAYERS_PER_ROOM} คน)` : undefined,
    };
  }

  joinPlayer(params: {
    code: string;
    name: string;
    avatarId: string;
    poseId?: string;
    playerId?: string;
  }): { room: QuizRoom; player: InternalPlayer } {
    const cleanCode = params.code.trim();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error('ไม่พบห้องแข่งขันนี้ กรุณาตรวจสอบรหัส 4 หลัก');
    }

    const cleanName = params.name.trim().slice(0, 24);
    if (!cleanName) {
      throw new Error('กรุณากรอกชื่อผู้เล่นก่อนเข้าห้อง');
    }

    const avatarId: AvatarId = isValidAvatarId(params.avatarId) ? params.avatarId : 'char_01';
    const poseId = isValidPoseForAvatar(avatarId, params.poseId) ? String(params.poseId) : DEFAULT_POSE_ID;

    if (params.playerId && room.players.has(params.playerId)) {
      const existing = room.players.get(params.playerId)!;
      existing.name = cleanName;
      existing.avatarId = avatarId;
      existing.poseId = poseId;
      existing.connected = true;
      return { room, player: existing };
    }

    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      throw new Error(`ห้องเต็มแล้ว (รองรับผู้เล่นสูงสุด ${MAX_PLAYERS_PER_ROOM} คนต่อห้อง)`);
    }

    const playerId = `p-${crypto.randomBytes(12).toString('hex')}`;
    const player: InternalPlayer = {
      id: playerId,
      name: cleanName,
      avatarId,
      poseId,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctCount: 0,
      answeredCount: 0,
      lastPoints: 0,
      lastCorrect: null,
      lastChoice: null,
      connected: true,
    };

    room.players.set(playerId, player);
    return { room, player };
  }

  updatePlayerPose(code: string, playerId: string, poseId: string): boolean {
    const room = this.rooms.get(code.trim());
    if (!room) return false;
    const player = room.players.get(playerId);
    if (!player) return false;
    player.poseId = isValidPoseForAvatar(player.avatarId, poseId) ? poseId : DEFAULT_POSE_ID;
    return true;
  }

  kickPlayer(code: string, playerId: string): boolean {
    const room = this.rooms.get(code.trim());
    if (!room) return false;
    const deleted = room.players.delete(playerId);
    if (deleted) {
      room.answersThisQuestion.delete(playerId);
    }
    return deleted;
  }

  setPlayerConnected(code: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player) {
      player.connected = connected;
    }
  }

  startGame(code: string, now = Date.now()): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (room.quiz.questions.length === 0) throw new Error('ไม่มีคำถามในชุดนี้');
    room.currentQuestionIndex = 0;
    this.beginQuestion(room, now);
    return room;
  }

  nextQuestion(code: string, now = Date.now()): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    const nextIdx = room.currentQuestionIndex + 1;
    if (nextIdx >= room.quiz.questions.length) {
      room.phase = 'ENDED';
      room.questionStartedAt = null;
      room.questionEndsAt = null;
      room.remainingSec = 0;
      return room;
    }
    room.currentQuestionIndex = nextIdx;
    this.beginQuestion(room, now);
    return room;
  }

  private beginQuestion(room: QuizRoom, now: number): void {
    const q = room.quiz.questions[room.currentQuestionIndex];
    room.phase = 'QUESTION';
    room.questionStartedAt = now;
    room.questionEndsAt = now + q.timeLimitSec * 1000;
    room.remainingSec = q.timeLimitSec;
    room.answersThisQuestion.clear();
    room.answerCounts = [0, 0, 0, 0];

    for (const p of room.players.values()) {
      p.lastPoints = 0;
      p.lastCorrect = null;
      p.lastChoice = null;
    }
  }

  submitAnswer(
    code: string,
    playerId: string,
    choice: AnswerIndex,
    now = Date.now()
  ): { accepted: boolean; allAnswered: boolean; room: QuizRoom } {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (room.phase !== 'QUESTION') {
      return { accepted: false, allAnswered: false, room };
    }
    const player = room.players.get(playerId);
    if (!player) {
      return { accepted: false, allAnswered: false, room };
    }
    if (room.answersThisQuestion.has(playerId)) {
      return { accepted: false, allAnswered: false, room };
    }
    if (![0, 1, 2, 3].includes(choice)) {
      return { accepted: false, allAnswered: false, room };
    }
    if (room.questionEndsAt && now > room.questionEndsAt + 500) {
      return { accepted: false, allAnswered: false, room };
    }

    room.answersThisQuestion.set(playerId, { choice, answeredAt: now });
    room.answerCounts[choice] += 1;
    player.lastChoice = choice;
    player.answeredCount += 1;

    const connectedCount = Array.from(room.players.values()).filter((p) => p.connected).length;
    const allAnswered =
      connectedCount > 0 && room.answersThisQuestion.size >= connectedCount;

    return { accepted: true, allAnswered, room };
  }

  tickTimer(code: string, now = Date.now()): {
    changed: boolean;
    expired: boolean;
    remainingSec: number;
    room?: QuizRoom;
  } {
    const room = this.rooms.get(code);
    if (!room || room.phase !== 'QUESTION' || !room.questionEndsAt) {
      return { changed: false, expired: false, remainingSec: 0, room };
    }

    const remainingMs = Math.max(0, room.questionEndsAt - now);
    const nextSec = Math.ceil(remainingMs / 1000);
    const changed = nextSec !== room.remainingSec;
    room.remainingSec = nextSec;

    if (remainingMs <= 0) {
      this.revealQuestion(code);
      return { changed: true, expired: true, remainingSec: 0, room };
    }

    return { changed, expired: false, remainingSec: nextSec, room };
  }

  revealQuestion(code: string): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (room.phase !== 'QUESTION') return room;

    const q = room.quiz.questions[room.currentQuestionIndex];
    const totalMs = q.timeLimitSec * 1000;
    const endsAt = room.questionEndsAt ?? Date.now();

    const correctOrderMap = assignCorrectAnswerOrder(
      Array.from(room.answersThisQuestion.entries())
        .filter(([, sub]) => sub.choice === q.correctIndex)
        .map(([playerId, sub]) => ({ playerId, answeredAtMs: sub.answeredAt }))
    );

    for (const player of room.players.values()) {
      const submission = room.answersThisQuestion.get(player.id);
      if (!submission) {
        player.streak = 0;
        player.lastPoints = 0;
        player.lastCorrect = false;
        player.lastChoice = null;
        continue;
      }

      const isCorrect = submission.choice === q.correctIndex;
      if (isCorrect) {
        player.streak += 1;
        player.bestStreak = Math.max(player.bestStreak, player.streak);
        player.correctCount += 1;
        const remainingMs = Math.max(0, endsAt - submission.answeredAt);
        const pts = calculatePoints({
          isCorrect: true,
          remainingMs,
          totalMs,
          streak: player.streak,
          correctOrderIndex: correctOrderMap.get(player.id) ?? 0,
        });
        player.score += pts;
        player.lastPoints = pts;
        player.lastCorrect = true;
      } else {
        player.streak = 0;
        player.lastPoints = 0;
        player.lastCorrect = false;
      }
    }

    room.phase = 'REVEAL';
    room.remainingSec = 0;
    return room;
  }

  showLeaderboard(code: string): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (room.phase === 'QUESTION') {
      this.revealQuestion(code);
    }
    if (room.currentQuestionIndex >= room.quiz.questions.length - 1) {
      room.phase = 'ENDED';
    } else {
      room.phase = 'LEADERBOARD';
    }
    return room;
  }

  endGame(code: string): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (room.phase === 'QUESTION') {
      this.revealQuestion(code);
    }
    room.phase = 'ENDED';
    room.remainingSec = 0;
    return room;
  }

  restartRoom(code: string, newQuiz?: QuizSet): QuizRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error('ไม่พบห้อง');
    if (newQuiz && newQuiz.questions.length > 0) {
      room.quiz = newQuiz;
    }
    room.phase = 'LOBBY';
    room.currentQuestionIndex = -1;
    room.questionStartedAt = null;
    room.questionEndsAt = null;
    room.remainingSec = 0;
    room.answersThisQuestion.clear();
    room.answerCounts = [0, 0, 0, 0];

    for (const p of room.players.values()) {
      p.score = 0;
      p.streak = 0;
      p.bestStreak = 0;
      p.correctCount = 0;
      p.answeredCount = 0;
      p.lastPoints = 0;
      p.lastCorrect = null;
      p.lastChoice = null;
    }
    return room;
  }

  toPublicState(room: QuizRoom, includeCorrectForHost = false): RoomPublicState {
    const ranked: PlayerPublic[] = rankPlayers(Array.from(room.players.values()));
    const q =
      room.currentQuestionIndex >= 0 && room.currentQuestionIndex < room.quiz.questions.length
        ? room.quiz.questions[room.currentQuestionIndex]
        : null;

    const showCorrect =
      includeCorrectForHost ||
      room.phase === 'REVEAL' ||
      room.phase === 'LEADERBOARD' ||
      room.phase === 'ENDED';

    const currentQuestion: PublicQuestionView | null = q
      ? {
          id: q.id,
          text: q.text,
          options: q.options,
          timeLimitSec: q.timeLimitSec,
          imageUrl: q.imageUrl,
          videoUrl: q.videoUrl,
          ...(showCorrect ? { correctIndex: q.correctIndex } : {}),
        }
      : null;

    return {
      code: room.code,
      quizTitle: room.quiz.title,
      phase: room.phase,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.quiz.questions.length,
      currentQuestion,
      questionStartedAt: room.questionStartedAt,
      questionEndsAt: room.questionEndsAt,
      remainingSec: room.remainingSec,
      answeredCount: room.answersThisQuestion.size,
      totalPlayers: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      answerCounts: [...room.answerCounts] as [number, number, number, number],
      players: ranked,
      topPlayers: ranked.slice(0, 10),
    };
  }
}
