import { Card, BestHand, ClassifiedHand, SUIT_ORDER } from './types';
import { buildDeck } from './Deck';
import { classifyHand, compareHands } from './TeenPatti';
import { bestPokerSubset } from './Poker';

function combinations3(arr: Card[]): Card[][] {
  const result: Card[][] = [];
  for (let i = 0; i < arr.length - 2; i++) {
    for (let j = i + 1; j < arr.length - 1; j++) {
      for (let k = j + 1; k < arr.length; k++) {
        result.push([arr[i], arr[j], arr[k]]);
      }
    }
  }
  return result;
}

function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`;
}

function isRed(c: Card): boolean {
  return c.suit === 'hearts' || c.suit === 'diamonds';
}

function isBlack(c: Card): boolean {
  return c.suit === 'spades' || c.suit === 'clubs';
}

// Compare two single cards: rank first, suit tiebreak
function compareCards(a: Card, b: Card): 1 | -1 | 0 {
  if (a.rank !== b.rank) return a.rank > b.rank ? 1 : -1;
  const sa = SUIT_ORDER[a.suit];
  const sb = SUIT_ORDER[b.suit];
  if (sa !== sb) return sa > sb ? 1 : -1;
  return 0;
}

function bestOf(
  hands: ClassifiedHand[],
  mode: 'normal' | 'muflis',
  round: number,
): ClassifiedHand {
  return hands.reduce((best, curr) =>
    compareHands(curr, best, mode, round) === 1 ? curr : best,
  );
}

/**
 * Returns the joker card for a Round 3 hand based on color composition:
 * - 2 red + 1 black → the single black card is the joker
 * - 2 black + 1 red → the single red card is the joker
 * - 3 same color → no joker (returns null)
 */
export function findJoker(cards: [Card, Card, Card]): Card | null {
  const reds = cards.filter(isRed);
  const blacks = cards.filter(isBlack);
  if (reds.length === 2 && blacks.length === 1) return blacks[0];
  if (reds.length === 1 && blacks.length === 2) return reds[0];
  return null;
}

/**
 * Returns a BestHand for the given round:
 *   rounds 1-5 → ClassifiedHand (Teen Patti)
 *   round 6    → PokerHand (best 5 from 6, evaluated with poker rankings)
 */
export function getBestHand(
  playerCards: Card[],
  round: number,
  allDealtCards: Card[],
): BestHand {
  // ── Round 1: single card ──────────────────────────────────────────────────
  if (round === 1) {
    const c = playerCards[0];
    return {
      type: 'high_card',
      values: [c.rank, SUIT_ORDER[c.suit]],
      cards: [c],
    };
  }

  // ── Round 2: 2 real + best imagined third ────────────────────────────────
  if (round === 2) {
    const dealtKeys = new Set(allDealtCards.map(cardKey));
    const deck = buildDeck();
    const candidates = deck.filter((c) => !dealtKeys.has(cardKey(c)));

    const hands: ClassifiedHand[] = candidates.map((c) =>
      classifyHand([playerCards[0], playerCards[1], c]),
    );
    return bestOf(hands, 'normal', 2);
  }

  // ── Round 3: 3 cards, joker determined by color composition ────────────
  if (round === 3) {
    const col = (c: Card) => `${c.rank}${c.suit[0].toUpperCase()}`;
    const colorStr = (c: Card) => (isRed(c) ? 'R' : 'B');

    const jokerCard = findJoker(playerCards as [Card, Card, Card]);
    const realCards = jokerCard
      ? playerCards.filter((c) => c !== jokerCard)
      : playerCards;

    console.log(
      `[R3] ${playerCards.map(col).join(' ')}` +
      ` (${playerCards.map(colorStr).join('')})` +
      ` → joker: ${jokerCard ? col(jokerCard) : 'none'}`,
    );

    if (!jokerCard) {
      const hand = classifyHand(playerCards as [Card, Card, Card]);
      console.log(`[R3] no joker → ${hand.type}`);
      return hand;
    }

    // Try ALL 52 possible cards as substitutions for the joker
    const deck = buildDeck();
    let bestHand: ClassifiedHand | null = null;
    let bestSub: Card | null = null;
    for (const sub of deck) {
      const h = classifyHand([realCards[0], realCards[1], sub]);
      if (!bestHand || compareHands(h, bestHand, 'normal', 3) === 1) {
        bestHand = h;
        bestSub = sub;
      }
    }
    console.log(
      `[R3] joker ${col(jokerCard)} → best sub: ${col(bestSub!)} → ${bestHand!.type}`,
    );
    return bestHand!;
  }

  // ── Round 4: 4 cards, best muflis 3-card subset ──────────────────────────
  if (round === 4) {
    const subsets = combinations3(playerCards);
    const hands = subsets.map((s) => classifyHand(s));
    return bestOf(hands, 'muflis', 4);
  }

  // ── Round 5: 5 cards, best normal 3-card subset ──────────────────────────
  if (round === 5) {
    const subsets = combinations3(playerCards);
    const hands = subsets.map((s) => classifyHand(s));
    return bestOf(hands, 'normal', 5);
  }

  // ── Round 6: 6 cards, best POKER 5-card subset ───────────────────────────
  if (round === 6) {
    return bestPokerSubset(playerCards);
  }

  throw new Error(`Unknown round: ${round}`);
}

export { compareCards };
