'use client';

import { useState, useEffect } from 'react';
import { PlayerAction } from '@/context/GameContext';
import { getSocket } from '@/lib/socket';

const TURN_SECS = 15;

interface Props {
  isMyTurn:      boolean;
  turnPhase:     'in_out' | 'challenge_join' | null;
  serverPhase:   string;
  waitingFor:    { playerName: string; phase: string } | null;
  myName:        string;
  playerChoices: Record<string, PlayerAction>;
  emitIn:        () => void;
  emitOut:       () => void;
  emitJoin:      () => void;
  emitPass:      () => void;
}

function Btn({
  label, onClick, primary = false, disabled = false,
}: { label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn-tap"
      style={{
        flex: 1,
        minHeight: 52,
        fontSize: 15, fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        border: `1px solid ${primary ? 'var(--border-bright)' : 'var(--border-medium)'}`,
        borderRadius: 8,
        background: primary ? 'var(--border-medium)' : 'transparent',
        color: primary ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'background 150ms ease-out, border-color 150ms ease-out, opacity 150ms ease-out',
        fontFamily: 'var(--font-outfit), sans-serif',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = primary ? 'var(--border-medium)' : 'transparent';
      }}
    >
      {label}
    </button>
  );
}

function WaitText({ children }: { children: React.ReactNode }) {
  return (
    <div className="waiting-pulse" style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, letterSpacing: '0.08em', color: 'var(--text-muted)',
    }}>
      {children}
    </div>
  );
}

function Countdown({ secs }: { secs: number }) {
  const urgent = secs <= 5 && secs > 0;
  return (
    <span style={{
      fontSize: urgent ? 13 : 11,
      fontWeight: urgent ? 700 : 400,
      color: urgent ? 'var(--text-primary)' : 'var(--text-muted)',
      fontFamily: 'var(--font-jetbrains-mono), monospace',
      minWidth: 22,
      textAlign: 'center',
      flexShrink: 0,
      transition: 'color 300ms ease-out',
    }}>
      {secs}
    </span>
  );
}

export default function ActionBar({
  isMyTurn, turnPhase, serverPhase, waitingFor,
  myName, playerChoices, emitIn, emitOut, emitJoin, emitPass,
}: Props) {
  // ── Double-click guard ────────────────────────────────────────────────────
  const [acted, setActed] = useState(false);

  // Reset on every meaningful phase transition.
  // Critically: when P2 clicks OUT and immediately becomes the challenge actor,
  // isMyTurn stays true but turnPhase flips in→cj, which resets acted.
  useEffect(() => {
    console.log('[ActionBar] reset acted — isMyTurn:', isMyTurn, 'turnPhase:', turnPhase);
    setActed(false);
  }, [isMyTurn, turnPhase]);

  // Belt-and-suspenders: also reset directly on your_turn socket event.
  // This fires even if isMyTurn/turnPhase haven't changed yet in React state.
  useEffect(() => {
    const socket = getSocket();
    const onYourTurn = (d: { phase: string }) => {
      console.log('[ActionBar] your_turn received (', d.phase, ') → reset acted');
      setActed(false);
    };
    const onError = () => {
      console.log('[ActionBar] server error → reset acted');
      setActed(false);
    };
    socket.on('your_turn', onYourTurn);
    socket.on('error',     onError);
    return () => {
      socket.off('your_turn', onYourTurn);
      socket.off('error',     onError);
    };
  }, []);

  // ── Countdown timer ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(TURN_SECS);

  // Track who the active actor is; changing this value resets the countdown.
  const activeActor = isMyTurn
    ? `me:${turnPhase ?? ''}`
    : waitingFor
      ? `them:${waitingFor.playerName}:${waitingFor.phase}`
      : null;

  useEffect(() => {
    setCountdown(TURN_SECS);
    if (!activeActor) return;
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeActor]);

  function act(label: string, fn: () => void) {
    if (acted) return;
    console.log('[ActionBar] clicked:', label, '→ emitting');
    setActed(true);
    fn();
  }

  const myChoice = playerChoices[myName];
  console.log('[ActionBar] render | isMyTurn:', isMyTurn, '| turnPhase:', turnPhase,
    '| serverPhase:', serverPhase, '| acted:', acted, '| myChoice:', myChoice,
    '| countdown:', countdown);

  // ── Content ───────────────────────────────────────────────────────────────
  let content: React.ReactNode;

  if (isMyTurn && turnPhase === 'in_out') {
    content = (
      <>
        <Btn label="In"  onClick={() => act('In',  emitIn)}  primary disabled={acted} />
        <Btn label="Out" onClick={() => act('Out', emitOut)}         disabled={acted} />
        <Countdown secs={countdown} />
      </>
    );
  } else if (isMyTurn && turnPhase === 'challenge_join') {
    content = (
      <>
        <Btn label="Join" onClick={() => act('Join', emitJoin)} primary disabled={acted} />
        <Btn label="Pass" onClick={() => act('Pass', emitPass)}         disabled={acted} />
        <Countdown secs={countdown} />
      </>
    );
  } else if (serverPhase === 'IN_OUT') {
    content = waitingFor
      ? <WaitText>Waiting for {waitingFor.playerName}&hellip; ({countdown}s)</WaitText>
      : <WaitText>Round in progress&hellip;</WaitText>;
  } else if (serverPhase === 'CHALLENGE_JOIN') {
    if (myChoice === 'in') {
      content = waitingFor
        ? <WaitText>Waiting for {waitingFor.playerName} to challenge&hellip; ({countdown}s)</WaitText>
        : <WaitText>Waiting for challenges&hellip;</WaitText>;
    } else if (waitingFor) {
      content = <WaitText>Waiting for {waitingFor.playerName} to decide&hellip; ({countdown}s)</WaitText>;
    } else {
      content = <WaitText>Challenge window&hellip;</WaitText>;
    }
  } else if (serverPhase === 'SHOWDOWN') {
    content = <WaitText>Showdown in progress&hellip;</WaitText>;
  } else if (serverPhase === 'ROUND_END') {
    content = <WaitText>Next round starting&hellip;</WaitText>;
  } else {
    content = null;
  }

  return (
    <div style={{
      position:      'relative',
      background:    'var(--bg-primary)',
      borderTop:     '1px solid var(--border-subtle)',
      padding:       '12px 16px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      display:       'flex',
      alignItems:    'center',
      gap:           8,
      zIndex:        50,
    }}>
      {content}
    </div>
  );
}
