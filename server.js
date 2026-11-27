// server.ts
import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";

// src/shared/types.ts
var MAX_PLAYERS_PER_ROOM = 200;
var AVATARS = [
  { id: "char_01", name: "\u0E19\u0E49\u0E2D\u0E07\u0E41\u0E27\u0E48\u0E19\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E27", imagePath: "/assets/aistudio/1_d7a74ebc.jpg", bgClass: "bg-sky-100", accentHex: "#0EA5E9" },
  { id: "char_02", name: "\u0E19\u0E49\u0E2D\u0E07\u0E42\u0E1A\u0E27\u0E4C\u0E0A\u0E21\u0E1E\u0E39", imagePath: "/assets/aistudio/2_0db288ca.jpg", bgClass: "bg-sky-100", accentHex: "#EC4899" },
  { id: "char_03", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2E\u0E39\u0E49\u0E14\u0E2A\u0E49\u0E21", imagePath: "/assets/aistudio/3_43852fcc.jpg", bgClass: "bg-orange-100", accentHex: "#F97316" },
  { id: "char_04", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E14\u0E32\u0E27\u0E21\u0E48\u0E27\u0E07", imagePath: "/assets/aistudio/4_ea160a01.jpg", bgClass: "bg-purple-100", accentHex: "#A855F7" },
  { id: "char_05", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E21\u0E27\u0E01\u0E41\u0E01\u0E4A\u0E1B\u0E40\u0E02\u0E35\u0E22\u0E27", imagePath: "/assets/aistudio/5_4381ac4c.jpg", bgClass: "bg-emerald-100", accentHex: "#10B981" },
  { id: "char_06", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E2D\u0E35\u0E4A\u0E22\u0E21\u0E22\u0E35\u0E19\u0E2A\u0E4C", imagePath: "/assets/aistudio/6_feb3a696.jpg", bgClass: "bg-pink-100", accentHex: "#EC4899" },
  { id: "char_07", name: "\u0E19\u0E49\u0E2D\u0E07\u0E1C\u0E21\u0E15\u0E31\u0E49\u0E07\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1F\u0E49\u0E32", imagePath: "/assets/aistudio/7_65e65de4.jpg", bgClass: "bg-blue-100", accentHex: "#3B82F6" },
  { id: "char_08", name: "\u0E19\u0E49\u0E2D\u0E07\u0E41\u0E27\u0E48\u0E19\u0E42\u0E1B\u0E42\u0E25\u0E1F\u0E49\u0E32", imagePath: "/assets/aistudio/8_f6576340.jpg", bgClass: "bg-cyan-100", accentHex: "#06B6D4" },
  { id: "char_09", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E35\u0E22\u0E0A\u0E38\u0E14\u0E41\u0E14\u0E07", imagePath: "/assets/aistudio/9_0eac9d0a.jpg", bgClass: "bg-rose-100", accentHex: "#F43F5E" },
  { id: "char_10", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E39\u0E1F\u0E31\u0E07\u0E40\u0E17\u0E48", imagePath: "/assets/aistudio/10_20cce168.jpg", bgClass: "bg-slate-200", accentHex: "#64748B" },
  { id: "char_11", name: "\u0E19\u0E49\u0E2D\u0E07\u0E44\u0E2B\u0E21\u0E1E\u0E23\u0E21\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07", imagePath: "/assets/aistudio/11_def2bfdc.jpg", bgClass: "bg-yellow-100", accentHex: "#EAB308" },
  { id: "char_12", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E41\u0E14\u0E07\u0E40\u0E02\u0E49\u0E21", imagePath: "/assets/aistudio/12_19d1dc9a.jpg", bgClass: "bg-sky-100", accentHex: "#E11D48" },
  { id: "char_13", name: "\u0E19\u0E49\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E42\u0E1B\u0E23\u0E07\u0E02\u0E32\u0E27", imagePath: "/assets/aistudio/13_8c7ac19c.jpg", bgClass: "bg-pink-100", accentHex: "#EC4899" },
  { id: "char_14", name: "\u0E19\u0E49\u0E2D\u0E07\u0E41\u0E27\u0E48\u0E19\u0E0A\u0E38\u0E14\u0E40\u0E02\u0E35\u0E22\u0E27", imagePath: "/assets/aistudio/14_7a8344ae.jpg", bgClass: "bg-emerald-100", accentHex: "#10B981" },
  { id: "char_15", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2E\u0E39\u0E49\u0E14\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07", imagePath: "/assets/aistudio/15_18a93aa2.jpg", bgClass: "bg-emerald-100", accentHex: "#F59E0B" },
  { id: "char_16", name: "\u0E19\u0E49\u0E2D\u0E07\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1F\u0E49\u0E32", imagePath: "/assets/aistudio/16_42a4af2c.jpg", bgClass: "bg-sky-100", accentHex: "#0EA5E9" },
  { id: "char_17", name: "\u0E19\u0E49\u0E2D\u0E07\u0E21\u0E31\u0E14\u0E08\u0E38\u0E01\u0E04\u0E39\u0E48", imagePath: "/assets/aistudio/17_634da5f8.jpg", bgClass: "bg-amber-100", accentHex: "#8B5CF6" },
  { id: "char_18", name: "\u0E19\u0E49\u0E2D\u0E07\u0E2B\u0E21\u0E27\u0E01\u0E2A\u0E49\u0E21", imagePath: "/assets/aistudio/18_e19f7f1c.jpg", bgClass: "bg-indigo-100", accentHex: "#EA580C" },
  { id: "char_19", name: "\u0E19\u0E49\u0E2D\u0E07\u0E1C\u0E49\u0E32\u0E04\u0E32\u0E14\u0E2B\u0E31\u0E27\u0E2A\u0E49\u0E21", imagePath: "/assets/aistudio/20_a8878a73.jpg", bgClass: "bg-pink-100", accentHex: "#F97316" }
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
    const avatarId = isValidAvatarId(params.avatarId) ? params.avatarId : "char_01";
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
var portArgIdx = process.argv.indexOf("--port");
var cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
var PORT = Number.isFinite(cliPort) ? cliPort : Number(process.env.PORT || 3e3);
var distDir = path.resolve(process.cwd(), "dist");
var isProduction = process.env.NODE_ENV === "production" || Boolean(process.argv[1]?.endsWith("server.js")) && fs.existsSync(path.join(distDir, "index.html"));
var app = express();
app.use(express.json({ limit: "16mb" }));
var mediaStore = /* @__PURE__ */ new Map();
var roomManager = new RoomManager();
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
var wsSessions = /* @__PURE__ */ new Map();
var roomWsSockets = /* @__PURE__ */ new Map();
var roomSseClients = /* @__PURE__ */ new Map();
var roomIntervals = /* @__PURE__ */ new Map();
function sendToSocket(ws, msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
function sendToSse(client, msg) {
  if (!client.res.writableEnded) {
    client.res.write(`data: ${JSON.stringify(msg)}

`);
  }
}
function addWsToRoom(code, ws) {
  let set = roomWsSockets.get(code);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    roomWsSockets.set(code, set);
  }
  set.add(ws);
}
function removeWsFromRoom(code, ws) {
  const set = roomWsSockets.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    roomWsSockets.delete(code);
  }
}
function addSseToRoom(code, client) {
  let set = roomSseClients.get(code);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    roomSseClients.set(code, set);
  }
  set.add(client);
}
function removeSseFromRoom(code, client) {
  const set = roomSseClients.get(code);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) {
    roomSseClients.delete(code);
  }
}
function broadcastRoomState(code) {
  const room = roomManager.getRoom(code);
  if (!room) return;
  const hostState = roomManager.toPublicState(room, true);
  const hostPayload = JSON.stringify({
    type: "room:state",
    state: hostState
  });
  const playerStateBase = roomManager.toPublicState(room, false);
  const wsSet = roomWsSockets.get(code);
  if (wsSet) {
    for (const ws of wsSet) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const sess = wsSessions.get(ws);
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
  const sseSet = roomSseClients.get(code);
  if (sseSet) {
    for (const client of sseSet) {
      if (client.res.writableEnded) continue;
      if (client.role === "host") {
        client.res.write(`data: ${hostPayload}

`);
      } else {
        sendToSse(client, {
          type: "room:state",
          state: playerStateBase,
          yourPlayerId: client.playerId ?? void 0
        });
      }
    }
  }
}
function broadcastProgress(code) {
  const room = roomManager.getRoom(code);
  if (!room) return;
  const payload = JSON.stringify({
    type: "room:progress",
    answeredCount: room.answersThisQuestion.size,
    totalPlayers: room.players.size,
    answerCounts: [...room.answerCounts],
    remainingSec: room.remainingSec
  });
  const wsSet = roomWsSockets.get(code);
  if (wsSet) {
    for (const ws of wsSet) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
  const sseSet = roomSseClients.get(code);
  if (sseSet) {
    for (const client of sseSet) {
      if (!client.res.writableEnded) {
        client.res.write(`data: ${payload}

`);
      }
    }
  }
}
function broadcastTick(code, remainingSec) {
  const payload = JSON.stringify({
    type: "room:tick",
    remainingSec
  });
  const wsSet = roomWsSockets.get(code);
  if (wsSet) {
    for (const ws of wsSet) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
  const sseSet = roomSseClients.get(code);
  if (sseSet) {
    for (const client of sseSet) {
      if (!client.res.writableEnded) {
        client.res.write(`data: ${payload}

`);
      }
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
function processClientMessage(msg, ctx, ws) {
  switch (msg.type) {
    case "host:create": {
      if (ws && ctx.roomCode) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      const room = roomManager.createRoom(msg.quiz);
      ctx.role = "host";
      ctx.roomCode = room.code;
      ctx.hostToken = room.hostToken;
      ctx.playerId = null;
      if (ws) addWsToRoom(room.code, ws);
      return {
        type: "host:created",
        code: room.code,
        hostToken: room.hostToken,
        state: roomManager.toPublicState(room, true)
      };
    }
    case "host:reconnect": {
      const room = roomManager.getRoom(msg.code);
      if (!room || room.hostToken !== msg.hostToken) {
        return { type: "error", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E42\u0E2E\u0E2A\u0E15\u0E4C\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38" };
      }
      if (ws && ctx.roomCode) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      ctx.role = "host";
      ctx.roomCode = room.code;
      ctx.hostToken = room.hostToken;
      if (ws) addWsToRoom(room.code, ws);
      return {
        type: "room:state",
        state: roomManager.toPublicState(room, true)
      };
    }
    case "host:start": {
      if (ctx.role !== "host" || !ctx.roomCode) {
        return { type: "error", message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E42\u0E2E\u0E2A\u0E15\u0E4C\u0E02\u0E2D\u0E07\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E35\u0E49" };
      }
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) {
        return { type: "error", message: "\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E42\u0E2E\u0E2A\u0E15\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" };
      }
      roomManager.startGame(ctx.roomCode);
      startQuestionTimer(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "host:reveal": {
      if (ctx.role !== "host" || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.revealQuestion(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "host:leaderboard": {
      if (ctx.role !== "host" || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.showLeaderboard(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "host:next": {
      if (ctx.role !== "host" || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) return null;
      stopQuestionTimer(ctx.roomCode);
      const nextRoom = roomManager.nextQuestion(ctx.roomCode);
      if (nextRoom.phase === "QUESTION") {
        startQuestionTimer(ctx.roomCode);
      }
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "host:end": {
      if (ctx.role !== "host" || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.endGame(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "host:restart": {
      if (ctx.role !== "host" || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || ctx.hostToken && room.hostToken !== ctx.hostToken) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.restartRoom(ctx.roomCode, msg.quiz);
      broadcastRoomState(ctx.roomCode);
      return null;
    }
    case "player:check_room": {
      const status = roomManager.checkRoomStatus(msg.code);
      return {
        type: "player:room_status",
        ...status
      };
    }
    case "player:join": {
      const { room, player } = roomManager.joinPlayer({
        code: msg.code,
        name: msg.name,
        avatarId: msg.avatarId,
        playerId: msg.playerId
      });
      if (ws && ctx.roomCode && ctx.roomCode !== room.code) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      ctx.role = "player";
      ctx.roomCode = room.code;
      ctx.playerId = player.id;
      if (ws) addWsToRoom(room.code, ws);
      const joinedReply = {
        type: "player:joined",
        playerId: player.id,
        state: roomManager.toPublicState(room, false)
      };
      broadcastRoomState(room.code);
      return joinedReply;
    }
    case "player:answer": {
      if (ctx.role !== "player" || !ctx.roomCode || !ctx.playerId) return null;
      const result = roomManager.submitAnswer(
        ctx.roomCode,
        ctx.playerId,
        msg.choice
      );
      if (result.accepted) {
        if (result.allAnswered) {
          stopQuestionTimer(ctx.roomCode);
          roomManager.revealQuestion(ctx.roomCode);
          broadcastRoomState(ctx.roomCode);
        } else {
          broadcastProgress(ctx.roomCode);
        }
        return { type: "player:answer_ack", choice: msg.choice };
      }
      return null;
    }
  }
}
app.get("/api/events", (req, res) => {
  const code = String(req.query.code || "").trim();
  const role = req.query.role === "host" ? "host" : "player";
  const hostToken = req.query.hostToken ? String(req.query.hostToken) : null;
  const playerId = req.query.playerId ? String(req.query.playerId) : null;
  const room = roomManager.getRoom(code);
  if (!room) {
    res.status(404).json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E41\u0E02\u0E48\u0E07\u0E02\u0E31\u0E19" });
    return;
  }
  if (role === "host" && room.hostToken !== hostToken) {
    res.status(403).json({ error: "\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E42\u0E2E\u0E2A\u0E15\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const client = {
    res,
    role,
    roomCode: code,
    hostToken,
    playerId
  };
  if (role === "player" && playerId) {
    roomManager.setPlayerConnected(code, playerId, true);
  }
  addSseToRoom(code, client);
  sendToSse(client, {
    type: "room:state",
    state: roomManager.toPublicState(room, role === "host"),
    yourPlayerId: playerId ?? void 0
  });
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(": ping\n\n");
    }
  }, 15e3);
  req.on("close", () => {
    clearInterval(keepAlive);
    removeSseFromRoom(code, client);
    if (role === "player" && playerId) {
      roomManager.setPlayerConnected(code, playerId, false);
      broadcastRoomState(code);
    }
  });
});
app.post("/api/action", (req, res) => {
  const body = req.body;
  if (!body || !body.message) {
    res.status(400).json({ type: "error", message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
    return;
  }
  const ctx = {
    role: body.context?.role ?? null,
    roomCode: body.context?.roomCode ?? null,
    playerId: body.context?.playerId ?? null,
    hostToken: body.context?.hostToken ?? null
  };
  try {
    const reply = processClientMessage(body.message, ctx);
    res.json(reply ?? { ok: true });
  } catch (err) {
    res.status(400).json({
      type: "error",
      message: err instanceof Error ? err.message : "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E04\u0E32\u0E14\u0E04\u0E34\u0E14"
    });
  }
});
wss.on("connection", (ws) => {
  const session = {
    role: null,
    roomCode: null,
    playerId: null,
    hostToken: null
  };
  wsSessions.set(ws, session);
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendToSocket(ws, { type: "error", message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
      return;
    }
    try {
      const reply = processClientMessage(msg, session, ws);
      if (reply) {
        sendToSocket(ws, reply);
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
      removeWsFromRoom(session.roomCode, ws);
    }
    wsSessions.delete(ws);
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
