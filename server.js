// server.ts
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

// src/shared/types.ts
var MAX_PLAYERS_PER_ROOM = 200;
var AVATARS = [
  { id: "cat", name: "\u0E19\u0E49\u0E2D\u0E07\u0E41\u0E21\u0E27", imagePath: "/assets/aistudio/Cat_4ef2f009.png", bgClass: "bg-amber-100", accentHex: "#F59E0B" },
  { id: "dog", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E21\u0E32", imagePath: "/assets/aistudio/Dog_090d167a.png", bgClass: "bg-yellow-100", accentHex: "#EAB308" },
  { id: "panda", name: "\u0E19\u0E49\u0E2D\u0E07\u0E41\u0E1E\u0E19\u0E14\u0E49\u0E32", imagePath: "/assets/aistudio/Panda_66a51023.png", bgClass: "bg-emerald-100", accentHex: "#10B981" },
  { id: "fox", name: "\u0E19\u0E49\u0E2D\u0E07\u0E08\u0E34\u0E49\u0E07\u0E08\u0E2D\u0E01", imagePath: "/assets/aistudio/Fox_3b228377.png", bgClass: "bg-orange-100", accentHex: "#EA580C" },
  { id: "chicken", name: "\u0E19\u0E49\u0E2D\u0E07\u0E44\u0E01\u0E48", imagePath: "/assets/aistudio/Chicken_bb74afc6.png", bgClass: "bg-amber-100", accentHex: "#D97706" },
  { id: "cow", name: "\u0E19\u0E49\u0E2D\u0E07\u0E27\u0E31\u0E27", imagePath: "/assets/aistudio/Cow_55e35484.png", bgClass: "bg-lime-100", accentHex: "#65A30D" },
  { id: "deer", name: "\u0E19\u0E49\u0E2D\u0E07\u0E01\u0E27\u0E32\u0E07", imagePath: "/assets/aistudio/Deer_7839724b.png", bgClass: "bg-emerald-100", accentHex: "#059669" },
  { id: "crocodile", name: "\u0E19\u0E49\u0E2D\u0E07\u0E08\u0E23\u0E30\u0E40\u0E02\u0E49", imagePath: "/assets/aistudio/Crocodile_84f9a948.png", bgClass: "bg-teal-100", accentHex: "#0D9488" },
  { id: "elephant", name: "\u0E19\u0E49\u0E2D\u0E07\u0E0A\u0E49\u0E32\u0E07", imagePath: "/assets/aistudio/Elephant_51aa857c.png", bgClass: "bg-amber-100", accentHex: "#F59E0B" },
  { id: "giraffe", name: "\u0E19\u0E49\u0E2D\u0E07\u0E22\u0E35\u0E23\u0E32\u0E1F", imagePath: "/assets/aistudio/Girafft_aecae44c.png", bgClass: "bg-yellow-100", accentHex: "#CA8A04" },
  { id: "hippo", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2E\u0E34\u0E1B\u0E42\u0E1B", imagePath: "/assets/aistudio/Hippo_5c6b796a.png", bgClass: "bg-sky-100", accentHex: "#0284C7" },
  { id: "penguin", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E1E\u0E19\u0E01\u0E27\u0E34\u0E19", imagePath: "/assets/aistudio/Penguin_5318f8f5.png", bgClass: "bg-sky-100", accentHex: "#0EA5E9" },
  { id: "pig", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E21\u0E39", imagePath: "/assets/aistudio/Pig_4a4b2a49.png", bgClass: "bg-pink-100", accentHex: "#EC4899" },
  { id: "polar", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E21\u0E35\u0E02\u0E32\u0E27", imagePath: "/assets/aistudio/Polar_870da263.png", bgClass: "bg-cyan-100", accentHex: "#06B6D4" },
  { id: "otter", name: "\u0E19\u0E49\u0E2D\u0E07\u0E19\u0E32\u0E01", imagePath: "/assets/aistudio/Otter_b4845cc0.png", bgClass: "bg-sky-100", accentHex: "#0284C7" },
  { id: "frog", name: "\u0E19\u0E49\u0E2D\u0E07\u0E01\u0E1A", imagePath: "/assets/aistudio/Frog_d4d1334a.png", bgClass: "bg-green-100", accentHex: "#16A34A" },
  { id: "lion", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2A\u0E34\u0E07\u0E42\u0E15", imagePath: "/assets/aistudio/Lion_d7cf4d56.png", bgClass: "bg-amber-100", accentHex: "#D97706" },
  { id: "snake", name: "\u0E19\u0E49\u0E2D\u0E07\u0E07\u0E39", imagePath: "/assets/aistudio/Snake_a97297a1.png", bgClass: "bg-lime-100", accentHex: "#65A30D" },
  { id: "tiger", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E37\u0E2D", imagePath: "/assets/aistudio/Tiger_de37bd62.png", bgClass: "bg-orange-100", accentHex: "#EA580C" }
];

// src/shared/quizLogic.ts
function generateRoomCode(existingCodes) {
  if (existingCodes.size >= 9e3) {
    throw new Error("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E49\u0E2D\u0E07\u0E27\u0E48\u0E32\u0E07\u0E43\u0E19\u0E02\u0E13\u0E30\u0E19\u0E35\u0E49");
  }
  for (let i = 0; i < 100; i++) {
    const code = String(Math.floor(1e3 + Math.random() * 9e3));
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  for (let num = 1e3; num <= 9999; num++) {
    const code = String(num);
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E49\u0E2D\u0E07 4 \u0E2B\u0E25\u0E31\u0E01\u0E44\u0E14\u0E49");
}
function isValidRoomCode(code) {
  return /^\d{4}$/.test(code.trim());
}
function isValidAvatarId(avatarId) {
  return AVATARS.some((a) => a.id === avatarId);
}
function calculatePoints(params) {
  if (!params.isCorrect) {
    return 0;
  }
  const safeTotal = Math.max(1e3, params.totalMs);
  const clampedRemaining = Math.max(0, Math.min(safeTotal, params.remainingMs));
  const ratio = clampedRemaining / safeTotal;
  const basePoints = 500;
  const speedBonus = Math.round(500 * ratio);
  const streakBonus = Math.min(250, Math.max(0, params.streak - 1) * 50);
  return basePoints + speedBonus + streakBonus;
}
function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    return a.name.localeCompare(b.name, "th");
  });
  return sorted.map((p, index) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    score: p.score,
    streak: p.streak,
    bestStreak: p.bestStreak,
    correctCount: p.correctCount,
    answeredCount: p.answeredCount,
    lastPoints: p.lastPoints,
    lastCorrect: p.lastCorrect,
    lastChoice: p.lastChoice,
    rank: index + 1,
    connected: p.connected
  }));
}

// src/server/roomManager.ts
var RoomManager = class {
  constructor() {
    this.rooms = /* @__PURE__ */ new Map();
  }
  getRoomCount() {
    return this.rooms.size;
  }
  getRoom(code) {
    return this.rooms.get(code.trim());
  }
  createRoom(quiz, now = Date.now()) {
    if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      throw new Error("\u0E0A\u0E38\u0E14\u0E04\u0E33\u0E16\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22 1 \u0E02\u0E49\u0E2D");
    }
    const existing = new Set(this.rooms.keys());
    const code = generateRoomCode(existing);
    const hostToken = `host-${Math.random().toString(36).slice(2)}-${now.toString(36)}`;
    const sanitizedQuiz = {
      id: quiz.id || `quiz-${now}`,
      title: (quiz.title || "\u0E40\u0E01\u0E21\u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B").trim(),
      description: (quiz.description || "").trim(),
      questions: quiz.questions.map((q, idx) => ({
        id: q.id || `q-${idx + 1}`,
        text: q.text.trim(),
        options: [
          q.options[0]?.trim() || "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01 A",
          q.options[1]?.trim() || "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01 B",
          q.options[2]?.trim() || "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01 C",
          q.options[3]?.trim() || "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01 D"
        ],
        correctIndex: [0, 1, 2, 3].includes(q.correctIndex) ? q.correctIndex : 0,
        timeLimitSec: Math.max(5, Math.min(180, Math.round(q.timeLimitSec || 20))),
        imageUrl: q.imageUrl?.trim() || void 0,
        videoUrl: q.videoUrl?.trim() || void 0
      }))
    };
    const room = {
      code,
      hostToken,
      quiz: sanitizedQuiz,
      phase: "LOBBY",
      currentQuestionIndex: -1,
      questionStartedAt: null,
      questionEndsAt: null,
      remainingSec: 0,
      answersThisQuestion: /* @__PURE__ */ new Map(),
      answerCounts: [0, 0, 0, 0],
      players: /* @__PURE__ */ new Map(),
      createdAt: now
    };
    this.rooms.set(code, room);
    return room;
  }
  deleteRoom(code) {
    this.rooms.delete(code.trim());
  }
  checkRoomStatus(code) {
    const cleanCode = code.trim();
    if (!isValidRoomCode(cleanCode)) {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: "\u0E23\u0E2B\u0E31\u0E2A\u0E2B\u0E49\u0E2D\u0E07\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02 4 \u0E2B\u0E25\u0E31\u0E01"
      };
    }
    const room = this.rooms.get(cleanCode);
    if (!room) {
      return {
        code: cleanCode,
        exists: false,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E41\u0E02\u0E48\u0E07\u0E02\u0E31\u0E19\u0E19\u0E35\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"
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
      error: isFull ? `\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E15\u0E47\u0E21\u0E41\u0E25\u0E49\u0E27 (\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 ${MAX_PLAYERS_PER_ROOM} \u0E04\u0E19)` : void 0
    };
  }
  joinPlayer(params) {
    const cleanCode = params.code.trim();
    const room = this.rooms.get(cleanCode);
    if (!room) {
      throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E41\u0E02\u0E48\u0E07\u0E02\u0E31\u0E19\u0E19\u0E35\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E23\u0E2B\u0E31\u0E2A 4 \u0E2B\u0E25\u0E31\u0E01");
    }
    const cleanName = params.name.trim().slice(0, 24);
    if (!cleanName) {
      throw new Error("\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E02\u0E49\u0E32\u0E2B\u0E49\u0E2D\u0E07");
    }
    const avatarId = isValidAvatarId(params.avatarId) ? params.avatarId : "dog";
    if (params.playerId && room.players.has(params.playerId)) {
      const existing = room.players.get(params.playerId);
      existing.name = cleanName;
      existing.avatarId = avatarId;
      existing.connected = true;
      return { room, player: existing };
    }
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      throw new Error(`\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E15\u0E47\u0E21\u0E41\u0E25\u0E49\u0E27 (\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E40\u0E25\u0E48\u0E19\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 ${MAX_PLAYERS_PER_ROOM} \u0E04\u0E19\u0E15\u0E48\u0E2D\u0E2B\u0E49\u0E2D\u0E07)`);
    }
    const playerId = `p-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    const player = {
      id: playerId,
      name: cleanName,
      avatarId,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correctCount: 0,
      answeredCount: 0,
      lastPoints: 0,
      lastCorrect: null,
      lastChoice: null,
      connected: true
    };
    room.players.set(playerId, player);
    return { room, player };
  }
  setPlayerConnected(code, playerId, connected) {
    const room = this.rooms.get(code);
    if (!room) return;
    const player = room.players.get(playerId);
    if (player) {
      player.connected = connected;
    }
  }
  startGame(code, now = Date.now()) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (room.quiz.questions.length === 0) throw new Error("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E33\u0E16\u0E32\u0E21\u0E43\u0E19\u0E0A\u0E38\u0E14\u0E19\u0E35\u0E49");
    room.currentQuestionIndex = 0;
    this.beginQuestion(room, now);
    return room;
  }
  nextQuestion(code, now = Date.now()) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    const nextIdx = room.currentQuestionIndex + 1;
    if (nextIdx >= room.quiz.questions.length) {
      room.phase = "ENDED";
      room.questionStartedAt = null;
      room.questionEndsAt = null;
      room.remainingSec = 0;
      return room;
    }
    room.currentQuestionIndex = nextIdx;
    this.beginQuestion(room, now);
    return room;
  }
  beginQuestion(room, now) {
    const q = room.quiz.questions[room.currentQuestionIndex];
    room.phase = "QUESTION";
    room.questionStartedAt = now;
    room.questionEndsAt = now + q.timeLimitSec * 1e3;
    room.remainingSec = q.timeLimitSec;
    room.answersThisQuestion.clear();
    room.answerCounts = [0, 0, 0, 0];
    for (const p of room.players.values()) {
      p.lastPoints = 0;
      p.lastCorrect = null;
      p.lastChoice = null;
    }
  }
  submitAnswer(code, playerId, choice, now = Date.now()) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (room.phase !== "QUESTION") {
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
    const allAnswered = connectedCount > 0 && room.answersThisQuestion.size >= connectedCount;
    return { accepted: true, allAnswered, room };
  }
  tickTimer(code, now = Date.now()) {
    const room = this.rooms.get(code);
    if (!room || room.phase !== "QUESTION" || !room.questionEndsAt) {
      return { changed: false, expired: false, remainingSec: 0, room };
    }
    const remainingMs = Math.max(0, room.questionEndsAt - now);
    const nextSec = Math.ceil(remainingMs / 1e3);
    const changed = nextSec !== room.remainingSec;
    room.remainingSec = nextSec;
    if (remainingMs <= 0) {
      this.revealQuestion(code);
      return { changed: true, expired: true, remainingSec: 0, room };
    }
    return { changed, expired: false, remainingSec: nextSec, room };
  }
  revealQuestion(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (room.phase !== "QUESTION") return room;
    const q = room.quiz.questions[room.currentQuestionIndex];
    const totalMs = q.timeLimitSec * 1e3;
    const endsAt = room.questionEndsAt ?? Date.now();
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
          streak: player.streak
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
    room.phase = "REVEAL";
    room.remainingSec = 0;
    return room;
  }
  showLeaderboard(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (room.phase === "QUESTION") {
      this.revealQuestion(code);
    }
    if (room.currentQuestionIndex >= room.quiz.questions.length - 1) {
      room.phase = "ENDED";
    } else {
      room.phase = "LEADERBOARD";
    }
    return room;
  }
  endGame(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (room.phase === "QUESTION") {
      this.revealQuestion(code);
    }
    room.phase = "ENDED";
    room.remainingSec = 0;
    return room;
  }
  restartRoom(code, newQuiz) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07");
    if (newQuiz && newQuiz.questions.length > 0) {
      room.quiz = newQuiz;
    }
    room.phase = "LOBBY";
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
  toPublicState(room, includeCorrectForHost = false) {
    const ranked = rankPlayers(Array.from(room.players.values()));
    const q = room.currentQuestionIndex >= 0 && room.currentQuestionIndex < room.quiz.questions.length ? room.quiz.questions[room.currentQuestionIndex] : null;
    const showCorrect = includeCorrectForHost || room.phase === "REVEAL" || room.phase === "LEADERBOARD" || room.phase === "ENDED";
    const currentQuestion = q ? {
      id: q.id,
      text: q.text,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      imageUrl: q.imageUrl,
      videoUrl: q.videoUrl,
      ...showCorrect ? { correctIndex: q.correctIndex } : {}
    } : null;
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
      answerCounts: [...room.answerCounts],
      players: ranked,
      topPlayers: ranked.slice(0, 10)
    };
  }
};

// server.ts
var PORT = Number(process.env.PORT || 3e3);
var isProduction = process.env.NODE_ENV === "production";
var app = express();
app.use(express.json({ limit: "16mb" }));
var mediaStore = /* @__PURE__ */ new Map();
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, rooms: roomManager.getRoomCount() });
});
app.post("/api/media", (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl || typeof dataUrl !== "string") {
    res.status(400).json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E37\u0E48\u0E2D" });
    return;
  }
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    res.status(400).json({ error: "\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
    return;
  }
  const mimeType = match[1];
  const allowedPrefix = mimeType.startsWith("image/") || mimeType.startsWith("video/");
  if (!allowedPrefix) {
    res.status(400).json({ error: "\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E44\u0E1F\u0E25\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" });
    return;
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 12 * 1024 * 1024) {
    res.status(413).json({ error: "\u0E44\u0E1F\u0E25\u0E4C\u0E21\u0E35\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E01\u0E34\u0E19 12 MB" });
    return;
  }
  if (mediaStore.size > 100) {
    const oldestKey = mediaStore.keys().next().value;
    if (oldestKey) mediaStore.delete(oldestKey);
  }
  const id = `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  mediaStore.set(id, { mimeType, buffer, createdAt: Date.now() });
  res.json({ url: `/api/media/${id}` });
});
app.get("/api/media/:id", (req, res) => {
  const item = mediaStore.get(req.params.id);
  if (!item) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Type", item.mimeType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(item.buffer);
});
var server = http.createServer(app);
var wss = new WebSocketServer({ server, path: "/ws" });
var roomManager = new RoomManager();
var sessions = /* @__PURE__ */ new Map();
var roomSockets = /* @__PURE__ */ new Map();
var roomIntervals = /* @__PURE__ */ new Map();
function sendToSocket(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
function addSocketToRoom(code, ws) {
  let set = roomSockets.get(code);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    roomSockets.set(code, set);
  }
  set.add(ws);
}
function removeSocketFromRoom(code, ws) {
  const set = roomSockets.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    roomSockets.delete(code);
  }
}
function broadcastRoomState(code) {
  const room = roomManager.getRoom(code);
  const sockets = roomSockets.get(code);
  if (!room || !sockets) return;
  const hostPayload = JSON.stringify({
    type: "room:state",
    state: roomManager.toPublicState(room, true)
  });
  const playerStateBase = roomManager.toPublicState(room, false);
  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const sess = sessions.get(ws);
    if (sess?.role === "host") {
      ws.send(hostPayload);
    } else {
      ws.send(
        JSON.stringify({
          type: "room:state",
          state: playerStateBase,
          yourPlayerId: sess?.playerId ?? void 0
        })
      );
    }
  }
}
function broadcastProgress(code) {
  const room = roomManager.getRoom(code);
  const sockets = roomSockets.get(code);
  if (!room || !sockets) return;
  const payload = JSON.stringify({
    type: "room:progress",
    answeredCount: room.answersThisQuestion.size,
    totalPlayers: room.players.size,
    answerCounts: [...room.answerCounts],
    remainingSec: room.remainingSec
  });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
function broadcastTick(code, remainingSec) {
  const sockets = roomSockets.get(code);
  if (!sockets) return;
  const payload = JSON.stringify({
    type: "room:tick",
    remainingSec
  });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}
function stopQuestionTimer(code) {
  const existing = roomIntervals.get(code);
  if (existing) {
    clearInterval(existing);
    roomIntervals.delete(code);
  }
}
function startQuestionTimer(code) {
  stopQuestionTimer(code);
  const timer = setInterval(() => {
    const res = roomManager.tickTimer(code);
    if (res.expired) {
      stopQuestionTimer(code);
      broadcastRoomState(code);
    } else if (res.changed) {
      broadcastTick(code, res.remainingSec);
    }
  }, 250);
  roomIntervals.set(code, timer);
}
wss.on("connection", (ws) => {
  const session = {
    ws,
    role: null,
    roomCode: null,
    playerId: null,
    hostToken: null
  };
  sessions.set(ws, session);
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendToSocket(ws, { type: "error", message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      return;
    }
    try {
      switch (msg.type) {
        case "host:create": {
          if (session.roomCode) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          const room = roomManager.createRoom(msg.quiz);
          session.role = "host";
          session.roomCode = room.code;
          session.hostToken = room.hostToken;
          session.playerId = null;
          addSocketToRoom(room.code, ws);
          sendToSocket(ws, {
            type: "host:created",
            code: room.code,
            hostToken: room.hostToken,
            state: roomManager.toPublicState(room, true)
          });
          break;
        }
        case "host:reconnect": {
          const room = roomManager.getRoom(msg.code);
          if (!room || room.hostToken !== msg.hostToken) {
            sendToSocket(ws, { type: "error", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E42\u0E2E\u0E2A\u0E15\u0E4C\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38" });
            return;
          }
          if (session.roomCode) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          session.role = "host";
          session.roomCode = room.code;
          session.hostToken = room.hostToken;
          addSocketToRoom(room.code, ws);
          sendToSocket(ws, {
            type: "room:state",
            state: roomManager.toPublicState(room, true)
          });
          break;
        }
        case "host:start": {
          if (session.role !== "host" || !session.roomCode) return;
          roomManager.startGame(session.roomCode);
          startQuestionTimer(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }
        case "host:reveal": {
          if (session.role !== "host" || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.revealQuestion(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }
        case "host:leaderboard": {
          if (session.role !== "host" || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.showLeaderboard(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }
        case "host:next": {
          if (session.role !== "host" || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          const room = roomManager.nextQuestion(session.roomCode);
          if (room.phase === "QUESTION") {
            startQuestionTimer(session.roomCode);
          }
          broadcastRoomState(session.roomCode);
          break;
        }
        case "host:end": {
          if (session.role !== "host" || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.endGame(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }
        case "host:restart": {
          if (session.role !== "host" || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.restartRoom(session.roomCode, msg.quiz);
          broadcastRoomState(session.roomCode);
          break;
        }
        case "player:check_room": {
          const status = roomManager.checkRoomStatus(msg.code);
          sendToSocket(ws, {
            type: "player:room_status",
            ...status
          });
          break;
        }
        case "player:join": {
          const { room, player } = roomManager.joinPlayer({
            code: msg.code,
            name: msg.name,
            avatarId: msg.avatarId,
            playerId: msg.playerId
          });
          if (session.roomCode && session.roomCode !== room.code) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          session.role = "player";
          session.roomCode = room.code;
          session.playerId = player.id;
          addSocketToRoom(room.code, ws);
          sendToSocket(ws, {
            type: "player:joined",
            playerId: player.id,
            state: roomManager.toPublicState(room, false)
          });
          broadcastRoomState(room.code);
          break;
        }
        case "player:answer": {
          if (session.role !== "player" || !session.roomCode || !session.playerId) return;
          const result = roomManager.submitAnswer(
            session.roomCode,
            session.playerId,
            msg.choice
          );
          if (result.accepted) {
            sendToSocket(ws, { type: "player:answer_ack", choice: msg.choice });
            if (result.allAnswered) {
              stopQuestionTimer(session.roomCode);
              roomManager.revealQuestion(session.roomCode);
              broadcastRoomState(session.roomCode);
            } else {
              broadcastProgress(session.roomCode);
            }
          }
          break;
        }
      }
    } catch (err) {
      sendToSocket(ws, {
        type: "error",
        message: err instanceof Error ? err.message : "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E04\u0E32\u0E14\u0E04\u0E34\u0E14"
      });
    }
  });
  ws.on("close", () => {
    if (session.roomCode) {
      if (session.role === "player" && session.playerId) {
        roomManager.setPlayerConnected(session.roomCode, session.playerId, false);
        broadcastRoomState(session.roomCode);
      }
      removeSocketFromRoom(session.roomCode, ws);
    }
    sessions.delete(ws);
  });
});
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found");
      }
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`QuizArena Live server listening on http://localhost:${PORT}`);
  });
}
startServer();
