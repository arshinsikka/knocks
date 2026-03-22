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

/** Common interface satisfied by ClassifiedHand (rounds 1-5) and PokerHand (round 6) */
export interface BestHand {
  type: string;
  values: number[];
  cards: Card[];
}

export interface ClassifiedHand extends BestHand {
  type: HandType;
  /** Primary sort keys (descending for normal, ascending for muflis) */
  values: number[];
  cards: Card[];
}

// ── Poker (Round 6) ───────────────────────────────────────────────────────────

export type PokerHandType =
  | 'royal_flush'
  | 'straight_flush'
  | 'four_of_a_kind'
  | 'full_house'
  | 'flush'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'one_pair'
  | 'high_card';

export const POKER_HAND_RANK: Record<PokerHandType, number> = {
  royal_flush:     10,
  straight_flush:   9,
  four_of_a_kind:   8,
  full_house:       7,
  flush:            6,
  straight:         5,
  three_of_a_kind:  4,
  two_pair:         3,
  one_pair:         2,
  high_card:        1,
};

export interface PokerHand extends BestHand {
  type: PokerHandType;
  /** Comparison keys: higher values = better hand */
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
  bestHand: BestHand | null;
  balance: number;
  knocks: number;
  choice: PlayerChoice;
  // Breakdown tracking for game-over screen
  totalOrbitFees: number;     // negative; -2 per orbit
  showdownWinnings: number;   // positive; peer-to-peer
  showdownLosses: number;     // negative; peer-to-peer
  potCollected: number;       // positive; only winner at game end
}
