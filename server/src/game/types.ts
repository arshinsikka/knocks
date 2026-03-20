export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export interface Card {
  rank: number; // 2-14 (14 = Ace)
  suit: Suit;
}

export const SUIT_ORDER: Record<Suit, number> = {
  spades: 4,
  hearts: 3,
  diamonds: 2,
  clubs: 1,
};

export type HandType =
  | 'trail'
  | 'pure_sequence'
  | 'sequence'
  | 'color'
  | 'pair'
  | 'high_card';

export const HAND_RANK: Record<HandType, number> = {
  trail: 6,
  pure_sequence: 5,
  sequence: 4,
  color: 3,
  pair: 2,
  high_card: 1,
};

export interface ClassifiedHand {
  type: HandType;
  /** Primary sort keys (descending for normal, ascending for muflis) */
  values: number[];
  cards: Card[];
}

export type GamePhase =
  | 'LOBBY'
  | 'DEALING'
  | 'IN_OUT'
  | 'CHALLENGE_JOIN'
  | 'SHOWDOWN'
  | 'KNOCK_EVAL'
  | 'ROUND_END'
  | 'GAME_OVER';

export type PlayerChoice = null | 'in' | 'out' | 'join' | 'pass';

export interface GamePlayer {
  id: string;
  name: string;
  socketId: string;
  cards: Card[];
  bestHand: ClassifiedHand | null;
  balance: number;
  knocks: number;
  choice: PlayerChoice;
  // Breakdown tracking for game-over screen
  totalOrbitFees: number;     // negative; -2 per orbit
  showdownWinnings: number;   // positive; peer-to-peer
  showdownLosses: number;     // negative; peer-to-peer
  potCollected: number;       // positive; only winner at game end
}
