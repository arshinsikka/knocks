'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameOverData } from '@/context/GameContext';
import { getSocket } from '@/lib/socket';

interface Props {
  data: GameOverData;
  roomCode: string;
  isHost: boolean;
  onLedger?: () => void;
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

function KnockDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8, height: 8,
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
      }}>
        {filled}/{total}
      </span>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: number; note?: string }) {
  const isZero = value === 0;
  const formatted = value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0',
    }}>
      <span style={{
        fontSize: 11, color: isZero ? 'var(--text-muted)' : 'var(--text-muted)',
        fontFamily: 'var(--font-outfit), sans-serif',
        letterSpacing: '0.02em',
      }}>
        {label}{note && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, opacity: 0.6 }}>
            {note}
          </span>
        )}
      </span>
      <span style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 12,
        color: isZero ? 'var(--text-muted)' : value > 0 ? '#ffffff' : '#666666',
        minWidth: 60,
        textAlign: 'right',
      }}>
        {isZero ? '—' : formatted}
      </span>
    </div>
  );
}

export default function GameOverScreen({ data, roomCode, isHost, onLedger }: Props) {
  const router = useRouter();
  const [rematchPending, setRematchPending] = useState(false);

  const handleRematch = () => {
    setRematchPending(true);
    getSocket().emit('request_rematch', { roomCode });
  };
  const sorted = [...data.finalBalances].sort((a, b) => b.balance - a.balance);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-primary)',
      overflowY: 'auto',
      zIndex: 80,
    }}>
      <Particles />

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: 440,
        margin: '0 auto',
        padding: '40px 24px 40px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--text-muted)', marginBottom: 14,
          }}>
            Game Over
          </div>
          <div style={{
            fontSize: 34, fontWeight: 800, letterSpacing: '0.03em',
            color: 'var(--text-primary)', marginBottom: 6,
          }}>
            {data.winnerName} wins!
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {data.winnerKnocks} knocks
          </div>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{
            fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--text-muted)', fontFamily: 'var(--font-outfit), sans-serif',
          }}>
            Final Standings
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Player breakdown cards */}
        {sorted.map((p) => {
          const isWinner = p.name === data.winnerName;
          const orbits = p.totalOrbitFees !== 0 ? Math.abs(p.totalOrbitFees) / 2 : 0;

          return (
            <div
              key={p.name}
              style={{
                border: `1px solid ${isWinner ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 12,
                background: isWinner ? 'var(--accent-glow)' : 'transparent',
              }}
            >
              {/* Name + knocks */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 14, fontWeight: isWinner ? 700 : 500,
                  color: 'var(--text-primary)',
                }}>
                  {p.name}
                </span>
                <KnockDots filled={p.knocks} total={data.knockTarget} />
              </div>

              {/* Breakdown rows */}
              <Row
                label="Orbit fees"
                value={p.totalOrbitFees}
                note={orbits > 0 ? `${orbits} orbit${orbits !== 1 ? 's' : ''} × $2` : undefined}
              />
              <Row label="Showdown winnings" value={p.showdownWinnings} />
              <Row label="Showdown losses"   value={p.showdownLosses} />
              {p.potCollected !== 0 && (
                <Row label="Pot collected" value={p.potCollected} />
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px 0 8px' }} />

              {/* Final balance */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-outfit), sans-serif',
                }}>
                  Final Balance
                </span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 17, fontWeight: 700,
                  color: p.balance >= 0 ? '#ffffff' : '#666666',
                }}>
                  {p.balance >= 0 ? '+$' : '-$'}{Math.abs(p.balance)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Ledger */}
        <p style={{
          textAlign: 'center', fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.08em', marginTop: 4, marginBottom: 8,
        }}>
          Game saved to ledger
        </p>
        {onLedger && (
          <button
            onClick={onLedger}
            style={{
              width: '100%', marginBottom: 8,
              padding: '12px 0',
              fontSize: 12, fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: 'transparent',
              border: '1px solid var(--border-medium)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-outfit), sans-serif',
            }}
          >
            View Ledger
          </button>
        )}

        {/* Rematch */}
        {isHost ? (
          <button
            onClick={handleRematch}
            disabled={rematchPending}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '14px 0',
              fontSize: 13, fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: rematchPending ? 'var(--bg-elevated)' : 'var(--border-medium)',
              border: `1px solid ${rematchPending ? 'var(--border-medium)' : 'var(--border-bright)'}`,
              borderRadius: 8,
              color: rematchPending ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: rematchPending ? 'not-allowed' : 'pointer',
              opacity: rematchPending ? 0.5 : 1,
              transition: 'all 150ms ease-out',
              fontFamily: 'var(--font-outfit), sans-serif',
            }}
          >
            {rematchPending ? 'Starting\u2026' : 'Rematch'}
          </button>
        ) : (
          <p className="waiting-pulse" style={{
            marginTop: 12, textAlign: 'center', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Waiting for host to start rematch&hellip;
          </p>
        )}

        {/* Back home */}
        <button
          onClick={() => {
            getSocket().emit('leave_room', { roomCode });
            router.push('/');
          }}
          style={{
            width: '100%',
            marginTop: 8,
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
