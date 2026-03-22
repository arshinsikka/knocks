'use client';

import { GameResult } from '@/context/GameContext';

interface Props {
  ledger: GameResult[];
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function fmt(value: number): string {
  return value >= 0 ? `+$${value}` : `-$${Math.abs(value)}`;
}

export default function LedgerPanel({ ledger, onClose }: Props) {
  if (ledger.length === 0) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end',
        }}
        onClick={onClose}
      >
        <div
          style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: '#111', borderRadius: '12px 12px 0 0',
            padding: '20px 24px 40px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Room Ledger
            </span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: '0 4px' }}
            >
              ×
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            No games played yet
          </p>
        </div>
      </div>
    );
  }

  // Running totals per player across all games
  const totals: Record<string, number> = {};
  for (const game of ledger) {
    for (const p of game.playerResults) {
      totals[p.name] = (totals[p.name] ?? 0) + p.finalBalance;
    }
  }
  const totalEntries = Object.entries(totals).sort((a, b) => b[1] - a[1]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: '#111', borderRadius: '12px 12px 0 0',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Room Ledger
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '0 24px 40px', flex: 1 }}>

          {/* Running totals */}
          <div style={{ paddingTop: 20, marginBottom: 24 }}>
            <div style={{
              fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 10,
            }}>
              Running Totals ({ledger.length} game{ledger.length !== 1 ? 's' : ''})
            </div>
            {totalEntries.map(([name, total]) => (
              <div key={name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
                <span style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 14, fontWeight: 700,
                  color: total >= 0 ? '#ffffff' : '#666666',
                }}>
                  {fmt(total)}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 20 }} />

          {/* Games in reverse order */}
          {[...ledger].reverse().map((game) => {
            const sorted = [...game.playerResults].sort((a, b) => b.finalBalance - a.finalBalance);
            return (
              <div key={game.gameNumber} style={{ marginBottom: 24 }}>
                {/* Game header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 10,
                }}>
                  <span style={{
                    fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}>
                    Game {game.gameNumber}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {formatDate(game.timestamp)}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  {game.winner} wins · {game.orbitsPlayed} orbit{game.orbitsPlayed !== 1 ? 's' : ''}
                </div>

                {/* Player rows */}
                {sorted.map((p) => (
                  <div key={p.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '5px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 12,
                        color: p.name === game.winner ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: p.name === game.winner ? 600 : 400,
                      }}>
                        {p.name}
                      </span>
                      {p.name === game.winner && (
                        <span style={{
                          fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                          border: '1px solid var(--border-medium)',
                          color: 'var(--text-muted)', padding: '1px 5px', borderRadius: 2,
                        }}>
                          Winner
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                        {p.knocks}K
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 12, fontWeight: 600,
                        color: p.finalBalance >= 0 ? '#ffffff' : '#666666',
                        minWidth: 48, textAlign: 'right',
                      }}>
                        {fmt(p.finalBalance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
