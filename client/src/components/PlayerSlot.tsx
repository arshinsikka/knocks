'use client';

import { PublicPlayer, PlayerAction } from '@/context/GameContext';

interface Props {
  player:        PublicPlayer;
  knockTarget:   number;
  isMe:          boolean;
  isActiveTurn:  boolean;
  choice:        PlayerAction | undefined;
  hasSeenCards?: boolean;
  onEyeClick?:   () => void;
}

function KnockDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 9, height: 9,
              borderRadius: '50%',
              background: i < filled ? '#ffffff' : 'transparent',
              border: `1.5px solid ${i < filled ? '#ffffff' : 'var(--border-bright)'}`,
            }}
          />
        ))}
      </div>
      <span style={{
        fontSize: 9,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        color: filled > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
        letterSpacing: '0.03em',
      }}>
        {filled}/{total}
      </span>
    </div>
  );
}

function ChoiceBadge({ choice }: { choice: PlayerAction }) {
  const bright = choice === 'in' || choice === 'join';
  return (
    <div
      className="badge-fade"
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        border: `1px solid ${bright ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
        color: bright ? 'var(--text-primary)' : 'var(--text-muted)',
        fontFamily: 'var(--font-outfit), sans-serif',
        borderRadius: 2,
      }}
    >
      {choice}
    </div>
  );
}

export default function PlayerSlot({
  player, knockTarget, isMe, isActiveTurn, choice, hasSeenCards = false, onEyeClick,
}: Props) {
  const name = player.name.length > 10 ? player.name.slice(0, 9) + '\u2026' : player.name;

  return (
    <div
      className={isActiveTurn ? 'turn-glow' : ''}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            4,
        padding:        '8px 10px',
        background:     'var(--bg-surface)',
        border:         `1px solid ${isActiveTurn ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
        borderRadius:   6,
        minWidth:       88,
        maxWidth:       110,
        transition:     'border-color 200ms ease-out',
        position:       'relative',
      }}
    >
      {/* "You" indicator */}
      {isMe && (
        <div style={{
          position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
          fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
          background: 'var(--bg-surface)',
          padding: '0 4px',
          fontFamily: 'var(--font-outfit), sans-serif',
        }}>
          You
        </div>
      )}

      {/* Name */}
      <div style={{
        fontSize: 12, fontWeight: 500,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {name}
      </div>

      {/* Balance */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <div style={{
          fontSize: 13, fontFamily: 'var(--font-jetbrains-mono), monospace',
          color: player.balance >= 0 ? '#ffffff' : '#666666',
          fontWeight: 500,
        }}>
          {player.balance >= 0 ? '+$' : '-$'}{Math.abs(player.balance)}
        </div>
        <div style={{
          fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-muted)', fontFamily: 'var(--font-outfit), sans-serif',
        }}>
          Balance
        </div>
      </div>

      {/* Knock dots */}
      <KnockDots filled={player.knocks} total={knockTarget} />

      {/* Choice badge */}
      {choice ? (
        <ChoiceBadge choice={choice} />
      ) : (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          &mdash;
        </div>
      )}

      {/* Eye icon — shows when opponent cards have been seen in a showdown */}
      {!isMe && (
        <button
          onClick={(e) => { e.stopPropagation(); if (hasSeenCards && onEyeClick) onEyeClick(); }}
          title={hasSeenCards ? 'View recalled cards' : 'No cards seen yet'}
          style={{
            position: 'absolute', bottom: 4, right: 4,
            background: 'none', border: 'none', padding: 2,
            cursor: hasSeenCards ? 'pointer' : 'default',
            lineHeight: 1,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="12" cy="12" rx="10" ry="6"
              stroke={hasSeenCards ? '#ffffff' : '#444444'} strokeWidth="2" />
            <circle cx="12" cy="12" r="3"
              fill={hasSeenCards ? '#ffffff' : '#444444'} />
            {hasSeenCards && (
              <circle cx="18" cy="6" r="3" fill="#ffffff" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}
