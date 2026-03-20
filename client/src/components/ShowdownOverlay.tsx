'use client';

import { useEffect, useState } from 'react';
import { ShowdownData } from '@/context/GameContext';
import Card from './Card';

interface Props {
  data:    ShowdownData;
  myName:  string;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 6000;

export default function ShowdownOverlay({ data, myName, onClose }: Props) {
  const [remaining, setRemaining] = useState(AUTO_DISMISS_MS / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(interval); onClose(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onClose]);

  const amIWinner = data.winner === myName;

  return (
    <div
      onClick={onClose}
      style={{
        position:   'fixed',
        inset:      0,
        background: 'rgba(0,0,0,0.85)',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex:     60,
        padding:    '0 16px',
      }}
    >
      <div
        className="showdown-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:   'var(--bg-elevated)',
          border:       '1px solid var(--border-medium)',
          borderRadius: 12,
          padding:      24,
          width:        '100%',
          maxWidth:     400,
          maxHeight:    '80dvh',
          overflowY:    'auto',
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20,
        }}>
          Showdown
        </div>

        {/* Participants */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          {data.participants.map((p) => {
            const isWinner = !data.tie && p.name === data.winner;
            return (
              <div
                key={p.name}
                style={{
                  padding:    '10px 12px',
                  background: isWinner ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: `2px solid ${isWinner ? 'var(--border-bright)' : 'var(--border-subtle)'}`,
                  borderRadius: 4,
                }}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: p.cards.length > 0 ? 10 : 0,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 500,
                    color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {p.name}
                    {isWinner && (
                      <span style={{
                        marginLeft: 8, fontSize: 9, letterSpacing: '0.1em',
                        color: 'var(--text-muted)',
                      }}>
                        WINNER
                      </span>
                    )}
                  </span>
                  {p.handType && (
                    <span style={{
                      fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}>
                      {p.handType.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Cards (participants only) */}
                {!data.isPublic && p.cards.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {p.cards.map((c, i) => (
                      <Card key={i} card={c} totalCards={p.cards.length} mini />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider + result */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16, textAlign: 'center',
        }}>
          {data.tie ? (
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              marginBottom: 4,
            }}>
              TIE — No payout
            </p>
          ) : !data.isPublic ? (
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: amIWinner ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              marginBottom: 4,
            }}>
              {amIWinner
                ? `+$${data.payout} collected`
                : `-$${data.eachLoserPays} paid`}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {data.winner} wins the showdown (+${data.payout})
            </p>
          )}
          {!data.tie && data.participants.length > 2 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {data.participants.length - 1} losers &times; ${data.eachLoserPays} each
            </p>
          )}
        </div>

        {/* Countdown */}
        <div style={{
          marginTop: 16, textAlign: 'center',
          fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em',
        }}>
          Tap to close &middot; {remaining}s
        </div>
      </div>
    </div>
  );
}

/** Small toast for non-participants */
export function ShowdownToast({
  winnerName, payout, tie, onClose,
}: { winnerName: string | null; payout: number; tie?: boolean; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="knock-banner"
      style={{
        position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 6,
        padding: '8px 20px',
        fontSize: 12, color: 'var(--text-secondary)',
        letterSpacing: '0.05em',
        zIndex: 55,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {tie ? 'Showdown tied — no payout' : `${winnerName} won the showdown (+$${payout})`}
    </div>
  );
}
