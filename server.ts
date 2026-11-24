import express, { Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './src/server/roomManager';
import { ClientMessage, ServerMessage } from './src/shared/types';

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT = Number.isFinite(cliPort) ? cliPort : Number(process.env.PORT || 3000);

const distDir = path.resolve(process.cwd(), 'dist');
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (Boolean(process.argv[1]?.endsWith('server.js')) && fs.existsSync(path.join(distDir, 'index.html')));

const app = express();
app.use(express.json({ limit: '16mb' }));

// In-memory media store for moderator-uploaded images/videos so WebSocket payloads stay compact
const mediaStore = new Map<string, { mimeType: string; buffer: Buffer; createdAt: number }>();

const roomManager = new RoomManager();

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

interface ClientContext {
  role: 'host' | 'player' | null;
  roomCode: string | null;
  playerId: string | null;
  hostToken: string | null;
}

interface SseClient extends ClientContext {
  res: Response;
}

const wsSessions = new Map<WebSocket, ClientContext>();
const roomWsSockets = new Map<string, Set<WebSocket>>();
const roomSseClients = new Map<string, Set<SseClient>>();
const roomIntervals = new Map<string, NodeJS.Timeout>();

function sendToSocket(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendToSse(client: SseClient, msg: ServerMessage): void {
  if (!client.res.writableEnded) {
    client.res.write(`data: ${JSON.stringify(msg)}\n\n`);
  }
}

function addWsToRoom(code: string, ws: WebSocket): void {
  let set = roomWsSockets.get(code);
  if (!set) {
    set = new Set();
    roomWsSockets.set(code, set);
  }
  set.add(ws);
}

function removeWsFromRoom(code: string, ws: WebSocket): void {
  const set = roomWsSockets.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    roomWsSockets.delete(code);
  }
}

function addSseToRoom(code: string, client: SseClient): void {
  let set = roomSseClients.get(code);
  if (!set) {
    set = new Set();
    roomSseClients.set(code, set);
  }
  set.add(client);
}

function removeSseFromRoom(code: string, client: SseClient): void {
  const set = roomSseClients.get(code);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) {
    roomSseClients.delete(code);
  }
}

function broadcastRoomState(code: string): void {
  const room = roomManager.getRoom(code);
  if (!room) return;

  const hostState = roomManager.toPublicState(room, true);
  const hostPayload = JSON.stringify({
    type: 'room:state',
    state: hostState,
  } satisfies ServerMessage);

  const playerStateBase = roomManager.toPublicState(room, false);

  const wsSet = roomWsSockets.get(code);
  if (wsSet) {
    for (const ws of wsSet) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const sess = wsSessions.get(ws);
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

  const sseSet = roomSseClients.get(code);
  if (sseSet) {
    for (const client of sseSet) {
      if (client.res.writableEnded) continue;
      if (client.role === 'host') {
        client.res.write(`data: ${hostPayload}\n\n`);
      } else {
        sendToSse(client, {
          type: 'room:state',
          state: playerStateBase,
          yourPlayerId: client.playerId ?? undefined,
        });
      }
    }
  }
}

function broadcastProgress(code: string): void {
  const room = roomManager.getRoom(code);
  if (!room) return;

  const payload = JSON.stringify({
    type: 'room:progress',
    answeredCount: room.answersThisQuestion.size,
    totalPlayers: room.players.size,
    answerCounts: [...room.answerCounts] as [number, number, number, number],
    remainingSec: room.remainingSec,
  } satisfies ServerMessage);

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
        client.res.write(`data: ${payload}\n\n`);
      }
    }
  }
}

function broadcastTick(code: string, remainingSec: number): void {
  const payload = JSON.stringify({
    type: 'room:tick',
    remainingSec,
  } satisfies ServerMessage);

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
        client.res.write(`data: ${payload}\n\n`);
      }
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

function processClientMessage(
  msg: ClientMessage,
  ctx: ClientContext,
  ws?: WebSocket
): ServerMessage | null {
  switch (msg.type) {
    case 'host:create': {
      if (ws && ctx.roomCode) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      const room = roomManager.createRoom(msg.quiz);
      ctx.role = 'host';
      ctx.roomCode = room.code;
      ctx.hostToken = room.hostToken;
      ctx.playerId = null;
      if (ws) addWsToRoom(room.code, ws);

      return {
        type: 'host:created',
        code: room.code,
        hostToken: room.hostToken,
        state: roomManager.toPublicState(room, true),
      };
    }

    case 'host:reconnect': {
      const room = roomManager.getRoom(msg.code);
      if (!room || room.hostToken !== msg.hostToken) {
        return { type: 'error', message: 'ไม่พบห้องหรือสิทธิ์โฮสต์หมดอายุ' };
      }
      if (ws && ctx.roomCode) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      ctx.role = 'host';
      ctx.roomCode = room.code;
      ctx.hostToken = room.hostToken;
      if (ws) addWsToRoom(room.code, ws);
      return {
        type: 'room:state',
        state: roomManager.toPublicState(room, true),
      };
    }

    case 'host:start': {
      if (ctx.role !== 'host' || !ctx.roomCode) {
        return { type: 'error', message: 'ไม่พบสิทธิ์โฮสต์ของห้องนี้' };
      }
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) {
        return { type: 'error', message: 'สิทธิ์โฮสต์ไม่ถูกต้อง' };
      }
      roomManager.startGame(ctx.roomCode);
      startQuestionTimer(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'host:reveal': {
      if (ctx.role !== 'host' || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.revealQuestion(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'host:leaderboard': {
      if (ctx.role !== 'host' || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.showLeaderboard(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'host:next': {
      if (ctx.role !== 'host' || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) return null;
      stopQuestionTimer(ctx.roomCode);
      const nextRoom = roomManager.nextQuestion(ctx.roomCode);
      if (nextRoom.phase === 'QUESTION') {
        startQuestionTimer(ctx.roomCode);
      }
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'host:end': {
      if (ctx.role !== 'host' || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.endGame(ctx.roomCode);
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'host:restart': {
      if (ctx.role !== 'host' || !ctx.roomCode) return null;
      const room = roomManager.getRoom(ctx.roomCode);
      if (!room || (ctx.hostToken && room.hostToken !== ctx.hostToken)) return null;
      stopQuestionTimer(ctx.roomCode);
      roomManager.restartRoom(ctx.roomCode, msg.quiz);
      broadcastRoomState(ctx.roomCode);
      return null;
    }

    case 'player:check_room': {
      const status = roomManager.checkRoomStatus(msg.code);
      return {
        type: 'player:room_status',
        ...status,
      };
    }

    case 'player:join': {
      const { room, player } = roomManager.joinPlayer({
        code: msg.code,
        name: msg.name,
        avatarId: msg.avatarId,
        playerId: msg.playerId,
      });
      if (ws && ctx.roomCode && ctx.roomCode !== room.code) {
        removeWsFromRoom(ctx.roomCode, ws);
      }
      ctx.role = 'player';
      ctx.roomCode = room.code;
      ctx.playerId = player.id;
      if (ws) addWsToRoom(room.code, ws);

      const joinedReply: ServerMessage = {
        type: 'player:joined',
        playerId: player.id,
        state: roomManager.toPublicState(room, false),
      };
      broadcastRoomState(room.code);
      return joinedReply;
    }

    case 'player:answer': {
      if (ctx.role !== 'player' || !ctx.roomCode || !ctx.playerId) return null;
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
        return { type: 'player:answer_ack', choice: msg.choice };
      }
      return null;
    }
  }
}

// HTTP + SSE fallback endpoints so real-time rooms also work if a proxy blocks WebSocket upgrade
app.get('/api/events', (req, res) => {
  const code = String(req.query.code || '').trim();
  const role = req.query.role === 'host' ? 'host' : 'player';
  const hostToken = req.query.hostToken ? String(req.query.hostToken) : null;
  const playerId = req.query.playerId ? String(req.query.playerId) : null;

  const room = roomManager.getRoom(code);
  if (!room) {
    res.status(404).json({ error: 'ไม่พบห้องแข่งขัน' });
    return;
  }

  if (role === 'host' && room.hostToken !== hostToken) {
    res.status(403).json({ error: 'สิทธิ์โฮสต์ไม่ถูกต้อง' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const client: SseClient = {
    res,
    role,
    roomCode: code,
    hostToken,
    playerId,
  };

  if (role === 'player' && playerId) {
    roomManager.setPlayerConnected(code, playerId, true);
  }

  addSseToRoom(code, client);
  sendToSse(client, {
    type: 'room:state',
    state: roomManager.toPublicState(room, role === 'host'),
    yourPlayerId: playerId ?? undefined,
  });

  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n');
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSseFromRoom(code, client);
    if (role === 'player' && playerId) {
      roomManager.setPlayerConnected(code, playerId, false);
      broadcastRoomState(code);
    }
  });
});

app.post('/api/action', (req, res) => {
  const body = req.body as {
    message?: ClientMessage;
    context?: Partial<ClientContext>;
  };

  if (!body || !body.message) {
    res.status(400).json({ type: 'error', message: 'ข้อมูลคำสั่งไม่ถูกต้อง' });
    return;
  }

  const ctx: ClientContext = {
    role: body.context?.role ?? null,
    roomCode: body.context?.roomCode ?? null,
    playerId: body.context?.playerId ?? null,
    hostToken: body.context?.hostToken ?? null,
  };

  try {
    const reply = processClientMessage(body.message, ctx);
    res.json(reply ?? { ok: true });
  } catch (err) {
    res.status(400).json({
      type: 'error',
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    });
  }
});

wss.on('connection', (ws) => {
  const session: ClientContext = {
    role: null,
    roomCode: null,
    playerId: null,
    hostToken: null,
  };
  wsSessions.set(ws, session);

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      sendToSocket(ws, { type: 'error', message: 'ข้อมูลที่ส่งไม่ถูกต้อง' });
      return;
    }

    try {
      const reply = processClientMessage(msg, session, ws);
      if (reply) {
        sendToSocket(ws, reply);
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
      removeWsFromRoom(session.roomCode, ws);
    }
    wsSessions.delete(ws);
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
