'use client';

import { useRouter } from 'next/navigation';
import { GameOverData } from '@/context/GameContext';

interface Props {
  data: GameOverData;
}

// Sparse particle dots — CSS only, no JS animation
function Particles() {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const x   = Math.round((i / 12) * 100);
    const dx   = ((i % 3) - 1) * 30;
    const dur  = 4 + (i % 3);
    const del  = (i * 0.4) % 3;
    const size = i % 2 === 0 ? 2 : 1;
    return { x, dx, dur, del, size };
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1,
    }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position:     'absolute',
            bottom:       '-4px',
            left:         `${p.x}%`,
            width:        p.size,
            height:       p.size,
            borderRadius: '50%',
            background:   'var(--border-bright)',
            animation:    `particleRise ${p.dur}s ${p.del}s ease-in infinite`,
            '--dx':       `${p.dx}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default function GameOverScreen({ data }: Props) {
  const router = useRouter();

  const sorted = [...data.finalBalances].sort((a, b) => b.balance - a.balance);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 80, padding: '0 24px',
    }}>
      <Particles />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 400, textAlign: 'center' }}>
        {/* Title */}
        <div style={{
          fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: 'var(--text-muted)', marginBottom: 16,
        }}>
          Game Over
        </div>

        {/* Winner name */}
        <div style={{
          fontSize: 36, fontWeight: 800, letterSpacing: '0.05em',
          color: 'var(--text-primary)', marginBottom: 6,
        }}>
          {data.winnerName}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          wins with {data.winnerKnocks} knocks
        </div>

        <div className="mono" style={{
          fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32,
        }}>
          +{data.potTotal} collected
        </div>

        {/* Leaderboard */}
        <div style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 32,
        }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 60px 60px',
            padding: '8px 16px', gap: 8,
            background: 'var(--bg-surface)',
            fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            <span>#</span>
            <span>Player</span>
            <span style={{ textAlign: 'right' }}>Knocks</span>
            <span style={{ textAlign: 'right' }}>Balance</span>
          </div>

          {sorted.map((p, i) => {
            const isWinner = p.name === data.winnerName;
            return (
              <div
                key={p.name}
                style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr 60px 60px',
                  padding: '12px 16px', gap: 8,
                  background: isWinner ? 'var(--accent-glow)' : 'transparent',
                  borderTop: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</span>
                <span style={{
                  fontSize: 14, fontWeight: isWinner ? 600 : 400,
                  color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {p.name}
                </span>
                <span className="mono" style={{
                  fontSize: 12, textAlign: 'right',
                  color: 'var(--text-muted)',
                }}>
                  {p.knocks}
                </span>
                <span className="mono" style={{
                  fontSize: 13, fontWeight: 600, textAlign: 'right',
                  color: p.balance >= 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}>
                  {p.balance >= 0 ? '+' : ''}{p.balance}
                </span>
              </div>
            );
          })}
        </div>

        {/* Back home */}
        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            padding: '14px 0',
            fontSize: 13, fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background 150ms ease-out',
            fontFamily: 'var(--font-outfit), sans-serif',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
