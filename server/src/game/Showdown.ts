import { Card, BestHand, ClassifiedHand, GamePlayer, PokerHand } from './types';
import { compareHands } from './TeenPatti';
import { getBestHand, compareCards } from './Rounds';
import { comparePokerHands } from './Poker';

export interface ShowdownResult {
  winner: GamePlayer | null;       // null when tie
  payers: GamePlayer[];            // worst-hand player(s) who pay the winner
  safePlayers: GamePlayer[];       // middle players — pay nothing
  winningHand: BestHand | null;
  allHands: Array<{ player: GamePlayer; hand: BestHand }>;
  tie: boolean;
}

export function resolveShowdown(
  participants: GamePlayer[],
  round: number,
  allDealtCards: Card[],
): ShowdownResult {
  const mode = round === 4 ? 'muflis' : 'normal';

  const evaluated = participants.map((p) => ({
    player: p,
    hand: getBestHand(p.cards, round, allDealtCards),
  }));

  if (evaluated.length === 0) {
    return { winner: null, payers: [], safePlayers: [], winningHand: null, allHands: [], tie: false };
  }

  // Unified comparator: returns 1 if a is better than b, -1 if worse, 0 if equal
  const cmp = (
    a: { player: GamePlayer; hand: BestHand },
    b: { player: GamePlayer; hand: BestHand },
  ): 1 | -1 | 0 => {
    if (round === 1) return compareCards(a.hand.cards[0], b.hand.cards[0]);
    if (round === 6) return comparePokerHands(a.hand as PokerHand, b.hand as PokerHand);
    return compareHands(a.hand as ClassifiedHand, b.hand as ClassifiedHand, mode, round);
  };

  // Find the best hand
  const best = evaluated.reduce((champion, curr) =>
    cmp(curr, champion) === 1 ? curr : champion,
  );

  // Check for ties at the top
  const tiedForBest = evaluated.filter((e) => cmp(e, best) === 0);
  if (tiedForBest.length > 1) {
    return {
      winner: null,
      payers: [],
      safePlayers: [],
      winningHand: best.hand,
      allHands: evaluated,
      tie: true,
    };
  }

  // Find the worst hand (player who pays)
  const worst = evaluated.reduce((weakest, curr) =>
    cmp(curr, weakest) === -1 ? curr : weakest,
  );

  // All players tied for worst
  const tiedForWorst = evaluated.filter((e) => cmp(e, worst) === 0);
  const payerSet = new Set(tiedForWorst.map((e) => e.player));

  // Safe players: neither winner nor payers
  const safePlayers = evaluated
    .filter((e) => e.player !== best.player && !payerSet.has(e.player))
    .map((e) => e.player);

  return {
    winner: best.player,
    payers: tiedForWorst.map((e) => e.player),
    safePlayers,
    winningHand: best.hand,
    allHands: evaluated,
    tie: false,
  };
}
