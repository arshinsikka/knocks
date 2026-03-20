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
}

export interface ShowdownData {
  participants: ShowdownParticipant[];
  winner: string;
  payout: number;
  eachLoserPays: number;
  isPublic: boolean;
}

export interface GameOverData {
  winnerName: string;
  winnerKnocks: number;
  potTotal: number;
  finalBalances: { name: string; balance: number; knocks: number }[];
}

export type PlayerAction = 'in' | 'out' | 'join' | 'pass';

export interface GameState {
  gamePhase:    'LOBBY' | 'PLAYING' | 'GAME_OVER';
  orbit:        number;
  round:        number;
  potTotal:     number;
  payout:       number;
  knockTarget:  number;
  players:      PublicPlayer[];
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
  gamePhase:     'LOBBY',
  orbit:         1,
  round:         1,
  potTotal:      0,
  payout:        0,
  knockTarget:   5,
  players:       [],
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
}: { children: ReactNode; knockTarget: number }) {
  const [state, setState] = useState<GameState>({ ...DEFAULT, knockTarget });

  const patch = useCallback((p: Partial<GameState>) =>
    setState((prev) => ({ ...prev, ...p })), []);

  const addLog = useCallback((entry: string) =>
    setState((prev) => ({ ...prev, log: [...prev.log.slice(-49), entry] })), []);

  useEffect(() => {
    const socket = getSocket();

    const setId = () => patch({ myId: socket.id ?? '' });
    if (socket.connected) setId(); else socket.once('connect', setId);

    const onRoundStarted = (d: {
      orbit: number; round: number; knockTarget: number;
      potTotal: number; payout: number; startingPlayerName: string;
      players: PublicPlayer[];
    }) => {
      patch({
        gamePhase: 'PLAYING', orbit: d.orbit, round: d.round,
        knockTarget: d.knockTarget, potTotal: d.potTotal, payout: d.payout,
        players: d.players, myCards: [], isMyTurn: false, turnPhase: null,
        waitingFor: null, showdownData: null, latestKnock: null,
        serverPhase: 'IN_OUT', playerChoices: {},
      });
      addLog(`Orbit ${d.orbit} · Round ${d.round} — ${d.startingPlayerName} goes first`);
    };

    const onCardsDealt = (d: { round: number; cards: Card[] }) =>
      patch({ myCards: d.cards });

    const onYourTurn = (d: { phase: 'in_out' | 'challenge_join' }) =>
      patch({ isMyTurn: true, turnPhase: d.phase, waitingFor: null });

    const onWaitingFor = (d: { playerName: string; phase: string }) =>
      patch({ isMyTurn: false, waitingFor: d });

    const onPlayerActed = (d: { playerName: string; action: PlayerAction }) => {
      setState((prev) => ({
        ...prev,
        playerChoices: { ...prev.playerChoices, [d.playerName]: d.action },
        log: [...prev.log.slice(-49), `${d.playerName}  ${d.action.toUpperCase()}`],
      }));
    };

    const onShowdownReveal = (d: {
      participants: ShowdownParticipant[];
      winner: string; payout: number; eachLoserPays: number;
    }) => patch({
      isMyTurn: false, turnPhase: null,
      showdownData: { ...d, isPublic: false }, serverPhase: 'SHOWDOWN',
    });

    const onShowdownPublic = (d: {
      participantNames: string[]; winnerName: string;
      payout: number; eachLoserPays: number;
    }) => patch({
      isMyTurn: false, turnPhase: null,
      showdownData: {
        participants: d.participantNames.map((name) => ({ name, cards: [], handType: '' })),
        winner: d.winnerName, payout: d.payout,
        eachLoserPays: d.eachLoserPays, isPublic: true,
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
      orbit: number; round: number; potTotal: number;
      phase: string; knockTarget: number; players: PublicPlayer[]; myCards: Card[];
    }) => patch({
      gamePhase: 'PLAYING', orbit: d.orbit, round: d.round,
      potTotal: d.potTotal, knockTarget: d.knockTarget,
      players: d.players, myCards: d.myCards, serverPhase: d.phase,
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
  }, [patch, addLog]);

  return (
    <GameContext.Provider value={{
      ...state,
      emitIn:  useCallback(() => getSocket().emit('action_in'),   []),
      emitOut: useCallback(() => getSocket().emit('action_out'),  []),
      emitJoin: useCallback(() => getSocket().emit('action_join'), []),
      emitPass: useCallback(() => getSocket().emit('action_pass'), []),
      dismissShowdown: useCallback(() => patch({ showdownData: null }), [patch]),
      dismissKnock:    useCallback(() => patch({ latestKnock: null }),   [patch]),
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
