'use client';

import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';

export default function ReconnectBanner({ roomCode, playerName }: {
  roomCode: string;
  playerName: string;
}) {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onDisconnect = () => setDisconnected(true);

    const onReconnect = () => {
      socket.emit('rejoin_game', { roomCode, playerName });
      setDisconnected(false);
    };

    socket.on('disconnect',        onDisconnect);
    socket.on('reconnect',         onReconnect);

    return () => {
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect',         onReconnect);
    };
  }, [roomCode, playerName]);

  if (!disconnected) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border-medium)',
      padding: '10px 16px',
      textAlign: 'center',
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
    }}>
      Connection lost — reconnecting&hellip;
    </div>
  );
}
