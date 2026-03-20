import { GamePlayer } from './types';

/** Each orbit: every player contributes 2, added once. */
export function addOrbitContribution(potTotal: number, numPlayers: number): number {
  return potTotal + numPlayers * 2;
}

/** R1/R2 → full pot; R3/R4/R5 → capped at 12. */
export function calculatePayout(round: number, potTotal: number): number {
  if (round <= 2) return potTotal;
  return Math.min(potTotal, 12);
}

/** Debit each loser, credit winner. Mutates in place. */
export function settleShowdown(
  winner: GamePlayer,
  losers: GamePlayer[],
  payout: number,
): void {
  const share = payout / losers.length;
  for (const loser of losers) {
    loser.balance -= share;
  }
  winner.balance += payout;
}
