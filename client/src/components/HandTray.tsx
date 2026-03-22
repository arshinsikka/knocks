'use client';

import { useRef, useEffect } from 'react';
import Card from './Card';
import { Card as CardType } from '@/context/GameContext';
import { sounds } from '@/lib/sounds';

interface Props {
  cards: CardType[];
  selectedCards?: CardType[];
  round?: number;
}

const HAND_LABEL: Record<number, string> = {
  4: 'MUFLIS HAND',
  5: 'BEST HAND',
  6: 'POKER HAND',
};

function cardKey(c: CardType) { return `${c.rank}-${c.suit}`; }

export default function HandTray({ cards, selectedCards = [], round = 1 }: Props) {
  const count = cards.length;
  const overlapping = count >= 4;
  const overlapMargin = count === 6 ? -12 : count === 5 ? -10 : -8;

  // Highlighting applies only when there's a subset to show (rounds 4-6)
  const highlightActive = round >= 4 && selectedCards.length > 0 && selectedCards.length < count;
  const selectedSet = new Set(selectedCards.map(cardKey));

  // Play deal sound for each newly arrived card with slight stagger + pitch variation
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (count > prevCountRef.current) {
      const newCards = count - prevCountRef.current;
      for (let i = 0; i < newCards; i++) {
        const pitchMod = 0.85 + Math.random() * 0.3;
        if (i === 0) {
          sounds.deal(pitchMod);
        } else {
          setTimeout(() => sounds.deal(pitchMod), i * 70);
        }
      }
    }
    prevCountRef.current = count;
  }, [count]);

  const label = highlightActive ? HAND_LABEL[round] : null;

  return (
    <div style={{
      height: 120,
      background: 'var(--bg-elevated)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 16px',
      gap: 4,
    }}>
      {count === 0 ? (
        <span className="waiting-pulse" style={{
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Waiting for deal
        </span>
      ) : (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: overlapping ? 0 : (count <= 2 ? 8 : 6),
          }}>
            {cards.map((card, i) => {
              const isSelected = !highlightActive || selectedSet.has(cardKey(card));
              return (
                <div
                  key={i}
                  style={{
                    ...(overlapping ? { marginLeft: i === 0 ? 0 : overlapMargin, zIndex: i } : {}),
                    transform: isSelected ? 'translateY(-12px)' : 'translateY(0) scale(0.9)',
                    opacity: isSelected ? 1 : 0.4,
                    transition: 'transform 0.3s ease, opacity 0.3s ease',
                    boxShadow: isSelected && highlightActive
                      ? '0 -2px 0 0 rgba(255,255,255,0.25)'
                      : 'none',
                    borderRadius: 4,
                  }}
                >
                  <Card card={card} totalCards={count} index={i} />
                </div>
              );
            })}
          </div>
          {label && (
            <span style={{
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              {label}
            </span>
          )}
        </>
      )}
    </div>
  );
}
