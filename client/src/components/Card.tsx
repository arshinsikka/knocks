'use client';

import { Card as CardType } from '@/context/GameContext';

const RANK_LABEL: Record<number, string> = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
const SUIT_SYMBOL: Record<string, string> = {
  spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663',
};

function rank(r: number) { return RANK_LABEL[r] ?? String(r); }
function suit(s: string) { return SUIT_SYMBOL[s] ?? s; }

interface CardSize { w: number; h: number; fontSize: number; suitSize: number }

const SIZES: Record<number, CardSize> = {
  1: { w: 70, h: 100, fontSize: 18, suitSize: 28 },
  2: { w: 65, h: 95,  fontSize: 16, suitSize: 26 },
  3: { w: 60, h: 88,  fontSize: 15, suitSize: 24 },
  4: { w: 55, h: 82,  fontSize: 14, suitSize: 22 },
  5: { w: 50, h: 75,  fontSize: 13, suitSize: 20 },
};

interface Props {
  card: CardType;
  totalCards?: number;
  index?: number;
  mini?: boolean;  // 40×58 for showdown overlay
}

export default function Card({ card, totalCards = 1, index = 0, mini = false }: Props) {
  const sz = mini
    ? { w: 40, h: 58, fontSize: 11, suitSize: 14 }
    : (SIZES[Math.min(totalCards, 5) as keyof typeof SIZES] ?? SIZES[5]);

  const delayMs = index * 100;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitColor = isRed ? '#dc2626' : 'var(--card-text)';

  return (
    <div
      className="card-deal relative select-none shrink-0"
      style={{
        width:       sz.w,
        height:      sz.h,
        background:  'var(--card-face)',
        border:      '1px solid var(--border-medium)',
        boxShadow:   '0 2px 4px rgba(0,0,0,0.3)',
        borderRadius: 4,
        animationDelay: `${delayMs}ms`,
        color: suitColor,
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
      {/* Top-left corner */}
      <div
        style={{
          position: 'absolute', top: mini ? 3 : 4, left: mini ? 3 : 5,
          fontSize: sz.fontSize, fontWeight: 700, lineHeight: 1,
        }}
      >
        <div>{rank(card.rank)}</div>
        <div style={{ fontSize: sz.fontSize * 0.75, marginTop: 1 }}>{suit(card.suit)}</div>
      </div>

      {/* Center suit */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: sz.suitSize,
          lineHeight: 1,
        }}
      >
        {suit(card.suit)}
      </div>

      {/* Bottom-right corner (rotated) */}
      <div
        style={{
          position: 'absolute', bottom: mini ? 3 : 4, right: mini ? 3 : 5,
          fontSize: sz.fontSize, fontWeight: 700, lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <div>{rank(card.rank)}</div>
        <div style={{ fontSize: sz.fontSize * 0.75, marginTop: 1 }}>{suit(card.suit)}</div>
      </div>
    </div>
  );
}

/** Card back — shown for opponents in future rounds */
export function CardBack({ size = 60 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: Math.round(size * 1.45),
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 4,
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }}
    />
  );
}
