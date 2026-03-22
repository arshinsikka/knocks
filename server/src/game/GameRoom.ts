import { Card, GamePhase, GamePlayer, BestHand } from './types';
import { buildDeck, shuffle } from './Deck';
import { getBestHand } from './Rounds';
import { resolveShowdown, ShowdownResult } from './Showdown';
import { addOrbitContribution, calculatePayout, settleShowdown } from './Pot';

export interface RoundSummary {
  round: number;
  orbit: number;
  participants: Array<{ playerId: string; hand: BestHand }>;
  winner: string | null;     // playerId, null = no participants or tie
  payout: number;
  knockAwarded: boolean;
  newKnocks: Record<string, number>;
  tie: boolean;
  payerIds: string[];        // worst-hand player(s) who pay the winner
  safeIds: string[];         // middle players who pay nothing
}

export interface GameRoomState {
  roomCode: string;
  knockTarget: 5 | 6;
  roundsPerOrbit: 5 | 6;
  phase: GamePhase;
  orbit: number;
  round: number;                 // 1-N (N = roundsPerOrbit)
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
    roundsPerOrbit: 5 | 6 = 5,
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
      roundsPerOrbit,
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

    // Knock rule: ONLY when exactly 1 IN player and 0 joined players (no showdown).
    // A knock NEVER comes from winning a showdown.
    const inPlayers     = s.players.filter((p) => p.choice === 'in');
    const joinedPlayers = s.players.filter((p) => p.choice === 'join');
    const awardKnock    = inPlayers.length === 1 && joinedPlayers.length === 0;
    console.log(
      `[knock] check: ${inPlayers.length} IN, ${joinedPlayers.length} joined` +
      ` → knock ${awardKnock ? 'AWARDED' : 'NOT awarded'}`,
    );

    let winner: GamePlayer | null = null;
    let payout = 0;
    let knockAwarded = false;
    const newKnocks: Record<string, number> = {};
    const payerIds: string[] = [];
    const safeIds: string[] = [];

    if (participants.length === 0) {
      // No participants — no payout, no knock
      payout = 0;
    } else if (awardKnock) {
      // Single IN player, nobody joined — knock awarded, no showdown, no payout
      winner = inPlayers[0];
      payout = 0;
      winner.knocks += 1;
      knockAwarded = true;
      newKnocks[winner.id] = winner.knocks;
    } else {
      // Full showdown (2+ participants) — determine winner/payout but NO knock
      const result: ShowdownResult = resolveShowdown(
        participants,
        s.round,
        s.allDealtCards,
      );
      if (!result.tie) {
        // Clear winner — only payers (worst hand) pay; safe players unchanged
        winner = result.winner;
        payout = calculatePayout(s.orbit, s.potTotal);
        console.log(`SETTLE: Orbit ${s.orbit}, Pot ${s.potTotal}, Challenge Amount ${payout}`);
        settleShowdown(winner!, result.payers, payout);
        // Track showdown breakdown stats
        winner!.showdownWinnings += payout;
        const payerShare = result.payers.length > 0 ? payout / result.payers.length : 0;
        for (const payer of result.payers) {
          payer.showdownLosses -= payerShare;
        }
        // Record payer/safe IDs for downstream emission
        for (const id of result.payers.map((p) => p.id)) payerIds.push(id);
        for (const id of result.safePlayers.map((p) => p.id)) safeIds.push(id);
      }
      // If tie: winner=null, payout=0, no balance changes
    }

    const tie = winner === null && participants.length >= 2;

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
      tie,
      payerIds,
      safeIds,
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

    if (s.round < s.roundsPerOrbit) {
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
