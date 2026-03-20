import { resolveShowdown } from '../Showdown';
import { GamePlayer, Card } from '../types';

function makePlayer(id: string, cards: Card[]): GamePlayer {
  return {
    id, name: id, socketId: id,
    cards, bestHand: null, balance: 0, knocks: 0, choice: 'in',
  };
}

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

describe('resolveShowdown', () => {
  test('2 players — higher trail beats pair', () => {
    const p1 = makePlayer('p1', [c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds')]);  // trail
    const p2 = makePlayer('p2', [c(14, 'spades'), c(14, 'hearts'), c(2, 'clubs')]);  // pair
    const result = resolveShowdown([p1, p2], 3, [...p1.cards, ...p2.cards]);
    expect(result.winner.id).toBe('p1');
    expect(result.losers.map(l => l.id)).toEqual(['p2']);
  });

  test('3 players — one winner, two losers', () => {
    // p1 has trail, p2 has pure_sequence, p3 has high_card
    const p1 = makePlayer('p1', [c(8, 'spades'), c(8, 'hearts'), c(8, 'diamonds')]);
    const p2 = makePlayer('p2', [c(6, 'clubs'), c(5, 'clubs'), c(4, 'clubs')]);
    const p3 = makePlayer('p3', [c(14, 'spades'), c(9, 'hearts'), c(3, 'diamonds')]);
    const all = [...p1.cards, ...p2.cards, ...p3.cards];
    const result = resolveShowdown([p1, p2, p3], 3, all);
    expect(result.winner.id).toBe('p1');
    expect(result.losers.length).toBe(2);
    expect(result.allHands.length).toBe(3);
  });

  test('round 4 uses muflis — worst normal hand wins', () => {
    // p1: 4 cards including A-K-Q-J — best muflis subset is worst normal (high_card)
    // p2: 4 cards including 7-7-7-2 — trail available, worst muflis
    const p1 = makePlayer('p1', [c(14, 'spades'), c(13, 'hearts'), c(12, 'diamonds'), c(11, 'clubs')]);
    const p2 = makePlayer('p2', [c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds'), c(2, 'clubs')]);
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 4, all);
    // p1's best muflis hand from {A,K,Q,J}: high_card (no two same suit, no sequence... A-K-Q is pure_seq)
    // Actually A-K-Q is pure sequence if same suit, sequence if not.
    // p1 cards: ASpades, KHearts, QDiamonds, JClubs — all different suits, no flush
    // A-K-Q offsuit = sequence; A-K-J = high_card (no sequence); K-Q-J = sequence
    // In muflis, high_card beats sequence, so p1 picks {A,K,J} or {A,Q,J} = high_card
    // p2 has trail 7-7-7 (worst muflis) and pairs/high_cards
    // p1 should win muflis (worse normal hand = better muflis)
    expect(result.winner.id).toBe('p1');
  });

  test('round 5 uses normal ranking', () => {
    // p1: 5 cards including a trail subset
    const p1 = makePlayer('p1', [c(9, 'spades'), c(9, 'hearts'), c(9, 'diamonds'), c(2, 'clubs'), c(3, 'hearts')]);
    const p2 = makePlayer('p2', [c(14, 'spades'), c(13, 'hearts'), c(12, 'diamonds'), c(11, 'clubs'), c(10, 'spades')]);
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 5, all);
    // p1 has trail 9-9-9; p2 has pure_sequence A-K-Q? No: all diff suits → sequence
    // Trail beats sequence → p1 wins
    expect(result.winner.id).toBe('p1');
  });

  test('6 players — one winner, five losers', () => {
    const players = [
      makePlayer('p1', [c(5, 'spades'), c(5, 'hearts'), c(5, 'diamonds')]),  // trail - wins
      makePlayer('p2', [c(14, 'spades'), c(13, 'spades'), c(12, 'spades')]), // pure_seq
      makePlayer('p3', [c(10, 'spades'), c(9, 'hearts'), c(8, 'diamonds')]), // seq
      makePlayer('p4', [c(2, 'spades'), c(7, 'spades'), c(11, 'spades')]),   // color
      makePlayer('p5', [c(4, 'spades'), c(4, 'hearts'), c(14, 'diamonds')]), // pair
      makePlayer('p6', [c(14, 'spades'), c(9, 'hearts'), c(3, 'diamonds')]), // high_card
    ];
    const all = players.flatMap(p => p.cards);
    const result = resolveShowdown(players, 3, all);
    expect(result.winner.id).toBe('p1');
    expect(result.losers.length).toBe(5);
  });

  test('round 1 — single card comparison', () => {
    const p1 = makePlayer('p1', [c(14, 'spades')]);  // Ace of spades — highest possible
    const p2 = makePlayer('p2', [c(14, 'hearts')]);  // Ace of hearts
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 1, all);
    // Spades > hearts tiebreak
    expect(result.winner.id).toBe('p1');
  });
});
