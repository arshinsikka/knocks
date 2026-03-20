import { Card, Suit } from './types';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * Deal `cardsPerPlayer` cards to `numPlayers` players.
 * Returns [hands[], allDealtCards[]].
 */
export function deal(
  cardsPerPlayer: number,
  numPlayers: number,
): [Card[][], Card[]] {
  const deck = shuffle(buildDeck());
  const hands: Card[][] = Array.from({ length: numPlayers }, () => []);
  const allDealt: Card[] = [];

  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < numPlayers; p++) {
      const card = deck.pop()!;
      hands[p].push(card);
      allDealt.push(card);
    }
  }

  return [hands, allDealt];
}
