import { GamePlayer } from './types';

/** Each orbit: every player contributes 2, added once. */
export function addOrbitContribution(potTotal: number, numPlayers: number): number {
  return potTotal + numPlayers * 2;
}

/** Orbit 1/2 → full pot; Orbit 3+ → capped at 12. */
export function calculatePayout(orbit: number, potTotal: number): number {
  if (orbit <= 2) return potTotal;
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
