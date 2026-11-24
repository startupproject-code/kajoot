import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, ServerMessage } from '../shared/types';

interface ClientContextState {
  role: 'host' | 'player' | null;
  roomCode: string | null;
  hostToken: string | null;
  playerId: string | null;
}

export function useQuizSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const wsFailedRef = useRef(false);
  const wsOpenRef = useRef(false);

  const ctxRef = useRef<ClientContextState>({
    role: null,
    roomCode: null,
    hostToken: null,
    playerId: null,
  });

  const openSseIfNeeded = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx.roomCode || !ctx.role) return;
    if (wsOpenRef.current && wsRef.current && wsRef.current.readyState === 1) return;

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    const params = new URLSearchParams({
      code: ctx.roomCode,
      role: ctx.role,
    });
    if (ctx.role === 'host' && ctx.hostToken) {
      params.set('hostToken', ctx.hostToken);
    }
    if (ctx.role === 'player' && ctx.playerId) {
      params.set('playerId', ctx.playerId);
    }

    const es = new EventSource(`/api/events?${params.toString()}`);
    sseRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setConnecting(false);
    };

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as ServerMessage;
        onMessageRef.current(parsed);
      } catch {
        // ignore malformed packet
      }
    };

    es.onerror = () => {
      // EventSource automatically retries
    };
  }, []);

  const handleIncoming = useCallback(
    (parsed: ServerMessage, viaHttp = false) => {
      if (parsed.type === 'host:created') {
        ctxRef.current = {
          role: 'host',
          roomCode: parsed.code,
          hostToken: parsed.hostToken,
          playerId: null,
        };
        if (viaHttp) {
          openSseIfNeeded();
        }
      } else if (parsed.type === 'player:joined') {
        ctxRef.current = {
          role: 'player',
          roomCode: parsed.state.code,
          hostToken: null,
          playerId: parsed.playerId,
        };
        if (viaHttp) {
          openSseIfNeeded();
        }
      } else if (parsed.type === 'room:state' && parsed.yourPlayerId) {
        ctxRef.current.playerId = parsed.yourPlayerId;
      }

      onMessageRef.current(parsed);
    },
    [openSseIfNeeded]
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setConnecting(true);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      wsFailedRef.current = true;
      setConnected(true);
      setConnecting(false);
      openSseIfNeeded();
      return;
    }

    wsRef.current = socket;

    const fallbackTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      if (!wsOpenRef.current) {
        wsFailedRef.current = true;
        setConnected(true);
        setConnecting(false);
        openSseIfNeeded();
      }
    }, 1500);

    socket.onopen = () => {
      window.clearTimeout(fallbackTimer);
      if (!mountedRef.current) {
        socket.close();
        return;
      }
      wsOpenRef.current = true;
      wsFailedRef.current = false;
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      setConnected(true);
      setConnecting(false);

      const ctx = ctxRef.current;
      if (ctx.role === 'host' && ctx.roomCode && ctx.hostToken) {
        socket.send(
          JSON.stringify({
            type: 'host:reconnect',
            code: ctx.roomCode,
            hostToken: ctx.hostToken,
          } satisfies ClientMessage)
        );
      }
    };

    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as ServerMessage;
        handleIncoming(parsed, false);
      } catch {
        // ignore malformed packets
      }
    };

    socket.onclose = () => {
      window.clearTimeout(fallbackTimer);
      wsOpenRef.current = false;
      if (!mountedRef.current) return;
      if (wsFailedRef.current) {
        setConnected(true);
        setConnecting(false);
        openSseIfNeeded();
        return;
      }
      setConnecting(false);
      if (ctxRef.current.roomCode) {
        openSseIfNeeded();
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 2000);
    };

    socket.onerror = () => {
      wsFailedRef.current = true;
      setConnected(true);
      setConnecting(false);
      openSseIfNeeded();
    };
  }, [handleIncoming, openSseIfNeeded]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, [connect]);

  const sendViaHttp = useCallback(
    async (msg: ClientMessage) => {
      try {
        const resp = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            context: ctxRef.current,
          }),
        });
        const data = (await resp.json()) as ServerMessage | { ok?: boolean };
        if (data && 'type' in data) {
          handleIncoming(data, true);
        }
      } catch {
        onMessageRef.current({
          type: 'error',
          message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
        });
      }
    },
    [handleIncoming]
  );

  const send = useCallback(
    (msg: ClientMessage) => {
      if (msg.type === 'host:reconnect') {
        ctxRef.current.role = 'host';
        ctxRef.current.roomCode = msg.code;
        ctxRef.current.hostToken = msg.hostToken;
      }

      const socket = wsRef.current;
      if (wsOpenRef.current && socket && socket.readyState === 1) {
        socket.send(JSON.stringify(msg));
      } else {
        void sendViaHttp(msg);
      }
    },
    [sendViaHttp]
  );

  return { connected, connecting, send };
}
