'use client';

import { useState, useCallback } from 'react';

type Phase = string;

function phaseBadge(serverPhase: Phase, isMyTurn: boolean) {
  if (isMyTurn)                        return { label: 'YOUR TURN',       pulse: true  };
  if (serverPhase === 'IN_OUT')        return { label: 'IN / OUT',        pulse: false };
  if (serverPhase === 'CHALLENGE_JOIN')return { label: 'CHALLENGE',       pulse: false };
  if (serverPhase === 'SHOWDOWN')      return { label: 'SHOWDOWN',        pulse: false };
  if (serverPhase === 'ROUND_END')     return { label: 'NEXT ROUND',      pulse: false };
  return { label: '', pulse: false };
}

interface Props {
  roomCode:    string;
  orbit:       number;
  round:       number;
  potTotal:    number;
  serverPhase: Phase;
  isMyTurn:    boolean;
}

export default function StatusBar({ roomCode, orbit, round, potTotal, serverPhase, isMyTurn }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [roomCode]);

  const badge = phaseBadge(serverPhase, isMyTurn);

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 16,
      paddingRight: 16,
      paddingBottom: 0,
    }}>
      {/* Row 1: room code + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
          }}
        >
          <span className="mono" style={{
            fontSize: 12, letterSpacing: '0.15em',
            color: 'var(--text-muted)',
          }}>
            {roomCode}
          </span>
          <span style={{ fontSize: 11, color: copied ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
            {copied ? '\u2713' : '\u2398'}
          </span>
        </button>

        {badge.label && (
          <div
            className={badge.pulse ? 'waiting-pulse' : 'badge-fade'}
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: isMyTurn ? 'var(--text-primary)' : 'var(--text-muted)',
              background: isMyTurn ? 'var(--accent-glow)' : 'transparent',
              border: `1px solid ${isMyTurn ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
              padding: '3px 8px',
              borderRadius: 3,
            }}
          >
            {badge.label}
          </div>
        )}
      </div>

      {/* Row 2: orbit/round */}
      <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
        ORBIT {orbit} &middot; ROUND {round}
      </div>

      {/* Row 3: pot */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          POT&nbsp;
          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            ${potTotal}
          </span>
        </span>
      </div>
    </div>
  );
}
