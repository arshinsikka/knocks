'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export default function ReconnectBanner({ roomCode, playerName }: {
  roomCode: string;
  playerName: string;
}) {
  const [show, setShow]             = useState(false);
  const timerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we have genuinely been disconnected (not just the
  // polling→WebSocket upgrade flicker on first load).
  const wasDisconnectedRef          = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const clearTimer = () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const onDisconnect = () => {
      wasDisconnectedRef.current = true;
      clearTimer();
      // Only show the banner after 3 s of continuous disconnection so that
      // brief transport-upgrade flickers are invisible to the user.
      timerRef.current = setTimeout(() => {
        if (wasDisconnectedRef.current) setShow(true);
      }, 3000);
    };

    // Socket.IO v4: 'connect' fires on both the initial connection AND every
    // successful reconnection — use it instead of the Manager-level 'reconnect'.
    const onConnect = () => {
      clearTimer();
      if (wasDisconnectedRef.current) {
        // Genuine reconnect — re-associate with the game on the server.
        console.log('[ReconnectBanner] reconnected, rejoining game');
        socket.emit('rejoin_game', { roomCode, playerName });
      }
      wasDisconnectedRef.current = false;
      setShow(false);
    };

    socket.on('disconnect', onDisconnect);
    socket.on('connect',    onConnect);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect',    onConnect);
      clearTimer();
    };
  }, [roomCode, playerName]);

  if (!show) return null;

  return (
    <div style={{
      position:   'fixed',
      top: 0, left: 0, right: 0,
      zIndex:     9999,
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-medium)',
      padding:    '10px 16px',
      textAlign:  'center',
      fontSize:   11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color:      'var(--text-muted)',
    }}>
      Connection lost — reconnecting&hellip;
    </div>
  );
}
