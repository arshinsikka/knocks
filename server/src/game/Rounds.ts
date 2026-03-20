import { Card, ClassifiedHand, SUIT_ORDER } from './types';
import { buildDeck } from './Deck';
import { classifyHand, compareHands } from './TeenPatti';

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
): ClassifiedHand {
  return hands.reduce((best, curr) =>
    compareHands(curr, best, mode) === 1 ? curr : best,
  );
}

/**
 * Returns ClassifiedHand (or a round-1 pseudo-hand with a single card).
 */
export function getBestHand(
  playerCards: Card[],
  round: number,
  allDealtCards: Card[],
): ClassifiedHand {
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
    return bestOf(hands, 'normal');
  }

  // ── Round 3: 3 cards, possible wild ─────────────────────────────────────
  if (round === 3) {
    const [c0, c1, c2] = playerCards;
    const col = (c: Card) => `${c.rank}${c.suit[0].toUpperCase()}`;
    const colorStr = (c: Card) => (isRed(c) ? 'R' : 'B');

    const hasWild =
      (isRed(c0) && isRed(c1) && isBlack(c2)) ||
      (isBlack(c0) && isBlack(c1) && isRed(c2));

    console.log(
      `[R3] ${col(c0)} ${col(c1)} ${col(c2)}` +
      ` (${colorStr(c0)}${colorStr(c1)}${colorStr(c2)})` +
      ` → joker: ${hasWild}`,
    );

    if (!hasWild) {
      const hand = classifyHand(playerCards as [Card, Card, Card]);
      console.log(`[R3] no joker → ${hand.type}`);
      return hand;
    }

    // c2 is wild — try ALL 52 possible substitutions (wild can be any card)
    const deck = buildDeck();
    let bestHand: ClassifiedHand | null = null;
    let bestSub: Card | null = null;
    for (const sub of deck) {
      const h = classifyHand([c0, c1, sub]);
      if (!bestHand || compareHands(h, bestHand, 'normal') === 1) {
        bestHand = h;
        bestSub = sub;
      }
    }
    console.log(
      `[R3] joker → best wild: ${col(bestSub!)} → ${bestHand!.type}`,
    );
    return bestHand!;
  }

  // ── Round 4: 4 cards, best muflis 3-card subset ──────────────────────────
  if (round === 4) {
    const subsets = combinations3(playerCards);
    const hands = subsets.map((s) => classifyHand(s));
    return bestOf(hands, 'muflis');
  }

  // ── Round 5: 5 cards, best normal 3-card subset ──────────────────────────
  if (round === 5) {
    const subsets = combinations3(playerCards);
    const hands = subsets.map((s) => classifyHand(s));
    return bestOf(hands, 'normal');
  }

  throw new Error(`Unknown round: ${round}`);
}

export { compareCards };
