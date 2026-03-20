'use client';

import { PlayerAction } from '@/context/GameContext';

interface Props {
  isMyTurn:     boolean;
  turnPhase:    'in_out' | 'challenge_join' | null;
  serverPhase:  string;
  waitingFor:   { playerName: string; phase: string } | null;
  myName:       string;
  playerChoices: Record<string, PlayerAction>;
  emitIn:       () => void;
  emitOut:      () => void;
  emitJoin:     () => void;
  emitPass:     () => void;
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
        opacity: disabled ? 0.4 : 1,
        transition: 'background 150ms ease-out, border-color 150ms ease-out',
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

export default function ActionBar({
  isMyTurn, turnPhase, serverPhase, waitingFor,
  myName, playerChoices, emitIn, emitOut, emitJoin, emitPass,
}: Props) {
  const myChoice = playerChoices[myName];

  let content: React.ReactNode;

  if (isMyTurn && turnPhase === 'in_out') {
    content = (
      <>
        <Btn label="In"  onClick={emitIn}  primary />
        <Btn label="Out" onClick={emitOut} />
      </>
    );
  } else if (isMyTurn && turnPhase === 'challenge_join') {
    content = (
      <>
        <Btn label="Join Challenge" onClick={emitJoin} primary />
        <Btn label="Pass"           onClick={emitPass} />
      </>
    );
  } else if (serverPhase === 'IN_OUT') {
    content = waitingFor
      ? <WaitText>Waiting for {waitingFor.playerName}&hellip;</WaitText>
      : <WaitText>Round in progress&hellip;</WaitText>;
  } else if (serverPhase === 'CHALLENGE_JOIN') {
    if (myChoice === 'in') {
      content = <WaitText>Waiting for challenges&hellip;</WaitText>;
    } else if (waitingFor) {
      content = <WaitText>Waiting for {waitingFor.playerName} to decide&hellip;</WaitText>;
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
      background:     'var(--bg-primary)',
      borderTop:      '1px solid var(--border-subtle)',
      padding:        '12px 16px',
      paddingBottom:  'max(12px, env(safe-area-inset-bottom))',
      display:        'flex',
      alignItems:     'center',
      gap:            8,
      zIndex:         50,
    }}>
      {content}
    </div>
  );
}
