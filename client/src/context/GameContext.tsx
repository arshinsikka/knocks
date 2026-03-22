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
  role: 'winner' | 'payer' | 'safe';
}

export interface ShowdownData {
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

export type PlayerAction = 'in' | 'out' | 'join' | 'pass';

export interface GameState {
  gamePhase:      'LOBBY' | 'PLAYING' | 'GAME_OVER';
  orbit:          number;
  round:          number;
  potTotal:       number;
  payout:         number;
  knockTarget:    number;
  roundsPerOrbit: number;
  players:        PublicPlayer[];
  myCards:      Card[];
  myId:         string;
  isMyTurn:     boolean;
  turnPhase:    'in_out' | 'challenge_join' | null;
  waitingFor:   { playerName: string; phase: string } | null;
  showdownData: ShowdownData | null;
  gameOver:     GameOverData | null;
  latestKnock:  { playerName: string; newKnockCount: number; knockTarget: number } | null;
  serverPhase:  string;
  playerChoices: Record<string, PlayerAction>;  // playerName → latest action
  log:          string[];
}

interface GameContextValue extends GameState {
  emitIn:          () => void;
  emitOut:         () => void;
  emitJoin:        () => void;
  emitPass:        () => void;
  dismissShowdown: () => void;
  dismissKnock:    () => void;
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
  myCards:       [],
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
};

const GameContext = createContext<GameContextValue>({
  ...DEFAULT,
  emitIn:  () => {}, emitOut:  () => {},
  emitJoin: () => {}, emitPass: () => {},
  dismissShowdown: () => {}, dismissKnock: () => {},
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
        players: d.players, myCards: [], isMyTurn: false, turnPhase: null,
        waitingFor: null, latestKnock: null,
        // showdownData intentionally NOT cleared here — the overlay manages
        // its own 6-second lifecycle and dismisses independently via dismissShowdown.
        serverPhase: 'IN_OUT', playerChoices: {},
      });
      addLog(`Orbit ${d.orbit} · Round ${d.round} — ${d.startingPlayerName} goes first`);
    };

    const onCardsDealt = (d: { round: number; cards: Card[] }) =>
      patch({ myCards: d.cards });

    const onYourTurn = (d: { phase: 'in_out' | 'challenge_join' }) => {
      console.log('[GameContext] your_turn received:', d);
      patch({ isMyTurn: true, turnPhase: d.phase, waitingFor: null });
    };

    const onWaitingFor = (d: { playerName: string; phase: string }) => {
      console.log('[GameContext] waiting_for received:', d);
      setState((prev) => {
        const myName = prev.players.find((p) => p.id === prev.myId)?.name;
        // Keep serverPhase in sync — the server never sends a dedicated
        // phase-change event for CHALLENGE_JOIN, so we derive it here.
        const newServerPhase =
          d.phase === 'challenge_join' ? 'CHALLENGE_JOIN'
          : d.phase === 'in_out'       ? 'IN_OUT'
          : prev.serverPhase;
        return {
          ...prev,
          waitingFor: d,
          serverPhase: newServerPhase,
          // The active player also receives waiting_for (room broadcast).
          // Don't clear isMyTurn if it's actually our turn.
          isMyTurn: myName === d.playerName ? prev.isMyTurn : false,
        };
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
      participants: ShowdownParticipant[];
      winner: string | null; payout: number; eachPayerPays: number; tie?: boolean;
    }) => patch({
      isMyTurn: false, turnPhase: null,
      showdownData: { ...d, tie: d.tie ?? false, isPublic: false },
      serverPhase: 'SHOWDOWN',
    });

    const onShowdownPublic = (d: {
      participantNames: string[]; winnerName: string | null;
      payout: number; eachPayerPays: number; tie?: boolean;
    }) => patch({
      isMyTurn: false, turnPhase: null,
      showdownData: {
        participants: d.participantNames.map((name) => ({ name, cards: [], handType: '', role: 'safe' as const })),
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
      patch({ serverPhase: 'ROUND_END' });
      if (d.isNewOrbit) addLog(`New orbit ${d.nextOrbit}`);
    };

    const onGameOver = (d: GameOverData) => {
      patch({ gamePhase: 'GAME_OVER', gameOver: d, isMyTurn: false });
      addLog(`Game over — ${d.winnerName} wins`);
    };

    const onStateSnapshot = (d: {
      orbit: number; round: number; potTotal: number; payout?: number;
      phase: string; knockTarget: number; roundsPerOrbit?: number;
      players: PublicPlayer[]; myCards: Card[];
      waitingFor?: { playerName: string; phase: string } | null;
      myId?: string;
    }) => patch({
      gamePhase: 'PLAYING', orbit: d.orbit, round: d.round,
      potTotal: d.potTotal, payout: d.payout ?? 0,
      knockTarget: d.knockTarget,
      ...(d.roundsPerOrbit !== undefined ? { roundsPerOrbit: d.roundsPerOrbit } : {}),
      players: d.players, myCards: d.myCards, serverPhase: d.phase,
      ...(d.waitingFor !== undefined ? { waitingFor: d.waitingFor } : {}),
      // myId from server is the stable game-player ID, which survives socket reconnects.
      // Without this, after a page refresh the new socket.id wouldn't match any player.
      ...(d.myId !== undefined ? { myId: d.myId } : {}),
    });

    socket.on('round_started',   onRoundStarted);
    socket.on('cards_dealt',     onCardsDealt);
    socket.on('your_turn',       onYourTurn);
    socket.on('waiting_for',     onWaitingFor);
    socket.on('player_acted',    onPlayerActed);
    socket.on('showdown_reveal', onShowdownReveal);
    socket.on('showdown_public', onShowdownPublic);
    socket.on('knock_awarded',   onKnockAwarded);
    socket.on('balance_update',  onBalanceUpdate);
    socket.on('round_ended',     onRoundEnded);
    socket.on('game_over',       onGameOver);
    socket.on('state_snapshot',  onStateSnapshot);

    // Restore full game state (including turn info) now that all listeners are registered.
    // This covers both fresh game-starts and page refreshes mid-game.
    socket.emit('request_state', { roomCode });

    return () => {
      socket.off('round_started',   onRoundStarted);
      socket.off('cards_dealt',     onCardsDealt);
      socket.off('your_turn',       onYourTurn);
      socket.off('waiting_for',     onWaitingFor);
      socket.off('player_acted',    onPlayerActed);
      socket.off('showdown_reveal', onShowdownReveal);
      socket.off('showdown_public', onShowdownPublic);
      socket.off('knock_awarded',   onKnockAwarded);
      socket.off('balance_update',  onBalanceUpdate);
      socket.off('round_ended',     onRoundEnded);
      socket.off('game_over',       onGameOver);
      socket.off('state_snapshot',  onStateSnapshot);
    };
  }, [patch, addLog, roomCode]);

  return (
    <GameContext.Provider value={{
      ...state,
      emitIn:  useCallback(() => { console.log('[GameContext] emit action_in');   getSocket().emit('action_in');   }, []),
      emitOut: useCallback(() => { console.log('[GameContext] emit action_out');  getSocket().emit('action_out');  }, []),
      emitJoin: useCallback(() => { console.log('[GameContext] emit action_join'); getSocket().emit('action_join'); }, []),
      emitPass: useCallback(() => { console.log('[GameContext] emit action_pass'); getSocket().emit('action_pass'); }, []),
      dismissShowdown: useCallback(() => patch({ showdownData: null }), [patch]),
      dismissKnock:    useCallback(() => patch({ latestKnock: null }),   [patch]),
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
