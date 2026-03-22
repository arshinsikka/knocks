'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSocket } from '@/lib/socket';

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const code   = (params.code as string).toUpperCase();

  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const nameRef    = useRef(name);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  nameRef.current  = name;

  const cancelTimeout = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onJoined = (d: {
      roomCode: string; knockTarget: number; roundsPerOrbit?: number;
      challengeLimit?: 'none' | 12 | 18 | 24;
      players: { id: string; name: string }[]; hostId: string;
    }) => {
      cancelTimeout();
      sessionStorage.setItem('knocks_session', JSON.stringify({
        playerName: nameRef.current.trim(), roomCode: d.roomCode,
        knockTarget: d.knockTarget,
        roundsPerOrbit: d.roundsPerOrbit ?? 5,
        challengeLimit: d.challengeLimit ?? 12,
        players: d.players, hostId: d.hostId,
      }));
      router.push(`/room/${d.roomCode}`);
    };

    const onError = ({ message }: { message: string }) => {
      cancelTimeout();
      setError(message); setLoading(false);
    };

    socket.on('room_joined', onJoined);
    socket.on('error',       onError);
    return () => {
      socket.off('room_joined', onJoined);
      socket.off('error',       onError);
    };
  }, [router, cancelTimeout]);

  const join = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setError(''); setLoading(true);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError('Could not connect to server. Please try again.');
    }, 10_000);
    getSocket().emit('join_room', { roomCode: code, playerName: name.trim() });
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>

        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 className="mono" style={{
            fontSize: 64, fontWeight: 700, letterSpacing: '0.25em',
            color: 'var(--text-primary)', textTransform: 'uppercase',
            lineHeight: 1, margin: 0, marginBottom: 10,
          }}>
            Knocks
          </h1>
          <p style={{
            fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase',
            color: 'var(--text-muted)', margin: 0,
          }}>
            Card Game
          </p>
        </div>

        {/* Pre-filled room code */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 6, padding: '10px 16px',
          marginBottom: 28, textAlign: 'center',
        }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            Joining Room
          </div>
          <span className="mono" style={{
            fontSize: 28, fontWeight: 700, letterSpacing: '0.2em',
            color: 'var(--text-primary)',
          }}>
            {code}
          </span>
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 24 }}>
          <input
            type="text"
            value={name}
            placeholder="Your name"
            autoComplete="off"
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
            style={{
              width: '100%', background: 'transparent',
              border: 'none', borderBottom: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              fontSize: 16, padding: '10px 0',
              outline: 'none',
              fontFamily: 'var(--font-outfit), sans-serif',
              transition: 'border-color 200ms ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e)  => (e.target.style.borderBottomColor = 'var(--border-bright)')}
            onBlur={(e)   => (e.target.style.borderBottomColor = 'var(--border-medium)')}
          />
        </div>

        {/* Join button */}
        <button
          onClick={join}
          disabled={loading}
          className="btn-tap"
          style={{
            width: '100%', padding: '14px 0',
            fontSize: 12, fontWeight: 500,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            border: '1px solid var(--border-bright)',
            borderRadius: 8,
            background: 'var(--border-medium)',
            color: 'var(--text-primary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            transition: 'all 150ms ease-out',
            fontFamily: 'var(--font-outfit), sans-serif',
          }}
        >
          {loading ? 'Joining\u2026' : 'Join Game'}
        </button>

        {/* Error */}
        {error && (
          <p style={{
            marginTop: 20, textAlign: 'center', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
