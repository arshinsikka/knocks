import { Card, ClassifiedHand, GamePlayer } from './types';
import { compareHands } from './TeenPatti';
import { getBestHand, compareCards } from './Rounds';

export interface ShowdownResult {
  winner: GamePlayer;
  losers: GamePlayer[];
  winningHand: ClassifiedHand;
  allHands: Array<{ player: GamePlayer; hand: ClassifiedHand }>;
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

  // Find the winner
  const best = evaluated.reduce((champion, curr) => {
    if (round === 1) {
      // Single card comparison
      const result = compareCards(curr.hand.cards[0], champion.hand.cards[0]);
      return result === 1 ? curr : champion;
    }
    const result = compareHands(curr.hand, champion.hand, mode);
    return result === 1 ? curr : champion;
  });

  return {
    winner: best.player,
    losers: evaluated.filter((e) => e.player !== best.player).map((e) => e.player),
    winningHand: best.hand,
    allHands: evaluated,
  };
}
