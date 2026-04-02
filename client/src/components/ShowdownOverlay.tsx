'use client';

import { useEffect, useState } from 'react';
import { ShowdownData, ShowdownParticipant, Card as CardType } from '@/context/GameContext';
import Card from './Card';

interface Props {
  data:    ShowdownData;
  myName:  string;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 6000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const RANK_NAME: Record<number, string> = {
  14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack',
  10: '10', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2',
};
const SUIT_NAME: Record<string, string> = {
  spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs',
};

function formatHandType(type: string, values: number[]): string {
  const r = (v: number) => RANK_NAME[v] ?? String(v);
  if (type === 'trail')          return `Trail of ${r(values[0])}s`;
  if (type === 'pure_sequence')  return 'Pure Sequence';
  if (type === 'sequence')       return 'Sequence';
  if (type === 'color')          return 'Color';
  if (type === 'pair')           return `Pair of ${r(values[0])}s`;
  if (type === 'high_card')      return `${r(values[0])} High`;
  // Poker types: title-case
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function cardLabel(c: CardType): string {
  return `${RANK_NAME[c.rank] ?? c.rank} of ${SUIT_NAME[c.suit] ?? c.suit}`;
}

const ROUND_HAND_LABEL: Record<number, string> = {
  4: 'MUFLIS',
  5: 'BEST HAND',
  6: 'POKER',
};

// ── Card row with optional annotations ───────────────────────────────────────

function CardRow({ p, round }: { p: ShowdownParticipant; round: number }) {
  if (p.cards.length === 0) return null;

  const jokerKey = p.jokerOriginalCard
    ? `${p.jokerOriginalCard.rank}-${p.jokerOriginalCard.suit}`
    : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {p.cards.map((c, i) => {
          const isJoker = jokerKey === `${c.rank}-${c.suit}`;
          return (
            <div key={i} style={{ position: 'relative' }}>
              <Card card={c} totalCards={p.cards.length} mini />
              {isJoker && (
                <div style={{
                  position: 'absolute', top: 2, right: 2,
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                  padding: '1px 3px', borderRadius: 3,
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                }}>
                  WILD
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Round-specific annotations */}
      {round === 2 && p.imaginedCard && (
        <div style={{
          marginTop: 5, fontSize: 10, color: 'var(--text-muted)',
          letterSpacing: '0.06em',
        }}>
          Imagined: {cardLabel(p.imaginedCard)}
        </div>
      )}
{ROUND_HAND_LABEL[round] && (
        <div style={{
          marginTop: 4, fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          {ROUND_HAND_LABEL[round]}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  const me = data.participants.find((p) => p.name === myName);
  const myRole = me?.role ?? 'safe';
  const payerCount = data.participants.filter((p) => p.role === 'payer').length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: '0 16px',
      }}
    >
      <div
        className="showdown-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 12,
          padding: 24,
          width: '100%', maxWidth: 400,
          maxHeight: '80dvh', overflowY: 'auto',
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
            const isWinner = !data.tie && p.role === 'winner';
            const isPayer  = !data.tie && p.role === 'payer';

            let roleLabel: string | null = null;
            if (data.tie) {
              roleLabel = 'TIE';
            } else if (!data.isPublic) {
              if (isWinner)     roleLabel = `WON +$${data.payout}`;
              else if (isPayer) roleLabel = `LOST -$${data.eachPayerPays}`;
              else              roleLabel = 'SAFE';
            } else if (isWinner) {
              roleLabel = 'WINNER';
            }

            const handLabel = p.handType
              ? formatHandType(p.handType, p.handValues ?? [])
              : null;

            return (
              <div
                key={p.name}
                style={{
                  padding: '10px 12px',
                  background: isWinner ? 'var(--accent-glow)' : 'transparent',
                  borderLeft: `2px solid ${
                    isWinner ? 'var(--border-bright)'
                    : isPayer ? 'var(--color-red, #c0392b)'
                    : 'var(--border-subtle)'
                  }`,
                  borderRadius: 4,
                }}
              >
                {/* Name row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 8,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 500,
                    color: isWinner ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}>
                    {p.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    {handLabel && (
                      <span style={{
                        fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}>
                        {handLabel}
                      </span>
                    )}
                    {roleLabel && (
                      <span style={{
                        fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
                        color: isWinner ? 'var(--text-primary)'
                             : isPayer ? '#c0392b'
                             : 'var(--text-muted)',
                      }}>
                        {roleLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards + annotations */}
                {!data.isPublic && <CardRow p={p} round={data.round} />}
              </div>
            );
          })}
        </div>

        {/* Divider + summary */}
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16, textAlign: 'center',
        }}>
          {data.tie ? (
            <p style={{
              fontSize: 15, fontWeight: 700, color: 'var(--text-muted)',
              fontFamily: 'var(--font-jetbrains-mono), monospace', marginBottom: 4,
            }}>
              TIE — No payout
            </p>
          ) : !data.isPublic ? (
            <p style={{
              fontSize: 15, fontWeight: 700,
              color: myRole === 'winner' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-jetbrains-mono), monospace', marginBottom: 4,
            }}>
              {myRole === 'winner' ? `WON +$${data.payout}`
               : myRole === 'payer' ? `LOST -$${data.eachPayerPays}`
               : 'SAFE'}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {data.winner} wins the showdown (+${data.payout})
            </p>
          )}
          {!data.tie && !data.isPublic && payerCount > 1 && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {payerCount} payers &times; ${data.eachPayerPays} each
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
