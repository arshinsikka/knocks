import { Card, PokerHand, PokerHandType, POKER_HAND_RANK } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sorted5(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}

/**
 * Returns the top rank of the straight (i.e. the highest card rank,
 * but A-2-3-4-5 returns 5 since Ace acts as 1).
 * Returns null if not a straight.  K-A-2-3-4 is NOT valid.
 */
function straightTopRank(sortedRanks: number[]): number | null {
  const [r0, r1, r2, r3, r4] = sortedRanks;
  // Normal straight: all consecutive (covers A-K-Q-J-10 through 6-5-4-3-2)
  if (r0 - r1 === 1 && r1 - r2 === 1 && r2 - r3 === 1 && r3 - r4 === 1) {
    return r0;
  }
  // Wheel: A-2-3-4-5 (sorted = [14,5,4,3,2])
  if (r0 === 14 && r1 === 5 && r2 === 4 && r3 === 3 && r4 === 2) {
    return 5;
  }
  return null;
}

// ── classifyPokerHand ─────────────────────────────────────────────────────────

/**
 * Classifies exactly 5 cards into a poker hand with comparison values.
 * Values are descending — higher = better for tiebreaking.
 */
export function classifyPokerHand(cards: Card[]): PokerHand {
  if (cards.length !== 5) throw new Error('classifyPokerHand requires exactly 5 cards');

  const sorted  = sorted5(cards);
  const ranks   = sorted.map((c) => c.rank);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const topStr  = straightTopRank(ranks);

  // Straight Flush / Royal Flush
  if (isFlush && topStr !== null) {
    return topStr === 14
      ? { type: 'royal_flush',    values: [14],       cards: sorted }
      : { type: 'straight_flush', values: [topStr],   cards: sorted };
  }

  // Frequency groups: [[rank, count], ...] sorted by count desc, then rank desc
  const freqMap = new Map<number, number>();
  for (const r of ranks) freqMap.set(r, (freqMap.get(r) ?? 0) + 1);
  const groups = [...freqMap.entries()].sort(
    ([ra, ca], [rb, cb]) => cb !== ca ? cb - ca : rb - ra,
  );

  const r0 = groups[0][0], c0 = groups[0][1];
  const r1 = groups[1]?.[0] ?? 0, c1 = groups[1]?.[1] ?? 0;
  const r2 = groups[2]?.[0] ?? 0;
  const r3 = groups[3]?.[0] ?? 0;

  // Four of a Kind
  if (c0 === 4) {
    return { type: 'four_of_a_kind', values: [r0, r1], cards: sorted };
  }

  // Full House
  if (c0 === 3 && c1 === 2) {
    return { type: 'full_house', values: [r0, r1], cards: sorted };
  }

  // Flush (not straight — already handled above)
  if (isFlush) {
    return { type: 'flush', values: ranks, cards: sorted };
  }

  // Straight (not flush — already handled above)
  if (topStr !== null) {
    return { type: 'straight', values: [topStr], cards: sorted };
  }

  // Three of a Kind
  if (c0 === 3) {
    // r1 and r2 are the kickers; groups sorted by rank desc already
    const kickers = [r1, r2].sort((a, b) => b - a);
    return { type: 'three_of_a_kind', values: [r0, ...kickers], cards: sorted };
  }

  // Two Pair
  if (c0 === 2 && c1 === 2) {
    const highPair = Math.max(r0, r1);
    const lowPair  = Math.min(r0, r1);
    return { type: 'two_pair', values: [highPair, lowPair, r2], cards: sorted };
  }

  // One Pair
  if (c0 === 2) {
    const kickers = [r1, r2, r3].sort((a, b) => b - a);
    return { type: 'one_pair', values: [r0, ...kickers], cards: sorted };
  }

  // High Card
  return { type: 'high_card', values: ranks, cards: sorted };
}

// ── comparePokerHands ─────────────────────────────────────────────────────────

/** Returns 1 if a wins, -1 if b wins, 0 for a tie. No suit tiebreaker. */
export function comparePokerHands(a: PokerHand, b: PokerHand): 1 | -1 | 0 {
  const ra = POKER_HAND_RANK[a.type as PokerHandType];
  const rb = POKER_HAND_RANK[b.type as PokerHandType];

  if (ra !== rb) return ra > rb ? 1 : -1;

  const len = Math.max(a.values.length, b.values.length);
  for (let i = 0; i < len; i++) {
    const va = a.values[i] ?? 0;
    const vb = b.values[i] ?? 0;
    if (va !== vb) return va > vb ? 1 : -1;
  }
  return 0;
}

// ── bestPokerSubset ───────────────────────────────────────────────────────────

/**
 * Given 6 cards, generates all C(6,5) = 6 five-card subsets and returns
 * the strongest poker hand.
 */
export function bestPokerSubset(sixCards: Card[]): PokerHand {
  if (sixCards.length !== 6) throw new Error('bestPokerSubset requires exactly 6 cards');

  let best: PokerHand | null = null;
  for (let i = 0; i < sixCards.length; i++) {
    const subset = sixCards.filter((_, j) => j !== i);
    const hand   = classifyPokerHand(subset);
    if (!best || comparePokerHands(hand, best) === 1) best = hand;
  }
  return best!;
}
