import { Card, ClassifiedHand, HandType, HAND_RANK, SUIT_ORDER } from './types';

// ── helpers ──────────────────────────────────────────────────────────────────

function sorted(cards: Card[]): Card[] {
  return [...cards].sort((a, b) =>
    b.rank !== a.rank ? b.rank - a.rank : SUIT_ORDER[b.suit] - SUIT_ORDER[a.suit],
  );
}

function isFlush(cards: Card[]): boolean {
  return cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
}

/**
 * Returns the sequence rank-triple if the three cards form a straight,
 * else null.  Ace wraps LOW only in A-2-3 (returns [3,2,1] for sort).
 * K-A-2 is NOT a sequence.
 */
function sequenceValues(cards: Card[]): number[] | null {
  const ranks = sorted(cards).map((c) => c.rank);
  // Normal straight
  if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1) {
    return ranks;
  }
  // A-2-3  (sorted = [14,3,2])
  if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
    return [3, 2, 1]; // treat Ace as 1 for comparison
  }
  return null;
}

// ── classifyHand ─────────────────────────────────────────────────────────────

export function classifyHand(cards: Card[]): ClassifiedHand {
  if (cards.length !== 3) throw new Error('classifyHand requires exactly 3 cards');

  const s = sorted(cards);
  const flush = isFlush(s);
  const seqVals = sequenceValues(s);

  // Trail (three of a kind)
  if (s[0].rank === s[1].rank && s[1].rank === s[2].rank) {
    return { type: 'trail', values: [s[0].rank], cards: s };
  }

  // Pure sequence (flush + straight)
  if (seqVals && flush) {
    return { type: 'pure_sequence', values: seqVals, cards: s };
  }

  // Sequence (straight, not flush)
  if (seqVals) {
    return { type: 'sequence', values: seqVals, cards: s };
  }

  // Color (flush, not straight)
  if (flush) {
    return { type: 'color', values: s.map((c) => c.rank), cards: s };
  }

  // Pair
  let pairRank: number | null = null;
  let kicker: Card | null = null;
  if (s[0].rank === s[1].rank) {
    pairRank = s[0].rank;
    kicker = s[2];
  } else if (s[1].rank === s[2].rank) {
    pairRank = s[1].rank;
    kicker = s[0];
  }
  if (pairRank !== null && kicker !== null) {
    return {
      type: 'pair',
      values: [pairRank, kicker.rank, SUIT_ORDER[kicker.suit]],
      cards: s,
    };
  }

  // High card
  return {
    type: 'high_card',
    values: s.map((c) => c.rank),
    cards: s,
  };
}

// ── compareHands ─────────────────────────────────────────────────────────────

/** Returns 1 if A wins, -1 if B wins, 0 if absolute tie */
export function compareHands(
  a: ClassifiedHand,
  b: ClassifiedHand,
  mode: 'normal' | 'muflis' = 'normal',
): 1 | -1 | 0 {
  // Muflis special case: 2-3-5 offsuit is absolute best
  if (mode === 'muflis') {
    const is235 = (h: ClassifiedHand) =>
      h.type === 'high_card' &&
      h.cards.map((c) => c.rank).sort((x, y) => x - y).join(',') === '2,3,5';

    const a235 = is235(a);
    const b235 = is235(b);
    if (a235 && !b235) return 1;
    if (!a235 && b235) return -1;
    if (a235 && b235) return 0; // both 2-3-5 (impossible with one deck, but safe)
  }

  const typeRankA = HAND_RANK[a.type];
  const typeRankB = HAND_RANK[b.type];

  // Type comparison
  if (typeRankA !== typeRankB) {
    if (mode === 'normal') return typeRankA > typeRankB ? 1 : -1;
    // Muflis: lower type rank wins
    return typeRankA < typeRankB ? 1 : -1;
  }

  // Same type — compare values
  const len = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < len; i++) {
    const av = a.values[i] ?? 0;
    const bv = b.values[i] ?? 0;
    if (av !== bv) {
      if (mode === 'normal') return av > bv ? 1 : -1;
      // Muflis: lower value wins
      return av < bv ? 1 : -1;
    }
  }

  // Suit tiebreak (always: higher suit wins regardless of mode)
  const suitA = SUIT_ORDER[a.cards[0].suit];
  const suitB = SUIT_ORDER[b.cards[0].suit];
  if (suitA !== suitB) return suitA > suitB ? 1 : -1;

  return 0;
}
