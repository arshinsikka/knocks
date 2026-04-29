'use client';

import {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import { getSocket } from '@/lib/socket';

export interface Card {
  rank: number;
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
}

export interface PublicPlayer {
  id: string;
  name: string;
  balance: number;
  knocks: number;
}

export interface ShowdownParticipant {
  name: string;
  cards: Card[];
  handType: string;
  handValues: number[];
  role: 'winner' | 'payer' | 'safe';
  // Round 2
  imaginedCard?: Card;
  // Round 3
  jokerTriggered?: boolean;
  jokerOriginalCard?: Card;
  jokerBecame?: Card;
}

export interface ShowdownData {
  round: number;
  participants: ShowdownParticipant[];
  winner: string | null;
  payout: number;
  eachPayerPays: number;
  isPublic: boolean;
  tie: boolean;
}

export interface GameOverData {
  winnerName: string;
  winnerKnocks: number;
  potTotal: number;
  knockTarget: number;
  finalBalances: {
    name: string;
    balance: number;
    knocks: number;
    totalOrbitFees: number;
    showdownWinnings: number;
    showdownLosses: number;
    potCollected: number;
  }[];
}

export interface PlayerLedgerResult {
  name: string;
  knocks: number;
  orbitFees: number;
  showdownWinnings: number;
  showdownLosses: number;
  potCollected: number;
  finalBalance: number;
}

export interface GameResult {
  gameNumber: number;
  winner: string;
  winnerKnocks: number;
  knockTarget: number;
  orbitsPlayed: number;
  playerResults: PlayerLedgerResult[];
  timestamp: string;
}

export type PlayerAction = 'in' | 'out' | 'join' | 'pass';

export interface RevealedCardEntry {
  cards:  Card[];
  rounds: number[];
}

export interface GameState {
  gamePhase:      'LOBBY' | 'PLAYING' | 'GAME_OVER';
  orbit:          number;
  round:          number;
  potTotal:       number;
  payout:         number;
  knockTarget:    number;
  roundsPerOrbit: number;
  players:        PublicPlayer[];
  myCards:        Card[];
  selectedCards:  Card[];
  myId:           string;
  isMyTurn:     boolean;
  turnPhase:    'in_out' | 'challenge_join' | null;
  waitingFor:   { playerName: string; phase: string } | null;
  showdownData: ShowdownData | null;
  gameOver:     GameOverData | null;
  latestKnock:  { playerName: string; newKnockCount: number; knockTarget: number } | null;
  serverPhase:  string;
  playerChoices: Record<string, PlayerAction>;  // playerName → latest action
  log:          string[];
  // Card memory: IDs of opponents whose cards I've seen in a showdown this orbit
  seenPlayerIds:     string[];
  // Cache of fetched revealed cards from server: targetPlayerId → entry
  revealedCardCache: Record<string, RevealedCardEntry>;
  // Client-local flag: did I click OUT & PASS this round? Never sent to opponents.
  myOutAndPass: boolean;
}

interface GameContextValue extends GameState {
  emitIn:               () => void;
  emitOut:              () => void;
  emitOutAndPass:       () => void;
  emitJoin:             () => void;
  emitPass:             () => void;
  dismissShowdown:      () => void;
  dismissKnock:         () => void;
  requestRevealedCards: (targetPlayerId: string) => void;
}

const DEFAULT: GameState = {
  gamePhase:      'LOBBY',
  orbit:          1,
  round:          1,
  potTotal:       0,
  payout:         0,
  knockTarget:    5,
  roundsPerOrbit: 5,
  players:        [],
  myCards:        [],
  selectedCards:  [],
  myId:          '',
  isMyTurn:      false,
  turnPhase:     null,
  waitingFor:    null,
  showdownData:  null,
  gameOver:      null,
  latestKnock:   null,
  serverPhase:   'LOBBY',
  playerChoices: {},
  log:           [],
  seenPlayerIds:     [],
  revealedCardCache: {},
  myOutAndPass:      false,
};

const GameContext = createContext<GameContextValue>({
  ...DEFAULT,
  emitIn:  () => {}, emitOut: () => {}, emitOutAndPass: () => {},
  emitJoin: () => {}, emitPass: () => {},
  dismissShowdown: () => {}, dismissKnock: () => {},
  requestRevealedCards: () => {},
});

export function GameProvider({
  children,
  knockTarget,
  roundsPerOrbit = 5,
  roomCode,
}: { children: ReactNode; knockTarget: number; roundsPerOrbit?: number; roomCode: string }) {
  const [state, setState] = useState<GameState>({ ...DEFAULT, knockTarget, roundsPerOrbit });

  const patch = useCallback((p: Partial<GameState>) =>
    setState((prev) => ({ ...prev, ...p })), []);

  const addLog = useCallback((entry: string) =>
    setState((prev) => ({ ...prev, log: [...prev.log.slice(-49), entry] })), []);

  useEffect(() => {
    const socket = getSocket();

    const setId = () => patch({ myId: socket.id ?? '' });
    if (socket.connected) setId(); else socket.once('connect', setId);

    const onRoundStarted = (d: {
      orbit: number; round: number; knockTarget: number; roundsPerOrbit?: number;
      potTotal: number; payout: number; startingPlayerName: string;
      players: PublicPlayer[];
    }) => {
      patch({
        gamePhase: 'PLAYING', orbit: d.orbit, round: d.round,
        knockTarget: d.knockTarget,
        ...(d.roundsPerOrbit !== undefined ? { roundsPerOrbit: d.roundsPerOrbit } : {}),
        potTotal: d.potTotal, payout: d.payout,
        players: d.players, myCards: [], selectedCards: [], isMyTurn: false, turnPhase: null,
        waitingFor: null, latestKnock: null,
        // showdownData intentionally NOT cleared here — the overlay manages
        // its own 6-second lifecycle and dismisses independently via dismissShowdown.
        serverPhase: 'IN_OUT', playerChoices: {},
        myOutAndPass: false,  // reset OUT & PASS flag each new round
      });
      addLog(`Orbit ${d.orbit} · Round ${d.round} — ${d.startingPlayerName} goes first`);
    };

    const onCardsDealt = (d: { round: number; cards: Card[]; selectedCards?: Card[] }) =>
      patch({ myCards: d.cards, selectedCards: d.selectedCards ?? d.cards });

    const onYourTurn = (d: { phase: 'in_out' | 'challenge_join' }) => {
      console.log('[GameContext] your_turn received:', d);
      patch({ isMyTurn: true, turnPhase: d.phase, waitingFor: null });
    };

    const onWaitingFor = (d: { playerName: string; phase: string }) => {
      console.log('[GameContext] waiting_for received:', d);
      // Always set isMyTurn: false here. The server always emits waiting_for
      // immediately BEFORE your_turn on the same socket, so if it IS our turn
      // your_turn will override this to true in the very next update.
      // Relying on a players.find() lookup to conditionally preserve isMyTurn
      // was fragile: if myId hadn't been set yet (race on first render) the
      // lookup returned undefined and isMyTurn was incorrectly cleared for
      // everyone, causing acted to get stuck and buttons to appear disabled.
      patch({
        waitingFor: d,
        serverPhase: d.phase === 'challenge_join' ? 'CHALLENGE_JOIN' : 'IN_OUT',
        isMyTurn: false,
      });
    };

    const onPlayerActed = (d: { playerName: string; action: PlayerAction }) => {
      setState((prev) => ({
        ...prev,
        playerChoices: { ...prev.playerChoices, [d.playerName]: d.action },
        log: [...prev.log.slice(-49), `${d.playerName}  ${d.action.toUpperCase()}`],
      }));
    };

    const onShowdownReveal = (d: {
      round: number; participants: ShowdownParticipant[];
      winner: string | null; payout: number; eachPayerPays: number; tie?: boolean;
    }) => {
      // Store revealed cards directly from the event — no server round-trip needed.
      // The showdown_reveal already contains exactly the cards each opponent showed.
      setState((prev) => {
        const myName = prev.players.find((p) => p.id === prev.myId)?.name;
        const newSeenIds = new Set(prev.seenPlayerIds);
        const newCache: Record<string, RevealedCardEntry> = { ...prev.revealedCardCache };

        for (const participant of d.participants) {
          if (participant.name === myName) continue;
          const found = prev.players.find((p) => p.name === participant.name);
          if (!found) continue;

          newSeenIds.add(found.id);

          // Merge this showdown's cards into the cache, deduplicating by rank+suit
          if (participant.cards.length > 0) {
            const existing = newCache[found.id] ?? { cards: [], rounds: [] };
            const seenKeys = new Set(existing.cards.map((c) => `${c.rank}-${c.suit}`));
            const merged = [...existing.cards];
            for (const card of participant.cards) {
              const key = `${card.rank}-${card.suit}`;
              if (!seenKeys.has(key)) { merged.push(card); seenKeys.add(key); }
            }
            const rounds = existing.rounds.includes(d.round)
              ? existing.rounds
              : [...existing.rounds, d.round];
            newCache[found.id] = { cards: merged, rounds };
            console.log(
              `[card memory] stored ${merged.length} card(s) for ${participant.name}` +
              ` (round ${d.round}, rounds so far: ${rounds.join(', ')})`,
            );
          }
        }

        return {
          ...prev,
          isMyTurn: false, turnPhase: null,
          showdownData: { ...d, tie: d.tie ?? false, isPublic: false },
          serverPhase: 'SHOWDOWN',
          seenPlayerIds: Array.from(newSeenIds),
          revealedCardCache: newCache,
        };
      });
    };

    const onShowdownPublic = (d: {
      participantNames: string[]; winnerName: string | null;
      payout: number; eachPayerPays: number; tie?: boolean;
    }) => patch({
      isMyTurn: false, turnPhase: null,
      showdownData: {
        round: 0,
        participants: d.participantNames.map((name) => ({
          name, cards: [], handType: '', handValues: [], role: 'safe' as const,
        })),
        winner: d.winnerName, payout: d.payout,
        eachPayerPays: d.eachPayerPays, isPublic: true, tie: d.tie ?? false,
      },
      serverPhase: 'SHOWDOWN',
    });

    const onKnockAwarded = (d: {
      playerName: string; newKnockCount: number; knockTarget: number;
    }) => {
      patch({ latestKnock: d });
      addLog(`Knock — ${d.playerName} (${d.newKnockCount}/${d.knockTarget})`);
    };

    const onBalanceUpdate = (d: { players: PublicPlayer[] }) =>
      patch({ players: d.players });

    const onRoundEnded = (d: { nextRound: number; nextOrbit: number; isNewOrbit: boolean }) => {
      setState((prev) => ({
        ...prev,
        serverPhase: 'ROUND_END',
        // Reset card memory on new orbit (new deck = old cards irrelevant)
        ...(d.isNewOrbit ? { seenPlayerIds: [], revealedCardCache: {} } : {}),
        log: d.isNewOrbit
          ? [...prev.log.slice(-49), `New orbit ${d.nextOrbit}`]
          : prev.log,
      }));
    };

    const onRevealedCardsData = (d: {
      targetPlayerId: string;
      targetPlayerName: string;
      cards: Card[];
      rounds: number[];
    }) => {
      console.log(
        `[card memory] server response for ${d.targetPlayerName}:` +
        ` ${d.cards.length} card(s), rounds [${d.rounds.join(', ')}]`,
      );
      setState((prev) => ({
        ...prev,
        revealedCardCache: {
          ...prev.revealedCardCache,
          [d.targetPlayerId]: { cards: d.cards, rounds: d.rounds },
        },
      }));
    };

    const onGameOver = (d: GameOverData) => {
      patch({ gamePhase: 'GAME_OVER', gameOver: d, isMyTurn: false });
      addLog(`Game over — ${d.winnerName} wins`);
    };

    const onStateSnapshot = (d: {
      orbit: number; round: number; potTotal: number; payout?: number;
      phase: string; knockTarget: number; roundsPerOrbit?: number;
      players: PublicPlayer[]; myCards: Card[]; selectedCards?: Card[];
      waitingFor?: { playerName: string; phase: string } | null;
      myId?: string;
    }) => patch({
      gamePhase: 'PLAYING', orbit: d.orbit, round: d.round,
      potTotal: d.potTotal, payout: d.payout ?? 0,
      knockTarget: d.knockTarget,
      ...(d.roundsPerOrbit !== undefined ? { roundsPerOrbit: d.roundsPerOrbit } : {}),
      players: d.players, myCards: d.myCards,
      selectedCards: d.selectedCards ?? d.myCards,
      serverPhase: d.phase,
      ...(d.waitingFor !== undefined ? { waitingFor: d.waitingFor } : {}),
      // myId from server is the stable game-player ID, which survives socket reconnects.
      // Without this, after a page refresh the new socket.id wouldn't match any player.
      ...(d.myId !== undefined ? { myId: d.myId } : {}),
    });

    socket.on('round_started',      onRoundStarted);
    socket.on('cards_dealt',        onCardsDealt);
    socket.on('your_turn',          onYourTurn);
    socket.on('waiting_for',        onWaitingFor);
    socket.on('player_acted',       onPlayerActed);
    socket.on('showdown_reveal',    onShowdownReveal);
    socket.on('showdown_public',    onShowdownPublic);
    socket.on('knock_awarded',      onKnockAwarded);
    socket.on('balance_update',     onBalanceUpdate);
    socket.on('round_ended',        onRoundEnded);
    socket.on('game_over',          onGameOver);
    socket.on('state_snapshot',     onStateSnapshot);
    socket.on('revealed_cards_data', onRevealedCardsData);

    // Restore full game state (including turn info) now that all listeners are registered.
    // This covers both fresh game-starts and page refreshes mid-game.
    socket.emit('request_state', { roomCode });

    return () => {
      socket.off('round_started',      onRoundStarted);
      socket.off('cards_dealt',        onCardsDealt);
      socket.off('your_turn',          onYourTurn);
      socket.off('waiting_for',        onWaitingFor);
      socket.off('player_acted',       onPlayerActed);
      socket.off('showdown_reveal',    onShowdownReveal);
      socket.off('showdown_public',    onShowdownPublic);
      socket.off('knock_awarded',      onKnockAwarded);
      socket.off('balance_update',     onBalanceUpdate);
      socket.off('round_ended',        onRoundEnded);
      socket.off('game_over',          onGameOver);
      socket.off('state_snapshot',     onStateSnapshot);
      socket.off('revealed_cards_data', onRevealedCardsData);
    };
  }, [patch, addLog, roomCode]);

  return (
    <GameContext.Provider value={{
      ...state,
      emitIn:  useCallback(() => { console.log('[GameContext] emit action_in');   getSocket().emit('action_in');   patch({ isMyTurn: false, turnPhase: null }); }, [patch]),
      emitOut: useCallback(() => { console.log('[GameContext] emit action_out');  getSocket().emit('action_out');  patch({ isMyTurn: false, turnPhase: null }); }, [patch]),
      emitOutAndPass: useCallback(() => { console.log('[GameContext] emit action_out_and_pass'); getSocket().emit('action_out_and_pass'); patch({ isMyTurn: false, turnPhase: null, myOutAndPass: true }); }, [patch]),
      emitJoin: useCallback(() => { console.log('[GameContext] emit action_join'); getSocket().emit('action_join'); patch({ isMyTurn: false, turnPhase: null }); }, [patch]),
      emitPass: useCallback(() => { console.log('[GameContext] emit action_pass'); getSocket().emit('action_pass'); patch({ isMyTurn: false, turnPhase: null }); }, [patch]),
      dismissShowdown: useCallback(() => patch({ showdownData: null }), [patch]),
      dismissKnock:    useCallback(() => patch({ latestKnock: null }),   [patch]),
      requestRevealedCards: useCallback((targetPlayerId: string) => {
        getSocket().emit('request_revealed_cards', { targetPlayerId });
      }, []),
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
