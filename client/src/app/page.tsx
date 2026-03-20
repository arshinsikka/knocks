'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

type View = 'main' | 'create' | 'join';

function Input({
  value, onChange, placeholder, type = 'text', style = {},
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', background: 'transparent',
        border: 'none', borderBottom: '1px solid var(--border-medium)',
        color: 'var(--text-primary)',
        fontSize: 16, padding: '10px 0',
        outline: 'none',
        fontFamily: 'var(--font-outfit), sans-serif',
        transition: 'border-color 200ms ease',
        ...style,
      }}
      onFocus={(e)  => (e.target.style.borderBottomColor = 'var(--border-bright)')}
      onBlur={(e)   => (e.target.style.borderBottomColor = 'var(--border-medium)')}
    />
  );
}

function Btn({
  label, onClick, primary = false, disabled = false,
}: { label: string; onClick?: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-tap"
      style={{
        flex: 1, padding: '14px 0',
        fontSize: 12, fontWeight: 500,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        border: `1px solid ${primary ? 'var(--border-bright)' : 'var(--border-medium)'}`,
        borderRadius: 8,
        background: primary ? 'var(--border-medium)' : 'transparent',
        color: primary ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'all 150ms ease-out',
        fontFamily: 'var(--font-outfit), sans-serif',
      }}
    >
      {label}
    </button>
  );
}

export default function Home() {
  const router   = useRouter();
  const [name,        setName]        = useState('');
  const [view,        setView]        = useState<View>('main');
  const [knockTarget, setKnockTarget] = useState<5 | 6>(5);
  const [roomCode,    setRoomCode]    = useState('');
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    const socket = getSocket();

    const onCreated = (d: {
      roomCode: string; knockTarget: number;
      players: { id: string; name: string }[]; hostId: string;
    }) => {
      sessionStorage.setItem('knocks_session', JSON.stringify({
        playerName: nameRef.current.trim(), roomCode: d.roomCode,
        knockTarget: d.knockTarget, players: d.players, hostId: d.hostId,
      }));
      router.push(`/room/${d.roomCode}`);
    };

    const onJoined = (d: {
      roomCode: string; knockTarget: number;
      players: { id: string; name: string }[]; hostId: string;
    }) => {
      sessionStorage.setItem('knocks_session', JSON.stringify({
        playerName: nameRef.current.trim(), roomCode: d.roomCode,
        knockTarget: d.knockTarget, players: d.players, hostId: d.hostId,
      }));
      router.push(`/room/${d.roomCode}`);
    };

    const onError = ({ message }: { message: string }) => {
      setError(message); setLoading(false);
    };

    socket.on('room_created', onCreated);
    socket.on('room_joined',  onJoined);
    socket.on('error',        onError);
    return () => {
      socket.off('room_created', onCreated);
      socket.off('room_joined',  onJoined);
      socket.off('error',        onError);
    };
  }, [router]);

  const guard = () => {
    if (!name.trim()) { setError('Enter your name first'); return false; }
    return true;
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
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
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

        {/* Name field — always visible */}
        <div style={{ marginBottom: 32 }}>
          <Input
            value={name}
            onChange={(v) => { setName(v); setError(''); }}
            placeholder="Your name"
          />
        </div>

        {/* ── MAIN view ── */}
        {view === 'main' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn
              label="Create Room" primary
              onClick={() => { if (!guard()) return; setError(''); setView('create'); }}
            />
            <Btn
              label="Join Room"
              onClick={() => { if (!guard()) return; setError(''); setView('join'); }}
            />
          </div>
        )}

        {/* ── CREATE view ── */}
        {view === 'create' && (
          <div>
            <p style={{
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 16,
            }}>
              Knock Target
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              {([5, 6] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setKnockTarget(n)}
                  style={{
                    flex: 1, padding: '28px 0',
                    fontSize: 28, fontWeight: 700,
                    border: `1px solid ${knockTarget === n ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    background: knockTarget === n ? 'var(--accent-glow)' : 'transparent',
                    color: knockTarget === n ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-out',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn label="Back" onClick={() => { setView('main'); setError(''); }} />
              <Btn
                label={loading ? 'Creating\u2026' : 'Create'} primary
                disabled={loading}
                onClick={() => {
                  setError(''); setLoading(true);
                  getSocket().emit('create_room', { playerName: name.trim(), knockTarget });
                }}
              />
            </div>
          </div>
        )}

        {/* ── JOIN view ── */}
        {view === 'join' && (
          <div>
            <p style={{
              fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 16,
            }}>
              Room Code
            </p>
            <Input
              value={roomCode}
              onChange={(v) => {
                setRoomCode(v.toUpperCase().replace(/[^A-Z]/g, ''));
                setError('');
              }}
              placeholder="XXXXXX"
              style={{
                fontSize: 28, fontWeight: 700, letterSpacing: '0.2em',
                textAlign: 'center', textTransform: 'uppercase',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                marginBottom: 24,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn
                label="Back"
                onClick={() => { setView('main'); setRoomCode(''); setError(''); }}
              />
              <Btn
                label={loading ? 'Joining\u2026' : 'Join'} primary
                disabled={loading || roomCode.length !== 6}
                onClick={() => {
                  if (!roomCode.trim()) { setError('Enter a room code'); return; }
                  setError(''); setLoading(true);
                  getSocket().emit('join_room', {
                    roomCode: roomCode.trim().toUpperCase(),
                    playerName: name.trim(),
                  });
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{
            marginTop: 24, textAlign: 'center', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.05em',
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
