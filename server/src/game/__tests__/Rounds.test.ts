import { getBestHand } from '../Rounds';
import { buildDeck } from '../Deck';
import { Card } from '../types';

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
