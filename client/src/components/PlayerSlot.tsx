'use client';

import { PublicPlayer, PlayerAction } from '@/context/GameContext';

interface Props {
  player:       PublicPlayer;
  knockTarget:  number;
  isMe:         boolean;
  isActiveTurn: boolean;
  choice:       PlayerAction | undefined;
}

function KnockDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: i < filled ? 'var(--text-primary)' : 'transparent',
            border: `1px solid ${i < filled ? 'var(--text-primary)' : 'var(--border-bright)'}`,
          }}
        />
      ))}
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

export default function PlayerSlot({ player, knockTarget, isMe, isActiveTurn, choice }: Props) {
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
      <div style={{
        fontSize: 13, fontFamily: 'var(--font-jetbrains-mono), monospace',
        color: player.balance >= 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontWeight: 500,
      }}>
        {player.balance >= 0 ? '+' : ''}{player.balance}
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
    </div>
  );
}
