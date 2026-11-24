import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './src/server/roomManager';
import { ClientMessage, ServerMessage } from './src/shared/types';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '16mb' }));

// In-memory media store for moderator-uploaded images/videos so WebSocket payloads stay compact
const mediaStore = new Map<string, { mimeType: string; buffer: Buffer; createdAt: number }>();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: roomManager.getRoomCount() });
});

app.post('/api/media', (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'ไม่พบข้อมูลไฟล์สื่อ' });
    return;
  }

  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    res.status(400).json({ error: 'รูปแบบไฟล์ไม่ถูกต้อง' });
    return;
  }

  const mimeType = match[1];
  const allowedPrefix = mimeType.startsWith('image/') || mimeType.startsWith('video/');
  if (!allowedPrefix) {
    res.status(400).json({ error: 'รองรับเฉพาะไฟล์รูปภาพหรือวิดีโอเท่านั้น' });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 12 * 1024 * 1024) {
    res.status(413).json({ error: 'ไฟล์มีขนาดใหญ่เกิน 12 MB' });
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

app.get('/api/media/:id', (req, res) => {
  const item = mediaStore.get(req.params.id);
  if (!item) {
    res.status(404).send('Not found');
    return;
  }
  res.setHeader('Content-Type', item.mimeType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(item.buffer);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const roomManager = new RoomManager();

interface SocketSession {
  ws: WebSocket;
  role: 'host' | 'player' | null;
  roomCode: string | null;
  playerId: string | null;
  hostToken: string | null;
}

const sessions = new Map<WebSocket, SocketSession>();
const roomSockets = new Map<string, Set<WebSocket>>();
const roomIntervals = new Map<string, NodeJS.Timeout>();

function sendToSocket(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function addSocketToRoom(code: string, ws: WebSocket): void {
  let set = roomSockets.get(code);
  if (!set) {
    set = new Set();
    roomSockets.set(code, set);
  }
  set.add(ws);
}

function removeSocketFromRoom(code: string, ws: WebSocket): void {
  const set = roomSockets.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    roomSockets.delete(code);
  }
}

function broadcastRoomState(code: string): void {
  const room = roomManager.getRoom(code);
  const sockets = roomSockets.get(code);
  if (!room || !sockets) return;

  const hostPayload = JSON.stringify({
    type: 'room:state',
    state: roomManager.toPublicState(room, true),
  } satisfies ServerMessage);

  const playerStateBase = roomManager.toPublicState(room, false);

  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const sess = sessions.get(ws);
    if (sess?.role === 'host') {
      ws.send(hostPayload);
    } else {
      ws.send(
        JSON.stringify({
          type: 'room:state',
          state: playerStateBase,
          yourPlayerId: sess?.playerId ?? undefined,
        } satisfies ServerMessage)
      );
    }
  }
}

function broadcastProgress(code: string): void {
  const room = roomManager.getRoom(code);
  const sockets = roomSockets.get(code);
  if (!room || !sockets) return;

  const payload = JSON.stringify({
    type: 'room:progress',
    answeredCount: room.answersThisQuestion.size,
    totalPlayers: room.players.size,
    answerCounts: [...room.answerCounts] as [number, number, number, number],
    remainingSec: room.remainingSec,
  } satisfies ServerMessage);

  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastTick(code: string, remainingSec: number): void {
  const sockets = roomSockets.get(code);
  if (!sockets) return;
  const payload = JSON.stringify({
    type: 'room:tick',
    remainingSec,
  } satisfies ServerMessage);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function stopQuestionTimer(code: string): void {
  const existing = roomIntervals.get(code);
  if (existing) {
    clearInterval(existing);
    roomIntervals.delete(code);
  }
}

function startQuestionTimer(code: string): void {
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

wss.on('connection', (ws) => {
  const session: SocketSession = {
    ws,
    role: null,
    roomCode: null,
    playerId: null,
    hostToken: null,
  };
  sessions.set(ws, session);

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      sendToSocket(ws, { type: 'error', message: 'ข้อมูลที่ส่งไม่ถูกต้อง' });
      return;
    }

    try {
      switch (msg.type) {
        case 'host:create': {
          if (session.roomCode) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          const room = roomManager.createRoom(msg.quiz);
          session.role = 'host';
          session.roomCode = room.code;
          session.hostToken = room.hostToken;
          session.playerId = null;
          addSocketToRoom(room.code, ws);

          sendToSocket(ws, {
            type: 'host:created',
            code: room.code,
            hostToken: room.hostToken,
            state: roomManager.toPublicState(room, true),
          });
          break;
        }

        case 'host:reconnect': {
          const room = roomManager.getRoom(msg.code);
          if (!room || room.hostToken !== msg.hostToken) {
            sendToSocket(ws, { type: 'error', message: 'ไม่พบห้องหรือสิทธิ์โฮสต์หมดอายุ' });
            return;
          }
          if (session.roomCode) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          session.role = 'host';
          session.roomCode = room.code;
          session.hostToken = room.hostToken;
          addSocketToRoom(room.code, ws);
          sendToSocket(ws, {
            type: 'room:state',
            state: roomManager.toPublicState(room, true),
          });
          break;
        }

        case 'host:start': {
          if (session.role !== 'host' || !session.roomCode) return;
          roomManager.startGame(session.roomCode);
          startQuestionTimer(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'host:reveal': {
          if (session.role !== 'host' || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.revealQuestion(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'host:leaderboard': {
          if (session.role !== 'host' || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.showLeaderboard(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'host:next': {
          if (session.role !== 'host' || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          const room = roomManager.nextQuestion(session.roomCode);
          if (room.phase === 'QUESTION') {
            startQuestionTimer(session.roomCode);
          }
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'host:end': {
          if (session.role !== 'host' || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.endGame(session.roomCode);
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'host:restart': {
          if (session.role !== 'host' || !session.roomCode) return;
          stopQuestionTimer(session.roomCode);
          roomManager.restartRoom(session.roomCode, msg.quiz);
          broadcastRoomState(session.roomCode);
          break;
        }

        case 'player:check_room': {
          const status = roomManager.checkRoomStatus(msg.code);
          sendToSocket(ws, {
            type: 'player:room_status',
            ...status,
          });
          break;
        }

        case 'player:join': {
          const { room, player } = roomManager.joinPlayer({
            code: msg.code,
            name: msg.name,
            avatarId: msg.avatarId,
            playerId: msg.playerId,
          });
          if (session.roomCode && session.roomCode !== room.code) {
            removeSocketFromRoom(session.roomCode, ws);
          }
          session.role = 'player';
          session.roomCode = room.code;
          session.playerId = player.id;
          addSocketToRoom(room.code, ws);

          sendToSocket(ws, {
            type: 'player:joined',
            playerId: player.id,
            state: roomManager.toPublicState(room, false),
          });
          broadcastRoomState(room.code);
          break;
        }

        case 'player:answer': {
          if (session.role !== 'player' || !session.roomCode || !session.playerId) return;
          const result = roomManager.submitAnswer(
            session.roomCode,
            session.playerId,
            msg.choice
          );
          if (result.accepted) {
            sendToSocket(ws, { type: 'player:answer_ack', choice: msg.choice });
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
        type: 'error',
        message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
      });
    }
  });

  ws.on('close', () => {
    if (session.roomCode) {
      if (session.role === 'player' && session.playerId) {
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
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizArena Live server listening on http://localhost:${PORT}`);
  });
}

startServer();
