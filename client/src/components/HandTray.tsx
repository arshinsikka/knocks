'use client';

import { useRef, useEffect } from 'react';
import Card from './Card';
import { Card as CardType } from '@/context/GameContext';
import { sounds } from '@/lib/sounds';

interface Props {
  cards: CardType[];
}

export default function HandTray({ cards }: Props) {
  const count = cards.length;
  const overlapping = count >= 4;
  const overlapMargin = count === 5 ? -10 : -8;

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

  return (
    <div style={{
      height: 120,
      background: 'var(--bg-elevated)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 16px',
    }}>
      {count === 0 ? (
        <span className="waiting-pulse" style={{
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Waiting for deal
        </span>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: overlapping ? 0 : (count <= 2 ? 8 : 6),
        }}>
          {cards.map((card, i) => (
            <div
              key={i}
              style={overlapping ? { marginLeft: i === 0 ? 0 : overlapMargin, zIndex: i } : {}}
            >
              <Card card={card} totalCards={count} index={i} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
