import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, ServerMessage } from '../shared/types';

export function useQuizSocket(onMessage: (msg: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingQueueRef = useRef<ClientMessage[]>([]);
  const mountedRef = useRef(true);

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
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) {
        socket.close();
        return;
      }
      setConnected(true);
      setConnecting(false);
      while (pendingQueueRef.current.length > 0) {
        const next = pendingQueueRef.current.shift();
        if (next && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(next));
        }
      }
    };

    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.data)) as ServerMessage;
        onMessageRef.current(parsed);
      } catch {
        // ignore malformed packets
      }
    };

    socket.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      setConnecting(false);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 1500);
    };

    socket.onerror = () => {
      // handled in onclose
    };
  }, []);

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
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    } else {
      pendingQueueRef.current.push(msg);
      connect();
    }
  }, [connect]);

  return { connected, connecting, send };
}
