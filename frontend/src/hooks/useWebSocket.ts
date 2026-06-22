import { useEffect, useRef, useCallback } from 'react';

type WSMessage = {
  type: string;
  [key: string]: unknown;
};

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/^﻿/, '').replace(/\/$/, '');
    const wsUrl = apiUrl
      ? apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws').replace(/\/api$/, '') + '/ws'
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log('[WS] Connected');
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as WSMessage;
        onMessage(data);
      } catch {}
    };
    ws.onerror = (e) => console.error('[WS] Error', e);
    ws.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 5s...');
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
