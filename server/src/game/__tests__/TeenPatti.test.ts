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

  test('A-K-Q is highest pure_sequence', () => {
    const h = classifyHand([c(14, S), c(13, H), c(12, D)]);
    expect(h.type).toBe('sequence');
    expect(h.values[0]).toBe(14);
  });

  test('A-K-Q same suit is highest pure_sequence', () => {
    const h = classifyHand([c(14, S), c(13, S), c(12, S)]);
    expect(h.type).toBe('pure_sequence');
    expect(h.values[0]).toBe(14);
  });

  test('A-2-3 is lowest sequence (Ace wraps low)', () => {
    const h = classifyHand([c(14, S), c(2, H), c(3, D)]);
    expect(h.type).toBe('sequence');
    expect(h.values).toEqual([3, 2, 1]); // Ace treated as 1
  });

  test('A-2-3 same suit is lowest pure_sequence', () => {
    const h = classifyHand([c(14, S), c(2, S), c(3, S)]);
    expect(h.type).toBe('pure_sequence');
    expect(h.values).toEqual([3, 2, 1]);
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
  test('same high cards — spades beats hearts', () => {
    const a = classifyHand([c(14, S), c(10, H), c(5, D)]);
    const b = classifyHand([c(14, H), c(10, S), c(5, C)]);
    // a: high-card [14,10,5], first card suit=spades(4) vs hearts(3)
    expect(compareHands(a, b, 'normal')).toBe(1);
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
});
