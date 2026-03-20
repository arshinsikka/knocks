'use client';

import Card from './Card';
import { Card as CardType } from '@/context/GameContext';

interface Props {
  cards: CardType[];
}

export default function HandTray({ cards }: Props) {
  const count = cards.length;
  const overlapping = count >= 4;
  const overlapMargin = count === 5 ? -10 : -8;

  return (
    <div style={{
      height: 100,
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
