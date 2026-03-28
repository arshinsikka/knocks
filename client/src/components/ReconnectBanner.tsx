'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export default function ReconnectBanner({ roomCode, playerName }: {
  roomCode: string;
  playerName: string;
}) {
  // 'hidden' | 'disconnected' | 'reconnected' | 'unstable'
  const [status, setStatus]           = useState<'hidden' | 'disconnected' | 'reconnected' | 'unstable'>('hidden');
  const [attemptCount, setAttemptCount] = useState(0);

  const showTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnected   = useRef(false);
  // Reconnect timestamps within the last minute for unstable-connection detection
  const reconnectTimes    = useRef<number[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const clearShow = () => {
      if (showTimerRef.current) { clearTimeout(showTimerRef.current); showTimerRef.current = null; }
    };
    const clearHide = () => {
      if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    };
    const stopHeartbeat = () => {
      if (heartbeatRef.current)   { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null; }
    };

    // ── Heartbeat: custom ping every 30 s ────────────────────────────────────
    const startHeartbeat = () => {
      stopHeartbeat();
      heartbeatRef.current = setInterval(() => {
        if (!socket.connected) return;
        socket.emit('ping');
        pongTimeoutRef.current = setTimeout(() => {
          // No pong received in 10 s — socket thinks it's up but server is gone.
          console.log('[ReconnectBanner] heartbeat timeout — forcing reconnect');
          socket.disconnect();
          socket.connect();
        }, 10_000);
      }, 30_000);
    };

    const onPong = () => {
      if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null; }
    };

    // ── Disconnect ────────────────────────────────────────────────────────────
    const onDisconnect = () => {
      wasDisconnected.current = true;
      clearShow();
      clearHide();
      stopHeartbeat();
      // Delay banner by 5 s to hide brief blips
      showTimerRef.current = setTimeout(() => {
        if (wasDisconnected.current) setStatus('disconnected');
      }, 5000);
    };

    // ── Reconnect attempt count (Manager event) ───────────────────────────────
    const onReconnectAttempt = (n: number) => {
      setAttemptCount(n);
    };

    // ── Connect (initial + every reconnect) ──────────────────────────────────
    const onConnect = () => {
      clearShow();
      clearHide();
      if (wasDisconnected.current) {
        socket.emit('rejoin_game', { roomCode, playerName });
        setAttemptCount(0);

        // Track reconnect times to detect instability
        const now = Date.now();
        reconnectTimes.current = reconnectTimes.current.filter((t) => now - t < 60_000);
        reconnectTimes.current.push(now);

        if (reconnectTimes.current.length > 3) {
          setStatus('unstable');
          hideTimerRef.current = setTimeout(() => setStatus('hidden'), 4000);
        } else {
          setStatus('reconnected');
          hideTimerRef.current = setTimeout(() => setStatus('hidden'), 2000);
        }
      }
      wasDisconnected.current = false;
      startHeartbeat();
    };

    // ── Error logging ─────────────────────────────────────────────────────────
    const onConnectError = (err: Error) => {
      console.log('[socket] connect_error:', err.message);
    };
    const onError = (err: Error) => {
      console.log('[socket] error:', err);
    };

    // ── Visibility change (phone lock / app switch / tab switch) ─────────────
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) {
          console.log('[ReconnectBanner] tab visible, socket disconnected — reconnecting');
          socket.connect();
        }
        socket.emit('rejoin_game', { roomCode, playerName });
      }
    };

    socket.on('disconnect',        onDisconnect);
    socket.on('connect',           onConnect);
    socket.on('pong',              onPong);
    socket.on('connect_error',     onConnectError);
    socket.on('error',             onError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Start heartbeat if already connected
    if (socket.connected) startHeartbeat();

    return () => {
      socket.off('disconnect',    onDisconnect);
      socket.off('connect',       onConnect);
      socket.off('pong',          onPong);
      socket.off('connect_error', onConnectError);
      socket.off('error',         onError);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearShow();
      clearHide();
      stopHeartbeat();
    };
  }, [roomCode, playerName]);

  if (status === 'hidden') return null;

  const isReconnected = status === 'reconnected';
  const isUnstable    = status === 'unstable';
  const isDisconnected = status === 'disconnected';

  return (
    <div style={{
      position:        'fixed',
      top: 0, left: 0, right: 0,
      zIndex:          9999,
      background:      isReconnected ? '#1a3a1a' : isUnstable ? '#3a2a0a' : 'var(--bg-elevated)',
      borderBottom:    `1px solid ${isReconnected ? '#2d6b2d' : isUnstable ? '#7a5a1a' : 'var(--border-medium)'}`,
      padding:         '10px 16px',
      textAlign:       'center',
      fontSize:        11,
      letterSpacing:   '0.12em',
      textTransform:   'uppercase',
      color:           isReconnected ? '#6fcf6f' : isUnstable ? '#f0b040' : 'var(--text-muted)',
      transition:      'background 0.3s, color 0.3s',
    }}>
      {isReconnected  && 'Reconnected'}
      {isUnstable     && 'Unstable connection'}
      {isDisconnected && (
        attemptCount > 0
          ? `Reconnecting\u2026 (attempt ${attemptCount})`
          : 'Connection lost \u2014 reconnecting\u2026'
      )}
    </div>
  );
}
