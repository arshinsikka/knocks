import { classifyHand, compareHands } from '../TeenPatti';
import { Card } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

// Suits shorthand
const S = 'spades' as const;
const H = 'hearts' as const;
const D = 'diamonds' as const;
const C = 'clubs' as const;

// ── classifyHand ─────────────────────────────────────────────────────────────

describe('classifyHand — type detection', () => {
  test('trail: three of a kind', () => {
    const h = classifyHand([c(7, S), c(7, H), c(7, D)]);
    expect(h.type).toBe('trail');
    expect(h.values[0]).toBe(7);
  });

  test('pure_sequence: flush straight', () => {
    const h = classifyHand([c(9, H), c(8, H), c(7, H)]);
    expect(h.type).toBe('pure_sequence');
  });

  test('sequence: straight not flush', () => {
    const h = classifyHand([c(9, H), c(8, D), c(7, H)]);
    expect(h.type).toBe('sequence');
  });

  test('color: flush not straight', () => {
    const h = classifyHand([c(2, S), c(5, S), c(9, S)]);
    expect(h.type).toBe('color');
  });

  test('pair: matching pair', () => {
    const h = classifyHand([c(10, S), c(10, H), c(3, D)]);
    expect(h.type).toBe('pair');
    expect(h.values[0]).toBe(10);  // pair rank
    expect(h.values[1]).toBe(3);   // kicker rank
  });

  test('high_card: nothing', () => {
    const h = classifyHand([c(2, S), c(5, H), c(9, D)]);
    expect(h.type).toBe('high_card');
  });

  test('A-K-Q is highest sequence (rank 12)', () => {
    const h = classifyHand([c(14, S), c(13, H), c(12, D)]);
    expect(h.type).toBe('sequence');
    expect(h.values[0]).toBe(12);
  });

  test('A-K-Q same suit is highest pure_sequence (rank 12)', () => {
    const h = classifyHand([c(14, S), c(13, S), c(12, S)]);
    expect(h.type).toBe('pure_sequence');
    expect(h.values[0]).toBe(12);
  });

  test('A-2-3 is second-highest sequence (rank 11)', () => {
    const h = classifyHand([c(14, S), c(2, H), c(3, D)]);
    expect(h.type).toBe('sequence');
    expect(h.values).toEqual([11]);
  });

  test('A-2-3 same suit is second-highest pure_sequence (rank 11)', () => {
    const h = classifyHand([c(14, S), c(2, S), c(3, S)]);
    expect(h.type).toBe('pure_sequence');
    expect(h.values).toEqual([11]);
  });

  test('K-A-2 is NOT a sequence', () => {
    const h = classifyHand([c(13, S), c(14, H), c(2, D)]);
    expect(h.type).not.toBe('sequence');
    expect(h.type).not.toBe('pure_sequence');
  });
});

// ── compareHands — normal mode ────────────────────────────────────────────────

describe('compareHands — normal mode', () => {
  test('trail beats pure_sequence', () => {
    const trail = classifyHand([c(2, S), c(2, H), c(2, D)]);
    const ps = classifyHand([c(14, S), c(13, S), c(12, S)]);
    expect(compareHands(trail, ps, 'normal')).toBe(1);
  });

  test('pure_sequence beats sequence', () => {
    const ps = classifyHand([c(5, H), c(4, H), c(3, H)]);
    const seq = classifyHand([c(5, S), c(4, H), c(3, D)]);
    expect(compareHands(ps, seq, 'normal')).toBe(1);
  });

  test('sequence beats color', () => {
    const seq = classifyHand([c(4, S), c(3, H), c(2, D)]);
    const col = classifyHand([c(14, S), c(11, S), c(6, S)]);
    expect(compareHands(seq, col, 'normal')).toBe(1);
  });

  test('color beats pair', () => {
    const col = classifyHand([c(2, H), c(4, H), c(6, H)]);
    const pair = classifyHand([c(14, S), c(14, H), c(13, D)]);
    expect(compareHands(col, pair, 'normal')).toBe(1);
  });

  test('pair beats high_card', () => {
    const pair = classifyHand([c(2, S), c(2, H), c(3, D)]);
    const hc = classifyHand([c(14, S), c(13, H), c(11, D)]);
    expect(compareHands(pair, hc, 'normal')).toBe(1);
  });

  test('higher trail wins', () => {
    const a = classifyHand([c(8, S), c(8, H), c(8, D)]);
    const b = classifyHand([c(7, S), c(7, H), c(7, D)]);
    expect(compareHands(a, b, 'normal')).toBe(1);
  });

  test('A-K-Q sequence > A-2-3 sequence', () => {
    const high = classifyHand([c(14, S), c(13, H), c(12, D)]);
    const low = classifyHand([c(14, H), c(2, D), c(3, C)]);
    expect(compareHands(high, low, 'normal')).toBe(1);
  });

  test('A-2-3 sequence beats K-Q-J sequence', () => {
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    const kqj = classifyHand([c(13, S), c(12, H), c(11, D)]);
    expect(compareHands(a23, kqj, 'normal')).toBe(1);
  });

  test('A-2-3 sequence beats 5-4-3 sequence', () => {
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    const s543 = classifyHand([c(5, S), c(4, H), c(3, D)]);
    expect(compareHands(a23, s543, 'normal')).toBe(1);
  });

  test('A-2-3 sequence beats 4-3-2 sequence', () => {
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    const s432 = classifyHand([c(4, S), c(3, H), c(2, D)]);
    expect(compareHands(a23, s432, 'normal')).toBe(1);
  });

  test('4-3-2 is the lowest sequence (rank 1)', () => {
    const s432 = classifyHand([c(4, S), c(3, H), c(2, D)]);
    expect(s432.type).toBe('sequence');
    expect(s432.values[0]).toBe(1);
  });

  test('A-2-3 pure sequence beats K-Q-J pure sequence', () => {
    const a23ps = classifyHand([c(14, S), c(2, S), c(3, S)]);
    const kqjps = classifyHand([c(13, H), c(12, H), c(11, H)]);
    expect(compareHands(a23ps, kqjps, 'normal')).toBe(1);
  });

  test('A-K-Q pure sequence beats A-2-3 pure sequence', () => {
    const akqps = classifyHand([c(14, S), c(13, S), c(12, S)]);
    const a23ps = classifyHand([c(14, H), c(2, H), c(3, H)]);
    expect(compareHands(akqps, a23ps, 'normal')).toBe(1);
  });

  test('4-3-2 pure sequence is the lowest (rank 1)', () => {
    const ps432 = classifyHand([c(4, S), c(3, S), c(2, S)]);
    expect(ps432.type).toBe('pure_sequence');
    expect(ps432.values[0]).toBe(1);
  });

  test('same type: higher values win — color', () => {
    const a = classifyHand([c(14, S), c(10, S), c(5, S)]);
    const b = classifyHand([c(13, S), c(10, S), c(9, S)]);
    expect(compareHands(a, b, 'normal')).toBe(1);
  });

  test('pair tiebreak: higher pair rank wins', () => {
    const a = classifyHand([c(10, S), c(10, H), c(3, D)]);
    const b = classifyHand([c(9, S), c(9, H), c(14, D)]);
    expect(compareHands(a, b, 'normal')).toBe(1);
  });

  test('pair tiebreak: same pair, higher kicker wins', () => {
    const a = classifyHand([c(5, S), c(5, H), c(14, D)]);
    const b = classifyHand([c(5, D), c(5, C), c(13, S)]);
    expect(compareHands(a, b, 'normal')).toBe(1);
  });
});

// ── suit tiebreak ─────────────────────────────────────────────────────────────

describe('suit tiebreak', () => {
  test('round 1 — same high cards, spades beats hearts', () => {
    const a = classifyHand([c(14, S), c(10, H), c(5, D)]);
    const b = classifyHand([c(14, H), c(10, S), c(5, C)]);
    // round 1: suit tiebreaker active — spades(4) > hearts(3)
    expect(compareHands(a, b, 'normal', 1)).toBe(1);
  });

  test('round 2+ — identical ranks, no suit tiebreak → tie (0)', () => {
    const a = classifyHand([c(14, S), c(10, H), c(5, D)]);
    const b = classifyHand([c(14, H), c(10, S), c(5, C)]);
    // round 2: no suit tiebreaker — same type and rank values → 0
    expect(compareHands(a, b, 'normal', 2)).toBe(0);
  });
});

// ── muflis mode ────────────────────────────────────────────────────────────────

describe('compareHands — muflis mode', () => {
  test('2-3-5 offsuit is the absolute best muflis hand', () => {
    const best = classifyHand([c(2, S), c(3, H), c(5, D)]);  // high_card, offsuit
    const trail = classifyHand([c(2, S), c(2, H), c(2, D)]);  // worst trail
    expect(compareHands(best, trail, 'muflis')).toBe(1);
  });

  test('AAA is worst muflis hand (trail = worst type in muflis)', () => {
    const aces = classifyHand([c(14, S), c(14, H), c(14, D)]);
    const hc = classifyHand([c(2, S), c(4, H), c(6, D)]);
    expect(compareHands(hc, aces, 'muflis')).toBe(1);
  });

  test('muflis: high_card beats trail', () => {
    const hc = classifyHand([c(10, S), c(7, H), c(3, D)]);
    const trail = classifyHand([c(5, S), c(5, H), c(5, D)]);
    expect(compareHands(hc, trail, 'muflis')).toBe(1);
  });

  test('muflis reversed type order: high_card > pair > color > sequence > pure_sequence > trail', () => {
    const hc = classifyHand([c(2, S), c(4, H), c(7, D)]);
    const pair = classifyHand([c(2, S), c(2, H), c(3, D)]);
    const color = classifyHand([c(2, S), c(4, S), c(6, S)]);
    const seq = classifyHand([c(4, S), c(3, H), c(2, D)]);
    const ps = classifyHand([c(4, S), c(3, S), c(2, S)]);
    const trail = classifyHand([c(3, S), c(3, H), c(3, D)]);

    expect(compareHands(hc, pair, 'muflis')).toBe(1);
    expect(compareHands(pair, color, 'muflis')).toBe(1);
    expect(compareHands(color, seq, 'muflis')).toBe(1);
    expect(compareHands(seq, ps, 'muflis')).toBe(1);
    expect(compareHands(ps, trail, 'muflis')).toBe(1);
  });

  test('muflis: lower card values win within same type', () => {
    const a = classifyHand([c(2, S), c(4, H), c(6, D)]); // high_card [6,4,2]
    const b = classifyHand([c(3, S), c(5, H), c(7, D)]); // high_card [7,5,3]
    expect(compareHands(a, b, 'muflis')).toBe(1); // lower values = better muflis
  });

  test('2-3-5 offsuit beats any high_card in muflis', () => {
    const hand235 = classifyHand([c(2, S), c(3, H), c(5, D)]);
    // Even 2-3-4 which is lower
    const hand234 = classifyHand([c(2, H), c(3, D), c(4, C)]);
    // 2-3-4 offsuit would normally lose in value to 2-3-5, but 2-3-5 has special rule
    // In normal high_card muflis: lower wins, so 2-3-4 would beat 2-3-5 on values alone
    // But 2-3-5 has the absolute special rule overriding
    expect(compareHands(hand235, hand234, 'muflis')).toBe(1);
  });

  test('muflis: 4-3-2 sequence beats A-2-3 sequence (reversed ranking)', () => {
    const s432 = classifyHand([c(4, S), c(3, H), c(2, D)]);
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    expect(compareHands(s432, a23, 'muflis')).toBe(1);
  });

  test('muflis: A-2-3 sequence beats A-K-Q sequence (reversed ranking)', () => {
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    const akq = classifyHand([c(14, H), c(13, D), c(12, C)]);
    expect(compareHands(a23, akq, 'muflis')).toBe(1);
  });
});

// ── muflis head-to-head comparisons (BUG 2) ──────────────────────────────────
describe('compareHands — muflis head-to-head edge cases', () => {
  test('2-3-5 offsuit beats Trail (worst muflis hand)', () => {
    const hand235 = classifyHand([c(2, S), c(3, H), c(5, D)]);
    const trail = classifyHand([c(14, S), c(14, H), c(14, D)]); // worst trail
    expect(compareHands(hand235, trail, 'muflis')).toBe(1);
  });

  test('2-3-5 offsuit beats Pure Sequence', () => {
    const hand235 = classifyHand([c(2, S), c(3, H), c(5, D)]);
    const ps = classifyHand([c(4, S), c(3, S), c(2, S)]);
    expect(compareHands(hand235, ps, 'muflis')).toBe(1);
  });

  test('2-3-5 offsuit beats any High Card (even lower-value high card)', () => {
    const hand235 = classifyHand([c(2, S), c(3, H), c(5, D)]);
    // 2-3-4 would normally beat 2-3-5 on values alone (lower), but 2-3-5 has special rule
    const hand234 = classifyHand([c(2, H), c(3, D), c(4, C)]);
    expect(compareHands(hand235, hand234, 'muflis')).toBe(1);
  });

  test('High Card 7-4-2 beats Pair of 2s in muflis', () => {
    const hc = classifyHand([c(7, S), c(4, H), c(2, D)]);
    const pair = classifyHand([c(2, S), c(2, H), c(14, D)]);
    expect(compareHands(hc, pair, 'muflis')).toBe(1);
  });

  test('Pair of 3s beats Sequence 4-5-6 in muflis', () => {
    const pair = classifyHand([c(3, S), c(3, H), c(14, D)]);
    const seq = classifyHand([c(4, S), c(5, H), c(6, D)]);
    expect(compareHands(pair, seq, 'muflis')).toBe(1);
  });

  test('Pair of 2s beats Pair of Aces in muflis (lower pair rank wins)', () => {
    const twos = classifyHand([c(2, S), c(2, H), c(14, D)]);
    const aces = classifyHand([c(14, S), c(14, H), c(2, D)]);
    expect(compareHands(twos, aces, 'muflis')).toBe(1);
  });

  test('High Card 5-3-2 beats High Card 5-4-2 in muflis (lower second card wins)', () => {
    const a = classifyHand([c(5, S), c(3, H), c(2, D)]);
    const b = classifyHand([c(5, H), c(4, D), c(2, C)]);
    expect(compareHands(a, b, 'muflis')).toBe(1);
  });

  test('A-2-3 is correctly identified as Sequence (not High Card) in muflis context', () => {
    const a23 = classifyHand([c(14, S), c(2, H), c(3, D)]);
    expect(a23.type).toBe('sequence');
    // In muflis, high_card beats sequence — A-2-3 should lose to any high card
    const hc = classifyHand([c(13, S), c(11, H), c(9, D)]);
    expect(compareHands(hc, a23, 'muflis')).toBe(1);
  });
});
