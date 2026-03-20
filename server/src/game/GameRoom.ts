import { Card, GamePhase, GamePlayer, ClassifiedHand } from './types';
import { buildDeck, shuffle } from './Deck';
import { getBestHand } from './Rounds';
import { resolveShowdown, ShowdownResult } from './Showdown';
import { addOrbitContribution, calculatePayout, settleShowdown } from './Pot';

export interface RoundSummary {
  round: number;
  orbit: number;
  participants: Array<{ playerId: string; hand: ClassifiedHand }>;
  winner: string | null;     // playerId, null = no participants
  payout: number;
  knockAwarded: boolean;
  newKnocks: Record<string, number>;
}

export interface GameRoomState {
  roomCode: string;
  knockTarget: 5 | 6;
  phase: GamePhase;
  orbit: number;
  round: number;                 // 1-5
  orbitStarterIndex: number;
  currentTurnIndex: number;
  players: GamePlayer[];
  potTotal: number;
  orbitDeck: Card[];             // shuffled once per orbit, dealt 1 card/round
  allDealtCards: Card[];         // accumulates across rounds within an orbit
  lastSummary: RoundSummary | null;
  gameOverWinner: string | null; // playerId
}

export class GameRoom {
  private state: GameRoomState;

  constructor(
    roomCode: string,
    playerInfos: Array<{ id: string; name: string; socketId: string }>,
    knockTarget: 5 | 6,
  ) {
    const players: GamePlayer[] = playerInfos.map((p) => ({
      ...p,
      cards: [],
      bestHand: null,
      balance: 0,
      knocks: 0,
      choice: null,
      totalOrbitFees: 0,
      showdownWinnings: 0,
      showdownLosses: 0,
      potCollected: 0,
    }));

    const starterIndex = Math.floor(Math.random() * players.length);

    this.state = {
      roomCode,
      knockTarget,
      phase: 'LOBBY',
      orbit: 1,
      round: 1,
      orbitStarterIndex: starterIndex,
      currentTurnIndex: starterIndex,
      players,
      potTotal: 0,
      orbitDeck: [],
      allDealtCards: [],
      lastSummary: null,
      gameOverWinner: null,
    };
  }

  getState(): Readonly<GameRoomState> {
    return this.state;
  }

  /**
   * Returns the full accumulated hand for each player, keyed by playerId.
   *
   * Orbit round 1: shuffle a fresh deck, clear all hands, ante up.
   * Rounds 2-5:    deal exactly 1 new card from the SAME orbit deck;
   *               players accumulate cards (never replaced mid-orbit).
   */
  startRound(): Map<string, Card[]> {
    const s = this.state;
    s.phase = 'DEALING';

    if (s.round === 1) {
      // New orbit: ante, fresh deck, clear hands
      s.potTotal = addOrbitContribution(s.potTotal, s.players.length);
      // Deduct each player's $2 contribution from their balance
      for (const p of s.players) {
        p.balance -= 2;
        p.totalOrbitFees -= 2;
      }
      s.orbitDeck = shuffle(buildDeck());
      s.allDealtCards = [];
      for (const p of s.players) {
        p.cards = [];
      }
    }

    // Deal exactly 1 new card per player from the persisted orbit deck
    for (const p of s.players) {
      const card = s.orbitDeck.pop()!;
      p.cards.push(card);        // accumulate — never replace
      s.allDealtCards.push(card);
    }

    // Evaluate best hand using the full accumulated hand
    for (const p of s.players) {
      p.bestHand = getBestHand(p.cards, s.round, s.allDealtCards);
      p.choice = null;
    }

    // Reset turn to orbit starter
    s.currentTurnIndex = s.orbitStarterIndex;
    s.phase = 'IN_OUT';

    // Send each player their full accumulated hand
    const dealt = new Map<string, Card[]>();
    for (const p of s.players) {
      dealt.set(p.id, [...p.cards]);
    }
    return dealt;
  }

  /** Returns true if it was that player's turn and choice was accepted */
  submitInOut(playerId: string, choice: 'in' | 'out'): boolean {
    const s = this.state;
    if (s.phase !== 'IN_OUT') return false;

    const current = s.players[s.currentTurnIndex];
    if (current.id !== playerId) return false;

    current.choice = choice;
    s.currentTurnIndex = (s.currentTurnIndex + 1) % s.players.length;

    // Check if all players have chosen
    const allChosen = s.players.every((p) => p.choice !== null);
    if (allChosen) {
      const anyIn  = s.players.some((p) => p.choice === 'in');
      const anyOut = s.players.some((p) => p.choice === 'out');

      if (!anyIn) {
        s.phase = 'ROUND_END';
      } else if (!anyOut) {
        // Everyone said IN — skip challenge window, go straight to showdown
        s.phase = 'SHOWDOWN';
      } else {
        s.phase = 'CHALLENGE_JOIN';
        s.currentTurnIndex = s.orbitStarterIndex;
      }
    }
    return true;
  }

  /** Returns true if accepted */
  submitJoinPass(playerId: string, choice: 'join' | 'pass'): boolean {
    const s = this.state;
    if (s.phase !== 'CHALLENGE_JOIN') return false;

    // Find the next OUT player whose turn it is
    const outPlayers = this.getOutPlayersInOrder();
    const currentOut = outPlayers.find((p) => p.choice === 'out');
    if (!currentOut || currentOut.id !== playerId) return false;

    currentOut.choice = choice;

    // Check if all OUT players have responded
    const allOutAnswered = s.players
      .filter((p) => p.choice === 'out' || p.choice === 'join' || p.choice === 'pass')
      .every((p) => p.choice !== 'out');

    // Actually: everyone who was 'out' must now be 'join' or 'pass'
    const stillOut = s.players.filter((p) => p.choice === 'out');
    if (stillOut.length === 0) {
      s.phase = 'SHOWDOWN';
    }
    return true;
  }

  private getOutPlayersInOrder(): GamePlayer[] {
    const s = this.state;
    const result: GamePlayer[] = [];
    for (let i = 0; i < s.players.length; i++) {
      const idx = (s.orbitStarterIndex + i) % s.players.length;
      const p = s.players[idx];
      if (p.choice === 'out') result.push(p);
    }
    return result;
  }

  /** Run the showdown. Returns summary. Caller should then call advanceRound(). */
  resolveRound(): RoundSummary {
    const s = this.state;
    const participants = s.players.filter(
      (p) => p.choice === 'in' || p.choice === 'join',
    );

    let winner: GamePlayer | null = null;
    let payout = 0;
    let knockAwarded = false;
    const newKnocks: Record<string, number> = {};

    if (participants.length === 0) {
      // No participants — no payout, no knock
      payout = 0;
    } else if (participants.length === 1) {
      // Only one — gets the knock without showdown
      winner = participants[0];
      payout = 0;
      winner.knocks += 1;
      knockAwarded = true;
      newKnocks[winner.id] = winner.knocks;
    } else {
      // Full showdown
      const result: ShowdownResult = resolveShowdown(
        participants,
        s.round,
        s.allDealtCards,
      );
      winner = result.winner;
      payout = calculatePayout(s.round, s.potTotal);
      settleShowdown(winner, result.losers, payout);
      // Track showdown breakdown
      winner.showdownWinnings += payout;
      const loserShare = result.losers.length > 0 ? payout / result.losers.length : 0;
      for (const loser of result.losers) {
        loser.showdownLosses -= loserShare;
      }
      winner.knocks += 1;
      knockAwarded = true;
      newKnocks[winner.id] = winner.knocks;
    }

    const summary: RoundSummary = {
      round: s.round,
      orbit: s.orbit,
      participants: participants.map((p) => ({
        playerId: p.id,
        hand: p.bestHand!,
      })),
      winner: winner?.id ?? null,
      payout,
      knockAwarded,
      newKnocks,
    };

    s.lastSummary = summary;
    s.phase = 'KNOCK_EVAL';

    // Check win condition
    const gameWinner = s.players.find((p) => p.knocks >= s.knockTarget);
    if (gameWinner) {
      gameWinner.balance += s.potTotal;
      gameWinner.potCollected += s.potTotal;
      s.gameOverWinner = gameWinner.id;
      s.phase = 'GAME_OVER';
    }

    return summary;
  }

  /** Advance to next round or next orbit. Returns new phase. */
  advanceRound(): GamePhase {
    const s = this.state;
    if (s.phase === 'GAME_OVER') return 'GAME_OVER';

    s.phase = 'ROUND_END';

    if (s.round < 5) {
      s.round += 1;
    } else {
      s.orbit += 1;
      s.round = 1;
      s.orbitStarterIndex = (s.orbitStarterIndex + 1) % s.players.length;
    }

    return s.phase;
  }

  /** Who acts now in IN_OUT (players[currentTurnIndex]) */
  currentActor(): GamePlayer | null {
    const s = this.state;
    if (s.phase !== 'IN_OUT') return null;
    return s.players[s.currentTurnIndex] ?? null;
  }

  /** First remaining OUT player (choice === 'out') in clockwise order from orbit starter */
  currentChallengeJoinActor(): GamePlayer | null {
    const s = this.state;
    if (s.phase !== 'CHALLENGE_JOIN') return null;
    for (let i = 0; i < s.players.length; i++) {
      const idx = (s.orbitStarterIndex + i) % s.players.length;
      if (s.players[idx].choice === 'out') return s.players[idx];
    }
    return null;
  }
}
