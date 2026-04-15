import { getBestHand, findJoker } from '../Rounds';
import { buildDeck } from '../Deck';
import { Card, ClassifiedHand } from '../types';
import { classifyHand, compareHands } from '../TeenPatti';

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

describe('getBestHand — round 1', () => {
  test('returns single-card pseudo-hand', () => {
    const hand = getBestHand([c(14, 'spades')], 1, [c(14, 'spades')]);
    expect(hand.cards.length).toBe(1);
    expect(hand.cards[0].rank).toBe(14);
  });

  test('higher rank card gives higher values[0]', () => {
    const ace = getBestHand([c(14, 'spades')], 1, [c(14, 'spades')]);
    const two = getBestHand([c(2, 'hearts')], 1, [c(2, 'hearts')]);
    expect(ace.values[0]).toBeGreaterThan(two.values[0]);
  });
});

describe('getBestHand — round 2', () => {
  test('returns a 3-card hand', () => {
    const cards = [c(14, 'spades'), c(14, 'hearts')];
    const hand = getBestHand(cards, 2, cards);
    expect(hand.cards.length).toBe(3);
  });

  test('with AA dealt, best hand should be trail (AAX) or at least pair', () => {
    const cards = [c(14, 'spades'), c(14, 'hearts')];
    const hand = getBestHand(cards, 2, cards);
    // Can't form trail (only one more Ace), but at least a pair
    expect(['trail', 'pure_sequence', 'sequence', 'color', 'pair']).toContain(hand.type);
  });

  test('does not use already-dealt cards as imagined third', () => {
    const allDealt = buildDeck(); // entire deck dealt
    // Only leave out one card — so no candidate available  edge case
    const cards = [c(2, 'spades'), c(3, 'hearts')];
    // With full deck dealt except these two, no candidates → should still return something
    // Actually if allDealt contains all 52 cards, candidates would be empty.
    // Real game won't deal entire deck, but code should handle gracefully.
    // We'll use partial allDealt:
    const partialDealt = [c(2, 'spades'), c(3, 'hearts'), c(4, 'diamonds')];
    const hand = getBestHand(cards, 2, partialDealt);
    expect(hand.cards.length).toBe(3);
  });
});

describe('getBestHand — round 3', () => {
  test('no wild: returns the 3 cards as classified', () => {
    // Two red + one red = no wild (not two same color + different)
    const cards = [c(5, 'hearts'), c(7, 'diamonds'), c(9, 'hearts')]; // all red, no wild
    const hand = getBestHand(cards, 3, cards);
    expect(hand.cards.length).toBe(3);
  });

  test('two red + one black → card2 is wild', () => {
    // c0=hearts(red), c1=diamonds(red), c2=spades(black) → wild
    const cards = [c(5, 'hearts'), c(6, 'diamonds'), c(7, 'spades')];
    const hand = getBestHand(cards, 3, cards);
    expect(hand.cards.length).toBe(3);
    // Best possible should be better than the raw [5H,6D,7S] sequence
    // since wild can be anything
  });

  test('two black + one red → card2 is wild', () => {
    const cards = [c(5, 'spades'), c(6, 'clubs'), c(7, 'hearts')];
    const hand = getBestHand(cards, 3, cards);
    expect(hand.cards.length).toBe(3);
  });

  test('two red + one red (all red) → no wild', () => {
    const cards = [c(5, 'hearts'), c(6, 'diamonds'), c(7, 'hearts')];
    const hand = getBestHand(cards, 3, cards);
    expect(hand.type).toBe('sequence'); // 5H-6D-7H is a sequence
  });
});

// ── Round 3 spec tests ────────────────────────────────────────────────────────
describe('getBestHand — round 3 spec tests', () => {
  // Test 1 — Joker detection by color composition
  describe('Test 1: joker detection', () => {
    test('[H5, S8, DK] 2R+1B → S8 is joker', () => {
      const cards: [Card, Card, Card] = [c(5, 'hearts'), c(8, 'spades'), c(13, 'diamonds')];
      expect(findJoker(cards)).toEqual(c(8, 'spades'));
    });
    test('[C3, HQ, S7] 2B+1R → HQ is joker', () => {
      const cards: [Card, Card, Card] = [c(3, 'clubs'), c(12, 'hearts'), c(7, 'spades')];
      expect(findJoker(cards)).toEqual(c(12, 'hearts'));
    });
    test('[H5, D8, DK] 3R → no joker', () => {
      const cards: [Card, Card, Card] = [c(5, 'hearts'), c(8, 'diamonds'), c(13, 'diamonds')];
      expect(findJoker(cards)).toBeNull();
    });
    test('[S5, C8, SK] 3B → no joker', () => {
      const cards: [Card, Card, Card] = [c(5, 'spades'), c(8, 'clubs'), c(13, 'spades')];
      expect(findJoker(cards)).toBeNull();
    });
  });

  // Test 2 — Substitution: joker replaced by optimal card
  test('Test 2: [H5, D5, SK] 2R+1B → SK is joker → trail 5-5-5', () => {
    const cards = [c(5, 'hearts'), c(5, 'diamonds'), c(13, 'spades')];
    const hand  = getBestHand(cards, 3, cards);
    expect(hand.type).toBe('trail');
    expect(hand.values[0]).toBe(5);
  });

  // Test 3 — Comparison: trail beats sequence
  test('Test 3: Player A trail-5s beats Player B seq A-K-Q', () => {
    // A: H5(R) D5(R) SK(B) → 2R+1B → SK joker → trail 5-5-5
    const cardsA = [c(5, 'hearts'), c(5, 'diamonds'), c(13, 'spades')];
    // B: HA(R) SK(B) CQ(B) → 1R+2B → HA joker, real=SK+CQ → best seq A-K-Q
    const cardsB = [c(14, 'hearts'), c(13, 'spades'), c(12, 'clubs')];
    const allDealt = [...cardsA, ...cardsB];
    const handA = getBestHand(cardsA, 3, allDealt);
    const handB = getBestHand(cardsB, 3, allDealt);
    expect(handA.type).toBe('trail');
    expect(['sequence', 'pure_sequence']).toContain(handB.type);
    expect(compareHands(handA as ClassifiedHand, handB as ClassifiedHand, 'normal', 3)).toBe(1);
  });

  // Test 4 — Tie: both best hands resolve to trail A-A-A
  test('Test 4: both players get trail A-A-A → TIE', () => {
    // A: HA(R) DA(R) SK(B) → 2R+1B → SK joker, real=HA+DA → trail A-A-A
    const cardsA = [c(14, 'hearts'), c(14, 'diamonds'), c(13, 'spades')];
    // B: SA(B) CA(B) HQ(R) → 2B+1R → HQ joker, real=SA+CA → trail A-A-A
    const cardsB = [c(14, 'spades'), c(14, 'clubs'), c(12, 'hearts')];
    const allDealt = [...cardsA, ...cardsB];
    const handA = getBestHand(cardsA, 3, allDealt);
    const handB = getBestHand(cardsB, 3, allDealt);
    expect(handA.type).toBe('trail');
    expect(handB.type).toBe('trail');
    expect(compareHands(handA as ClassifiedHand, handB as ClassifiedHand, 'normal', 3)).toBe(0);
  });

  // Test 5 — No joker for either (all same color) → compare flush ranks
  test('Test 5: [H5,H8,HK] flush beats [S3,S7,SQ] flush (K > Q)', () => {
    const cardsA = [c(5, 'hearts'), c(8, 'hearts'),  c(13, 'hearts')]; // all red, no joker
    const cardsB = [c(3, 'spades'), c(7, 'spades'),  c(12, 'spades')]; // all black, no joker
    const allDealt = [...cardsA, ...cardsB];
    const handA = getBestHand(cardsA, 3, allDealt);
    const handB = getBestHand(cardsB, 3, allDealt);
    expect(handA.type).toBe('color');
    expect(handB.type).toBe('color');
    expect(compareHands(handA as ClassifiedHand, handB as ClassifiedHand, 'normal', 3)).toBe(1);
  });

  // Legacy: wild [H7, D7, SK] RRB → trail beats RBB pair
  test('[H7, D7, SK] RRB trail beats [H5, S5, C2] RBB pair', () => {
    const cardsA  = [c(7, 'hearts'), c(7, 'diamonds'), c(13, 'spades')]; // RRB → SK joker → trail 7s
    const cardsB  = [c(5, 'hearts'), c(5, 'spades'),   c(2, 'clubs')];   // RBB → H5 joker, real=S5+C2 → pair 5
    const allDealt = [...cardsA, ...cardsB];
    const handA = getBestHand(cardsA, 3, allDealt);
    const handB = getBestHand(cardsB, 3, allDealt);
    expect(handA.type).toBe('trail');
    expect(handB.type).toBe('pair');
    expect(compareHands(handA as ClassifiedHand, handB as ClassifiedHand, 'normal', 3)).toBe(1);
  });
});

describe('getBestHand — round 4 (muflis)', () => {
  test('returns a 3-card subset', () => {
    const cards = [c(2, 'spades'), c(5, 'hearts'), c(8, 'diamonds'), c(11, 'clubs')];
    const hand = getBestHand(cards, 4, cards);
    expect(hand.cards.length).toBe(3);
  });

  test('picks weakest normal hand (best muflis) from 4 cards', () => {
    // Give cards that have a high-card subset: 2S,3H,5D → high_card (best muflis)
    // vs 2S,3H,4D → sequence (worse muflis)
    const cards = [c(2, 'spades'), c(3, 'hearts'), c(4, 'diamonds'), c(5, 'clubs')];
    const hand = getBestHand(cards, 4, cards);
    // 2-3-5 offsuit is special muflis best, but not achievable from 2,3,4,5 with suit constraint
    // Best muflis would be high_card subset
    expect(['high_card', 'pair', 'color']).toContain(hand.type);
  });
});

describe('getBestHand — round 5 (normal best)', () => {
  test('returns a 3-card subset', () => {
    const cards = [c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds'), c(2, 'clubs'), c(3, 'hearts')];
    const hand = getBestHand(cards, 5, cards);
    expect(hand.cards.length).toBe(3);
    expect(hand.type).toBe('trail'); // three 7s
  });

  test('picks best normal hand from 5 cards', () => {
    // Give a pure sequence hidden among weaker cards
    const cards = [
      c(9, 'spades'), c(8, 'spades'), c(7, 'spades'), // pure sequence
      c(2, 'hearts'), c(4, 'diamonds'),
    ];
    const hand = getBestHand(cards, 5, cards);
    expect(hand.type).toBe('pure_sequence');
  });
});

// ── Round 2 imagined-card suit precision ─────────────────────────────────────
describe('getBestHand — round 2 imagined card suit precision', () => {
  test('[10♥, Q♥] → imagined card must be J♥ (Pure Sequence, not J♠ Sequence)', () => {
    const cards = [c(10, 'hearts'), c(12, 'hearts')];
    const hand = getBestHand(cards, 2, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.cards.every((card) => card.suit === 'hearts')).toBe(true);
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([10, 11, 12]);
  });

  test('[A♣, K♣] → imagined card must be Q♣ (Pure Sequence, not Q♥ Sequence)', () => {
    const cards = [c(14, 'clubs'), c(13, 'clubs')];
    const hand = getBestHand(cards, 2, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.cards.every((card) => card.suit === 'clubs')).toBe(true);
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([12, 13, 14]);
  });
});

// ── Round 3 joker suit precision (BUG 1) ─────────────────────────────────────
describe('getBestHand — round 3 joker suit precision', () => {
  // Each test: 2 real cards of same color + 1 odd-color joker card.
  // The joker's actual rank/suit are irrelevant; we verify the best sub is chosen.

  test('[AH, QH, joker=2S] → Pure Sequence A-K-Q hearts (not impure sequence)', () => {
    // 2R+1B: 2♠ is joker, realCards=[A♥, Q♥]
    const cards = [c(14, 'hearts'), c(12, 'hearts'), c(2, 'spades')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.values[0]).toBe(12); // A-K-Q sequence rank
    expect(hand.cards.every((card) => card.suit === 'hearts')).toBe(true);
  });

  test('[7S, 8S, joker=2H] → Pure Sequence 7-8-9 spades (not impure, not 6-7-8)', () => {
    // 2B+1R: 2♥ is joker, realCards=[7♠, 8♠]
    const cards = [c(7, 'spades'), c(8, 'spades'), c(2, 'hearts')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.cards.every((card) => card.suit === 'spades')).toBe(true);
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([7, 8, 9]); // NOT [6,7,8] (lower) and not 9 of another suit
  });

  test('[AC, KC, joker=2H] → Pure Sequence A-K-Q clubs', () => {
    // 2B+1R: 2♥ is joker, realCards=[A♣, K♣]
    const cards = [c(14, 'clubs'), c(13, 'clubs'), c(2, 'hearts')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.values[0]).toBe(12);
    expect(hand.cards.every((card) => card.suit === 'clubs')).toBe(true);
  });

  test('[5H, 5D, joker=2S] → Trail of 5s (best possible)', () => {
    // 2R+1B: 2♠ is joker, realCards=[5♥, 5♦]
    const cards = [c(5, 'hearts'), c(5, 'diamonds'), c(2, 'spades')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('trail');
    expect(hand.values[0]).toBe(5);
  });

  test('[4D, 6D, joker=2S] → Pure Sequence 4-5-6 diamonds (not 5 of another suit)', () => {
    // 2R+1B: 2♠ is joker, realCards=[4♦, 6♦]
    const cards = [c(4, 'diamonds'), c(6, 'diamonds'), c(2, 'spades')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.cards.every((card) => card.suit === 'diamonds')).toBe(true);
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([4, 5, 6]);
  });

  test('[AH, 2H, joker=3S] → Pure Sequence A-2-3 hearts (not impure A-2-3)', () => {
    // 2R+1B: 3♠ is joker, realCards=[A♥, 2♥]
    const cards = [c(14, 'hearts'), c(2, 'hearts'), c(3, 'spades')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.values[0]).toBe(11); // A-2-3 sequence rank = 11
    expect(hand.cards.every((card) => card.suit === 'hearts')).toBe(true);
  });

  test('[10H, QH, joker=10C] → Pure Sequence 10-J-Q hearts (same-rank joker case)', () => {
    // 10♥=red, Q♥=red, 10♣=black → 2R+1B → 10♣ is joker; realCards=[10♥, Q♥]
    // J♥ gives pure_sequence; J♠/J♦/J♣ give sequence — must pick J♥
    const cards = [c(10, 'hearts'), c(12, 'hearts'), c(10, 'clubs')];
    const hand = getBestHand(cards, 3, cards) as ClassifiedHand;
    expect(hand.type).toBe('pure_sequence');
    expect(hand.cards.every((card) => card.suit === 'hearts')).toBe(true);
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([10, 11, 12]);
  });
});

// ── Round 4 muflis subset selection (BUG 2) ──────────────────────────────────
describe('getBestHand — round 4 muflis subset selection', () => {
  test('[2S,3H,5C,AD] → picks [2S,3H,5C] = 2-3-5 offsuit (special best)', () => {
    const cards = [c(2, 'spades'), c(3, 'hearts'), c(5, 'clubs'), c(14, 'diamonds')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    // 2-3-5 offsuit is classified as high_card with those ranks
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 5]);
    // Must be offsuit (not all same suit) — classifyHand returns high_card only for non-flush
    const suits = new Set(hand.cards.map((card) => card.suit));
    expect(suits.size).toBeGreaterThan(1);
  });

  test('[2S,3S,5S,7H] → does NOT pick 2-3-5 same suit (color); picks lowest high card', () => {
    // [2♠,3♠,5♠] = color (bad in muflis); should pick [2♠,3♠,7♥] = high_card{7,3,2}
    const cards = [c(2, 'spades'), c(3, 'spades'), c(5, 'spades'), c(7, 'hearts')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 7]);
  });

  test('[AS,AH,2D,3C] → picks pair of aces with kicker 2 (NOT kicker 3, NOT A-2-3 sequence)', () => {
    const cards = [c(14, 'spades'), c(14, 'hearts'), c(2, 'diamonds'), c(3, 'clubs')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('pair');
    expect(hand.values[0]).toBe(14); // pair of aces
    expect(hand.values[1]).toBe(2);  // kicker 2, NOT 3
  });

  test('[AS,2H,3D,7C] → does NOT pick A-2-3 sequence; picks [2H,3D,7C] high card', () => {
    // A-2-3 is a Sequence (bad in muflis). [2H,3D,7C] = high_card with lowest values.
    const cards = [c(14, 'spades'), c(2, 'hearts'), c(3, 'diamonds'), c(7, 'clubs')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 7]);
  });

  test('[AS,2H,3D,5C] → picks [2H,3D,5C] = 2-3-5 offsuit, NOT A-2-3 sequence', () => {
    const cards = [c(14, 'spades'), c(2, 'hearts'), c(3, 'diamonds'), c(5, 'clubs')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 5]);
    const suits = new Set(hand.cards.map((card) => card.suit));
    expect(suits.size).toBeGreaterThan(1);
  });

  test('[4C,4H,4S,7D] → does NOT pick trail; picks pair of 4s (better muflis)', () => {
    const cards = [c(4, 'clubs'), c(4, 'hearts'), c(4, 'spades'), c(7, 'diamonds')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('pair');
    expect(hand.values[0]).toBe(4); // pair of 4s
  });

  test('[KS,QH,AD,2C] → avoids A-K-Q (highest sequence); picks high card subset', () => {
    // A-K-Q is a sequence — bad in muflis. Best is a high-card subset like K-Q-2.
    const cards = [c(13, 'spades'), c(12, 'hearts'), c(14, 'diamonds'), c(2, 'clubs')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    // Should not contain A,K,Q together (that's a sequence)
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).not.toEqual([12, 13, 14]);
  });

  test('[2C,3D,4S,5H] → picks [2C,3D,5H] = 2-3-5 offsuit (avoids sequences 2-3-4 and 3-4-5)', () => {
    const cards = [c(2, 'clubs'), c(3, 'diamonds'), c(4, 'spades'), c(5, 'hearts')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 5]); // 2-3-5 offsuit
    const suits = new Set(hand.cards.map((card) => card.suit));
    expect(suits.size).toBeGreaterThan(1);
  });

  test('[2S,3H,5C,5D] → picks [2S,3H,5C] = 2-3-5 offsuit even though pair of 5s exists', () => {
    const cards = [c(2, 'spades'), c(3, 'hearts'), c(5, 'clubs'), c(5, 'diamonds')];
    const hand = getBestHand(cards, 4, cards) as ClassifiedHand;
    expect(hand.type).toBe('high_card');
    const ranks = hand.cards.map((card) => card.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([2, 3, 5]);
    const suits = new Set(hand.cards.map((card) => card.suit));
    expect(suits.size).toBeGreaterThan(1);
  });
});
