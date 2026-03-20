import { Card, ClassifiedHand, GamePlayer } from './types';
import { compareHands } from './TeenPatti';
import { getBestHand, compareCards } from './Rounds';

export interface ShowdownResult {
  winner: GamePlayer | null;  // null when tie
  losers: GamePlayer[];       // empty when tie
  winningHand: ClassifiedHand | null;
  allHands: Array<{ player: GamePlayer; hand: ClassifiedHand }>;
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

  // Find the best hand
  const best = evaluated.reduce((champion, curr) => {
    if (round === 1) {
      return compareCards(curr.hand.cards[0], champion.hand.cards[0]) === 1 ? curr : champion;
    }
    return compareHands(curr.hand, champion.hand, mode, round) === 1 ? curr : champion;
  });

  // Check for ties: all players whose hand equals the best
  const tiedForBest = evaluated.filter((e) => {
    if (round === 1) return compareCards(e.hand.cards[0], best.hand.cards[0]) === 0;
    return compareHands(e.hand, best.hand, mode, round) === 0;
  });

  const tie = tiedForBest.length > 1;

  return {
    winner: tie ? null : best.player,
    losers: tie ? [] : evaluated.filter((e) => e.player !== best.player).map((e) => e.player),
    winningHand: best.hand,
    allHands: evaluated,
    tie,
  };
}
