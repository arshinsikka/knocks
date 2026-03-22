import { classifyPokerHand, comparePokerHands, bestPokerSubset } from '../Poker';
import { Card } from '../types';

function c(rank: number, suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'): Card {
  return { rank, suit };
}

// ── classifyPokerHand ─────────────────────────────────────────────────────────

describe('classifyPokerHand', () => {
  test('royal flush: A-K-Q-J-10 same suit', () => {
    const hand = classifyPokerHand([
      c(14,'spades'), c(13,'spades'), c(12,'spades'), c(11,'spades'), c(10,'spades'),
    ]);
    expect(hand.type).toBe('royal_flush');
    expect(hand.values).toEqual([14]);
  });

  test('straight flush: 9-8-7-6-5 same suit', () => {
    const hand = classifyPokerHand([
      c(9,'hearts'), c(8,'hearts'), c(7,'hearts'), c(6,'hearts'), c(5,'hearts'),
    ]);
    expect(hand.type).toBe('straight_flush');
    expect(hand.values[0]).toBe(9);
  });

  test('wheel straight flush: A-2-3-4-5 same suit', () => {
    const hand = classifyPokerHand([
      c(14,'clubs'), c(2,'clubs'), c(3,'clubs'), c(4,'clubs'), c(5,'clubs'),
    ]);
    expect(hand.type).toBe('straight_flush');
    expect(hand.values[0]).toBe(5); // top of wheel
  });

  test('four of a kind', () => {
    const hand = classifyPokerHand([
      c(7,'spades'), c(7,'hearts'), c(7,'diamonds'), c(7,'clubs'), c(3,'spades'),
    ]);
    expect(hand.type).toBe('four_of_a_kind');
    expect(hand.values[0]).toBe(7);
    expect(hand.values[1]).toBe(3); // kicker
  });

  test('full house', () => {
    const hand = classifyPokerHand([
      c(10,'spades'), c(10,'hearts'), c(10,'clubs'), c(2,'diamonds'), c(2,'spades'),
    ]);
    expect(hand.type).toBe('full_house');
    expect(hand.values).toEqual([10, 2]);
  });

  test('flush (not straight)', () => {
    const hand = classifyPokerHand([
      c(2,'diamonds'), c(5,'diamonds'), c(7,'diamonds'), c(9,'diamonds'), c(11,'diamonds'),
    ]);
    expect(hand.type).toBe('flush');
  });

  test('straight (not flush): K-A-2-3-4 is NOT valid', () => {
    const hand = classifyPokerHand([
      c(14,'spades'), c(2,'hearts'), c(3,'clubs'), c(4,'diamonds'), c(13,'spades'),
    ]);
    // K-A-2-3-4 wraps around — should NOT be a straight
    expect(hand.type).not.toBe('straight');
  });

  test('normal straight: 7-8-9-10-J mixed suits', () => {
    const hand = classifyPokerHand([
      c(7,'spades'), c(8,'hearts'), c(9,'diamonds'), c(10,'clubs'), c(11,'spades'),
    ]);
    expect(hand.type).toBe('straight');
    expect(hand.values[0]).toBe(11); // top card
  });

  test('three of a kind', () => {
    const hand = classifyPokerHand([
      c(5,'spades'), c(5,'hearts'), c(5,'diamonds'), c(9,'clubs'), c(2,'spades'),
    ]);
    expect(hand.type).toBe('three_of_a_kind');
    expect(hand.values[0]).toBe(5);
  });

  test('two pair', () => {
    const hand = classifyPokerHand([
      c(8,'spades'), c(8,'hearts'), c(4,'diamonds'), c(4,'clubs'), c(11,'spades'),
    ]);
    expect(hand.type).toBe('two_pair');
    expect(hand.values[0]).toBe(8); // high pair
    expect(hand.values[1]).toBe(4); // low pair
    expect(hand.values[2]).toBe(11); // kicker
  });

  test('one pair', () => {
    const hand = classifyPokerHand([
      c(6,'spades'), c(6,'hearts'), c(3,'diamonds'), c(9,'clubs'), c(14,'spades'),
    ]);
    expect(hand.type).toBe('one_pair');
    expect(hand.values[0]).toBe(6);
  });

  test('high card', () => {
    const hand = classifyPokerHand([
      c(2,'spades'), c(5,'hearts'), c(7,'diamonds'), c(9,'clubs'), c(11,'spades'),
    ]);
    expect(hand.type).toBe('high_card');
  });
});

// ── comparePokerHands ─────────────────────────────────────────────────────────

describe('comparePokerHands', () => {
  test('straight flush beats flush', () => {
    const sf = classifyPokerHand([c(9,'hearts'), c(8,'hearts'), c(7,'hearts'), c(6,'hearts'), c(5,'hearts')]);
    const fl = classifyPokerHand([c(2,'diamonds'), c(5,'diamonds'), c(7,'diamonds'), c(9,'diamonds'), c(11,'diamonds')]);
    expect(comparePokerHands(sf, fl)).toBe(1);
    expect(comparePokerHands(fl, sf)).toBe(-1);
  });

  test('tiebreak within same type: higher four-of-a-kind wins', () => {
    const high = classifyPokerHand([c(9,'spades'), c(9,'hearts'), c(9,'diamonds'), c(9,'clubs'), c(3,'spades')]);
    const low  = classifyPokerHand([c(7,'spades'), c(7,'hearts'), c(7,'diamonds'), c(7,'clubs'), c(3,'spades')]);
    expect(comparePokerHands(high, low)).toBe(1);
  });

  test('equal hands return 0', () => {
    const a = classifyPokerHand([c(14,'spades'), c(13,'spades'), c(12,'spades'), c(11,'spades'), c(10,'spades')]);
    const b = classifyPokerHand([c(14,'hearts'), c(13,'hearts'), c(12,'hearts'), c(11,'hearts'), c(10,'hearts')]);
    expect(comparePokerHands(a, b)).toBe(0);
  });
});

// ── bestPokerSubset ───────────────────────────────────────────────────────────

describe('bestPokerSubset', () => {
  test('picks the 5-card straight flush over other combos', () => {
    // 5 hearts make a straight flush, 6th card is a spade
    const sixCards: Card[] = [
      c(9,'hearts'), c(8,'hearts'), c(7,'hearts'), c(6,'hearts'), c(5,'hearts'),
      c(2,'spades'),
    ];
    const best = bestPokerSubset(sixCards);
    expect(best.type).toBe('straight_flush');
  });

  test('throws when not given exactly 6 cards', () => {
    expect(() => bestPokerSubset([c(1,'spades')] as Card[])).toThrow();
  });
});
