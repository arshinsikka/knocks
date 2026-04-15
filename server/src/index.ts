import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './game/GameRoom';
import { calculatePayout } from './game/Pot';
import { Card, BestHand, GamePlayer } from './game/types';
import { findJoker } from './game/Rounds';

// ── Lobby types ───────────────────────────────────────────────────────────────

interface LobbyPlayer {
  id: string;   // = socket.id
  name: string;
}

interface PlayerLedgerResult {
  name: string;
  knocks: number;
  orbitFees: number;
  showdownWinnings: number;
  showdownLosses: number;
  potCollected: number;
  finalBalance: number;
}

interface GameResult {
  gameNumber: number;
  winner: string;
  winnerKnocks: number;
  knockTarget: number;
  orbitsPlayed: number;
  playerResults: PlayerLedgerResult[];
  timestamp: string;
}

interface RoomState {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  knockTarget: 5 | 6;
  roundsPerOrbit: 5 | 6;
  challengeLimit: 'none' | 12 | 18 | 24;
  gameStarted: boolean;
  lastActivity: number; // Date.now() ms
  ledger: GameResult[];
}

// ── Maps ─────────────────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>();
const activeGames = new Map<string, GameRoom>(); // roomCode → GameRoom
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>(); // roomCode → timer
// Lobby disconnect grace-period timers: "${roomCode}:${playerName}" → setTimeout
const lobbyDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const TURN_TIMEOUT_MS = 15_000;
const LOBBY_GRACE_MS  = 60_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  const consonants = 'BDFGHKLMNPRSTVWZ';
  const vowels = 'AEIOU';
  let code = '';
  for (let i = 0; i < 6; i++) {
    const pool = i % 2 === 0 ? consonants : vowels;
    code += pool[Math.floor(Math.random() * pool.length)];
  }
  return code;
}

function uniqueCode(): string {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();
  return code;
}

function findGameBySocket(socketId: string): [string, GameRoom, GamePlayer] | null {
  for (const [code, game] of activeGames) {
    const p = game.getState().players.find((pl) => pl.socketId === socketId);
    if (p) return [code, game, p];
  }
  return null;
}

function touchRoom(code: string) {
  const r = rooms.get(code);
  if (r) r.lastActivity = Date.now();
}

function publicPlayers(game: GameRoom) {
  return game.getState().players.map(({ id, name, balance, knocks }) => ({
    id,
    name,
    balance,
    knocks,
  }));
}

function getWaitingInfo(game: GameRoom): { playerName: string; phase: string } | null {
  const s = game.getState();
  if (s.phase === 'IN_OUT') {
    const actor = game.currentActor();
    return actor ? { playerName: actor.name, phase: 'in_out' } : null;
  }
  if (s.phase === 'CHALLENGE_JOIN') {
    const actor = game.currentChallengeJoinActor();
    return actor ? { playerName: actor.name, phase: 'challenge_join' } : null;
  }
  return null;
}

// ── Turn timeout helpers ──────────────────────────────────────────────────────

function clearTurnTimer(roomCode: string) {
  const t = turnTimers.get(roomCode);
  if (t) { clearTimeout(t); turnTimers.delete(roomCode); }
}

function startTurnTimer(
  io: Server,
  game: GameRoom,
  roomCode: string,
  player: GamePlayer,
  phase: 'in_out' | 'challenge_join',
) {
  clearTurnTimer(roomCode);
  const t = setTimeout(() => {
    turnTimers.delete(roomCode);
    const s = game.getState();
    // Guard: phase may have already advanced (race with manual action)
    const expectedPhase = phase === 'in_out' ? 'IN_OUT' : 'CHALLENGE_JOIN';
    if (s.phase !== expectedPhase) return;

    const defaultAction = phase === 'in_out' ? 'out' : 'pass';
    console.log(`[timeout] Auto-${defaultAction.toUpperCase()} for "${player.name}" in ${roomCode}`);

    if (phase === 'in_out') {
      const ok = game.submitInOut(player.id, 'out');
      if (!ok) return;
      touchRoom(roomCode);
      io.to(roomCode).emit('player_acted', { playerName: player.name, action: 'out' });
      afterInOut(io, game, roomCode);
    } else {
      const ok = game.submitJoinPass(player.id, 'pass');
      if (!ok) return;
      touchRoom(roomCode);
      io.to(roomCode).emit('player_acted', { playerName: player.name, action: 'pass' });
      afterChallengeJoin(io, game, roomCode);
    }
  }, TURN_TIMEOUT_MS);
  turnTimers.set(roomCode, t);
}

// ── Game event emitters ───────────────────────────────────────────────────────

function emitRoundStart(io: Server, game: GameRoom, roomCode: string) {
  const dealt = game.startRound();         // advances phase → IN_OUT
  const s = game.getState();
  const payout = calculatePayout(s.orbit, s.potTotal, s.challengeLimit);
  const starter = s.players[s.orbitStarterIndex];

  io.to(roomCode).emit('round_started', {
    orbit: s.orbit,
    round: s.round,
    knockTarget: s.knockTarget,
    potTotal: s.potTotal,
    payout,
    startingPlayerName: starter.name,
    players: publicPlayers(game),
  });

  // Private card delivery
  for (const [playerId, cards] of dealt) {
    const pl = s.players.find((p) => p.id === playerId)!;
    io.to(pl.socketId).emit('cards_dealt', {
      round: s.round,
      cards,
      selectedCards: pl.bestHand?.cards ?? cards,
    });
  }

  // First actor
  const actor = game.currentActor();
  if (actor) {
    console.log(`[turn] ${roomCode} IN_OUT → "${actor.name}" (${actor.socketId})`);
    io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'in_out' });
    io.to(actor.socketId).emit('your_turn', { phase: 'in_out' });
    startTurnTimer(io, game, roomCode, actor, 'in_out');
  }
}

// ── Showdown card data helper ──────────────────────────────────────────────────

function cardKey(c: Card): string { return `${c.rank}-${c.suit}`; }

function getShowdownCardData(pp: GamePlayer, round: number): {
  cards: Card[];
  imaginedCard?: Card;
  jokerTriggered?: boolean;
  jokerOriginalCard?: Card;
  jokerBecame?: Card;
} {
  const bestHand = pp.bestHand!;

  if (round === 2) {
    // Send the 2 real dealt cards; identify imagined 3rd from bestHand
    const realKeys = new Set(pp.cards.map(cardKey));
    const imaginedCard = bestHand.cards.find((c) => !realKeys.has(cardKey(c)));
    return { cards: pp.cards, imaginedCard };
  }

  if (round === 3) {
    const jokerCard = findJoker(pp.cards as [Card, Card, Card]);
    if (jokerCard) {
      const realCards = pp.cards.filter((c) => c !== jokerCard);
      const realKeys = new Set(realCards.map(cardKey));
      const jokerBecame = bestHand.cards.find((c) => !realKeys.has(cardKey(c)));
      return {
        cards: pp.cards,
        jokerTriggered: true,
        jokerOriginalCard: jokerCard,
        jokerBecame,
      };
    }
    return { cards: pp.cards, jokerTriggered: false };
  }

  // Rounds 1, 4, 5, 6: bestHand.cards already contains the correct subset
  return { cards: bestHand.cards };
}

function resolveAndEmit(io: Server, game: GameRoom, roomCode: string) {
  clearTurnTimer(roomCode);
  const summary = game.resolveRound();
  const s = game.getState();

  const participants = s.players.filter(
    (p) => p.choice === 'in' || p.choice === 'join',
  );
  const nonParticipants = s.players.filter(
    (p) => p.choice !== 'in' && p.choice !== 'join',
  );

  if (participants.length >= 2) {
    const winnerPlayer = summary.winner
      ? s.players.find((p) => p.id === summary.winner) ?? null
      : null;
    const payerIdSet = new Set(summary.payerIds);
    const numPayers = payerIdSet.size;
    const eachPayerPays = numPayers > 0 ? summary.payout / numPayers : 0;

    // showdown_reveal → participants only
    const allHandsMap = new Map(
      participants.map((p) => [p.id, p.bestHand as BestHand]),
    );

    for (const p of participants) {
      io.to(p.socketId).emit('showdown_reveal', {
        round: s.round,
        participants: participants.map((pp) => {
          const hand = allHandsMap.get(pp.id)!;
          const cardData = getShowdownCardData(pp, s.round);
          return {
            name: pp.name,
            handType: hand?.type,
            handValues: hand?.values ?? [],
            role: pp.id === summary.winner ? 'winner'
                : payerIdSet.has(pp.id) ? 'payer'
                : 'safe',
            ...cardData,
          };
        }),
        winner: winnerPlayer?.name ?? null,
        payout: summary.payout,
        eachPayerPays,
        tie: summary.tie,
      });
    }

    // Record card memory so participants can recall what they saw later this orbit
    game.recordRevealedCards(
      participants.map((pp) => ({
        id: pp.id,
        name: pp.name,
        shownCards: getShowdownCardData(pp, s.round).cards,
      })),
      s.round,
    );

    // showdown_public → non-participants (no cards)
    for (const p of nonParticipants) {
      io.to(p.socketId).emit('showdown_public', {
        participantNames: participants.map((pp) => pp.name),
        winnerName: winnerPlayer?.name ?? null,
        payout: summary.payout,
        eachPayerPays,
        tie: summary.tie,
      });
    }
  }

  if (summary.knockAwarded && summary.winner) {
    const kp = s.players.find((p) => p.id === summary.winner)!;
    io.to(roomCode).emit('knock_awarded', {
      playerName: kp.name,
      newKnockCount: kp.knocks,
      knockTarget: s.knockTarget,
    });
  }

  io.to(roomCode).emit('balance_update', { players: publicPlayers(game) });

  if (s.phase === 'GAME_OVER') {
    const winner = s.players.find((p) => p.id === s.gameOverWinner)!;
    const room = rooms.get(roomCode);
    const gameResult: GameResult = {
      gameNumber: room ? room.ledger.length + 1 : 1,
      winner: winner.name,
      winnerKnocks: winner.knocks,
      knockTarget: s.knockTarget,
      orbitsPlayed: s.orbit,
      playerResults: s.players.map((p) => ({
        name: p.name,
        knocks: p.knocks,
        orbitFees: p.totalOrbitFees,
        showdownWinnings: p.showdownWinnings,
        showdownLosses: p.showdownLosses,
        potCollected: p.potCollected,
        finalBalance: p.balance,
      })),
      timestamp: new Date().toISOString(),
    };
    if (room) room.ledger.push(gameResult);

    io.to(roomCode).emit('game_over', {
      winnerName: winner.name,
      winnerKnocks: winner.knocks,
      potTotal: s.potTotal,
      knockTarget: s.knockTarget,
      finalBalances: s.players.map(({
        name, balance, knocks,
        totalOrbitFees, showdownWinnings, showdownLosses, potCollected,
      }) => ({
        name, balance, knocks,
        totalOrbitFees, showdownWinnings, showdownLosses, potCollected,
      })),
      ledger: room ? room.ledger : [],
    });
    activeGames.delete(roomCode);
    return;
  }

  const prevRound = s.round;
  const prevOrbit = s.orbit;
  game.advanceRound();
  const ns = game.getState();

  io.to(roomCode).emit('round_ended', {
    nextRound: ns.round,
    nextOrbit: ns.orbit,
    isNewOrbit: ns.orbit > prevOrbit,
  });

  setTimeout(() => emitRoundStart(io, game, roomCode), 2500);
}

function afterInOut(io: Server, game: GameRoom, roomCode: string) {
  const s = game.getState();

  if (s.phase === 'ROUND_END') {
    // All players said OUT — no showdown
    clearTurnTimer(roomCode);
    resolveAndEmit(io, game, roomCode);
  } else if (s.phase === 'SHOWDOWN') {
    // All players said IN — skip challenge window
    clearTurnTimer(roomCode);
    resolveAndEmit(io, game, roomCode);
  } else if (s.phase === 'CHALLENGE_JOIN') {
    const actor = game.currentChallengeJoinActor();
    if (actor) {
      console.log(`[turn] ${roomCode} CHALLENGE_JOIN → "${actor.name}" (${actor.socketId})`);
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'challenge_join' });
      io.to(actor.socketId).emit('your_turn', { phase: 'challenge_join' });
      startTurnTimer(io, game, roomCode, actor, 'challenge_join');
    }
  } else {
    // Still IN_OUT
    const actor = game.currentActor();
    if (actor) {
      console.log(`[turn] ${roomCode} IN_OUT → "${actor.name}" (${actor.socketId})`);
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'in_out' });
      io.to(actor.socketId).emit('your_turn', { phase: 'in_out' });
      startTurnTimer(io, game, roomCode, actor, 'in_out');
    }
  }
}

function afterChallengeJoin(io: Server, game: GameRoom, roomCode: string) {
  const s = game.getState();

  if (s.phase === 'SHOWDOWN') {
    clearTurnTimer(roomCode);
    resolveAndEmit(io, game, roomCode);
  } else {
    // Still CHALLENGE_JOIN — more OUT players to answer
    const actor = game.currentChallengeJoinActor();
    if (actor) {
      console.log(`[turn] ${roomCode} CHALLENGE_JOIN → "${actor.name}" (${actor.socketId})`);
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'challenge_join' });
      io.to(actor.socketId).emit('your_turn', { phase: 'challenge_join' });
      startTurnTimer(io, game, roomCode, actor, 'challenge_join');
    }
  }
}

// ── Express + Socket.IO ───────────────────────────────────────────────────────

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((s) => s.trim());
  return allowed.includes(origin) || origin.endsWith('.vercel.app');
}

const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
  } else {
    callback(new Error('CORS not allowed'));
  }
};

const app = express();
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});

io.engine.on('connection_error', (err: { code: string; message: string }) => {
  console.log('[engine] Connection error:', err.code, err.message);
});

io.on('connection', (socket: Socket) => {
  console.log(`[+] ${socket.id}`);

  // ── LOBBY: create_room ──────────────────────────────────────────────────────
  socket.on(
    'create_room',
    ({ playerName, knockTarget, roundsPerOrbit = 5, challengeLimit = 12 }: {
      playerName: string; knockTarget: 5 | 6;
      roundsPerOrbit?: 5 | 6; challengeLimit?: 'none' | 12 | 18 | 24;
    }) => {
      if (!playerName?.trim()) { socket.emit('error', { message: 'Name required' }); return; }

      const code = uniqueCode();
      rooms.set(code, {
        code,
        hostId: socket.id,
        players: [{ id: socket.id, name: playerName.trim() }],
        knockTarget,
        roundsPerOrbit,
        challengeLimit,
        gameStarted: false,
        lastActivity: Date.now(),
        ledger: [],
      });
      socket.join(code);

      socket.emit('room_created', {
        roomCode: code,
        knockTarget,
        roundsPerOrbit,
        challengeLimit,
        players: rooms.get(code)!.players,
        hostId: socket.id,
      });

      console.log(`[room] CREATED ${code} by "${playerName}" (total rooms: ${rooms.size})`);
    },
  );

  // ── LOBBY: join_room ────────────────────────────────────────────────────────
  socket.on(
    'join_room',
    ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
      if (room.gameStarted) { socket.emit('error', { message: 'Game already in progress' }); return; }
      if (room.players.length >= 6) { socket.emit('error', { message: 'Room is full' }); return; }
      if (!playerName?.trim()) { socket.emit('error', { message: 'Name required' }); return; }

      const player = { id: socket.id, name: playerName.trim() };
      room.players.push(player);
      room.lastActivity = Date.now();
      socket.join(room.code);

      socket.emit('room_joined', {
        roomCode: room.code,
        knockTarget: room.knockTarget,
        roundsPerOrbit: room.roundsPerOrbit,
        challengeLimit: room.challengeLimit,
        players: room.players,
        hostId: room.hostId,
      });

      io.to(room.code).emit('player_joined', {
        players: room.players,
        newPlayer: player,
        hostId: room.hostId,
      });

      console.log(`ROOM ${room.code}: ${playerName} joined. Players: ${room.players.map((p) => p.name).join(', ')}`);
    },
  );

  // ── LOBBY: start_game ───────────────────────────────────────────────────────
  socket.on('start_game', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.hostId !== socket.id) { socket.emit('error', { message: 'Only the host can start' }); return; }
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players' }); return; }

    room.gameStarted = true;
    room.lastActivity = Date.now();

    const game = new GameRoom(
      roomCode,
      room.players.map((p) => ({ id: p.id, name: p.name, socketId: p.id })),
      room.knockTarget,
      room.roundsPerOrbit,
      room.challengeLimit,
    );
    activeGames.set(roomCode, game);

    io.to(roomCode).emit('game_started', {
      players: room.players,
      knockTarget: room.knockTarget,
      roundsPerOrbit: room.roundsPerOrbit,
      challengeLimit: room.challengeLimit,
    });

    console.log(`[room] GAME STARTED in ${roomCode} (players: ${room.players.length})`);

    // Small delay then deal round 1
    setTimeout(() => emitRoundStart(io, game, roomCode), 800);
  });

  // ── GAME: action_in ─────────────────────────────────────────────────────────
  socket.on('action_in', () => {
    console.log(`[action_in] socket=${socket.id}`);
    const found = findGameBySocket(socket.id);
    if (!found) { console.log(`[action_in] no game found for socket=${socket.id}`); return; }
    const [code, game, player] = found;
    console.log(`[action_in] player="${player.name}" phase=${game.getState().phase} turn=${game.getState().players[game.getState().currentTurnIndex]?.name}`);
    if (game.getState().phase !== 'IN_OUT') return;

    clearTurnTimer(code);
    const ok = game.submitInOut(player.id, 'in');
    if (!ok) { console.log(`[action_in] submitInOut rejected for player="${player.name}"`); return; }

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'in' });
    afterInOut(io, game, code);
  });

  // ── GAME: action_out ────────────────────────────────────────────────────────
  socket.on('action_out', () => {
    console.log(`[action_out] socket=${socket.id}`);
    const found = findGameBySocket(socket.id);
    if (!found) { console.log(`[action_out] no game found for socket=${socket.id}`); return; }
    const [code, game, player] = found;
    console.log(`[action_out] player="${player.name}" phase=${game.getState().phase} turn=${game.getState().players[game.getState().currentTurnIndex]?.name}`);
    if (game.getState().phase !== 'IN_OUT') return;

    clearTurnTimer(code);
    const ok = game.submitInOut(player.id, 'out');
    if (!ok) { console.log(`[action_out] submitInOut rejected for player="${player.name}"`); return; }

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'out' });
    afterInOut(io, game, code);
  });

  // ── GAME: action_join ───────────────────────────────────────────────────────
  socket.on('action_join', () => {
    console.log(`[action_join] socket=${socket.id}`);
    const found = findGameBySocket(socket.id);
    if (!found) {
      console.log(`[action_join] no game found for socket=${socket.id}`);
      socket.emit('error', { message: 'Not in a game' });
      return;
    }
    const [code, game, player] = found;
    console.log(`[action_join] player="${player.name}" phase=${game.getState().phase} currentActor=${game.currentChallengeJoinActor()?.name}`);
    if (game.getState().phase !== 'CHALLENGE_JOIN') {
      socket.emit('error', { message: 'Not in challenge phase' });
      return;
    }
    clearTurnTimer(code);
    const ok = game.submitJoinPass(player.id, 'join');
    if (!ok) {
      console.log(`[action_join] rejected for player="${player.name}"`);
      socket.emit('error', { message: 'Not your turn to challenge' });
      return;
    }
    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'join' });
    afterChallengeJoin(io, game, code);
  });

  // ── GAME: action_pass ───────────────────────────────────────────────────────
  socket.on('action_pass', () => {
    console.log(`[action_pass] socket=${socket.id}`);
    const found = findGameBySocket(socket.id);
    if (!found) {
      console.log(`[action_pass] no game found for socket=${socket.id}`);
      socket.emit('error', { message: 'Not in a game' });
      return;
    }
    const [code, game, player] = found;
    console.log(`[action_pass] player="${player.name}" phase=${game.getState().phase} currentActor=${game.currentChallengeJoinActor()?.name}`);
    if (game.getState().phase !== 'CHALLENGE_JOIN') {
      socket.emit('error', { message: 'Not in challenge phase' });
      return;
    }
    clearTurnTimer(code);
    const ok = game.submitJoinPass(player.id, 'pass');
    if (!ok) {
      console.log(`[action_pass] rejected for player="${player.name}"`);
      socket.emit('error', { message: 'Not your turn to pass' });
      return;
    }
    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'pass' });
    afterChallengeJoin(io, game, code);
  });

  // ── GAME/LOBBY: rejoin_game ──────────────────────────────────────────────────
  // Handles both lobby reconnections (page refresh before game start) and
  // in-game reconnections (page refresh mid-game).
  socket.on('rejoin_game', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const upper = roomCode?.toUpperCase();
    const game  = activeGames.get(upper);

    if (!game) {
      // ── Lobby reconnection path ───────────────────────────────────────────
      const room = rooms.get(upper);
      if (!room || room.gameStarted) return; // Unknown room or race with game start

      const player = room.players.find((p) => p.name === playerName);
      if (!player) return; // Player not in this lobby; ignore silently

      // Cancel the 60-second eviction grace period
      const timerKey = `${upper}:${playerName}`;
      const pending = lobbyDisconnectTimers.get(timerKey);
      if (pending) { clearTimeout(pending); lobbyDisconnectTimers.delete(timerKey); }

      // Re-associate socket ID
      const oldId = player.id;
      player.id   = socket.id;
      if (room.hostId === oldId) room.hostId = socket.id;
      room.lastActivity = Date.now();
      socket.join(upper);

      // Broadcast updated player list to everyone (including the reconnecting socket,
      // which just joined the room).  LobbyView listens for player_joined to refresh.
      io.to(upper).emit('player_joined', {
        players: room.players,
        newPlayer: { id: socket.id, name: playerName },
        hostId: room.hostId,
      });

      console.log(`[room] "${playerName}" rejoined lobby ${upper} (players: ${room.players.length})`);
      return;
    }

    // ── In-game reconnection path ─────────────────────────────────────────────
    const s = game.getState();
    const player = s.players.find((p) => p.name === playerName);
    if (!player) { socket.emit('error', { message: 'Player not in game' }); return; }

    // Re-associate socket
    (player as GamePlayer).socketId = socket.id;
    socket.join(upper);

    const room = rooms.get(upper);
    if (room) {
      const lp = room.players.find((p) => p.name === playerName);
      if (lp) lp.id = socket.id;
      room.lastActivity = Date.now();
    }

    const payout = calculatePayout(s.orbit, s.potTotal, s.challengeLimit);
    const waitingInfo = getWaitingInfo(game);

    socket.emit('state_snapshot', {
      orbit: s.orbit,
      round: s.round,
      potTotal: s.potTotal,
      payout,
      phase: s.phase,
      knockTarget: s.knockTarget,
      roundsPerOrbit: s.roundsPerOrbit,
      challengeLimit: s.challengeLimit,
      players: publicPlayers(game),
      myCards: player.cards,
      selectedCards: player.bestHand?.cards ?? player.cards,
      waitingFor: waitingInfo ?? null,
      // Stable game-player ID — survives socket reconnects (socket.id changes on refresh)
      myId: player.id,
    });

    // Re-emit turn signals so the rejoining player knows where we are
    if (waitingInfo) {
      socket.emit('waiting_for', waitingInfo);
      const actor = s.phase === 'IN_OUT' ? game.currentActor() : game.currentChallengeJoinActor();
      if (actor && actor.socketId === socket.id) {
        socket.emit('your_turn', { phase: waitingInfo.phase });
      }
    }

    console.log(`[room] "${playerName}" rejoined game ${upper}`);
  });

  // ── GAME: request_state (restore context after GameProvider mounts) ──────────
  socket.on('request_state', ({ roomCode }: { roomCode: string }) => {
    const game = activeGames.get(roomCode);
    if (!game) return;
    const s = game.getState();
    const me = s.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    const payout = calculatePayout(s.orbit, s.potTotal, s.challengeLimit);
    const waitingInfo = getWaitingInfo(game);

    socket.emit('state_snapshot', {
      orbit: s.orbit,
      round: s.round,
      potTotal: s.potTotal,
      payout,
      phase: s.phase,
      knockTarget: s.knockTarget,
      roundsPerOrbit: s.roundsPerOrbit,
      challengeLimit: s.challengeLimit,
      players: publicPlayers(game),
      myCards: me.cards,
      selectedCards: me.bestHand?.cards ?? me.cards,
      waitingFor: waitingInfo ?? null,
      myId: me.id,
    });

    // Re-emit turn signals
    if (waitingInfo) {
      socket.emit('waiting_for', waitingInfo);
      const actor = s.phase === 'IN_OUT' ? game.currentActor() : game.currentChallengeJoinActor();
      if (actor && actor.socketId === socket.id) {
        socket.emit('your_turn', { phase: waitingInfo.phase });
      }
    }
  });

  // ── GAME: request_revealed_cards ────────────────────────────────────────────
  // Player requests cards they previously saw of a specific opponent in a showdown.
  // Server verifies they actually saw those cards before responding.
  socket.on('request_revealed_cards', ({ targetPlayerId }: { targetPlayerId: string }) => {
    const found = findGameBySocket(socket.id);
    if (!found) {
      console.log(`[CARD MEMORY REQUEST] socket=${socket.id} not found in any game`);
      return;
    }
    const [, game, observer] = found;
    const s = game.getState();
    const target = s.players.find((p) => p.id === targetPlayerId);
    if (!target) {
      console.log(`[CARD MEMORY REQUEST] targetPlayerId=${targetPlayerId} not found`);
      return;
    }
    const { cards, rounds } = game.getRevealedCards(observer.id, targetPlayerId);
    console.log(
      `[CARD MEMORY REQUEST] ${observer.name} asking for ${target.name}'s cards` +
      ` — found: ${cards.length} card(s) in rounds [${rounds.join(', ')}]`,
    );
    socket.emit('revealed_cards_data', {
      targetPlayerId,
      targetPlayerName: target.name,
      cards,
      rounds,
    });
  });

  // ── GAME/LOBBY: request_ledger ──────────────────────────────────────────────
  socket.on('request_ledger', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode?.toUpperCase());
    if (!room) return;
    socket.emit('ledger_data', { ledger: room.ledger });
  });

  // ── LOBBY: request_rematch ─────────────────────────────────────────────────
  socket.on('request_rematch', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }
    // Any player in the room can trigger a rematch (not host-exclusive)
    const isInRoom = room.players.some((p) => p.id === socket.id);
    if (!isInRoom) { socket.emit('error', { message: 'Not in this room' }); return; }
    // Guard: don't allow rematch while a game is actively running
    if (activeGames.has(roomCode)) { socket.emit('error', { message: 'Game still in progress' }); return; }

    clearTurnTimer(roomCode);
    room.gameStarted = false;
    room.lastActivity = Date.now();

    io.to(roomCode).emit('rematch_started', {
      players: room.players,
      hostId: room.hostId,
      knockTarget: room.knockTarget,
      roundsPerOrbit: room.roundsPerOrbit,
      challengeLimit: room.challengeLimit,
    });

    console.log(`[room] REMATCH started in ${roomCode}`);
  });

  // ── LOBBY: leave_room ────────────────────────────────────────────────────────
  // Explicit leave (Back to Home, navigating away). In-game: keep room state so
  // the player can rejoin; just remove the socket from the broadcast channel.
  // Lobby: remove the player immediately (intentional departure, no grace period).
  socket.on('leave_room', ({ roomCode }: { roomCode: string }) => {
    const upper = roomCode?.toUpperCase();

    if (activeGames.has(upper)) {
      // Mid-game — player may rejoin; don't delete their game state
      socket.leave(upper);
      console.log(`[room] ${upper} leave_room mid-game (socket ${socket.id})`);
      return;
    }

    const room = rooms.get(upper);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;

    const playerName = room.players[idx].name;

    // Cancel any pending lobby-disconnect grace timer for this player
    const timerKey = `${upper}:${playerName}`;
    const pending  = lobbyDisconnectTimers.get(timerKey);
    if (pending) { clearTimeout(pending); lobbyDisconnectTimers.delete(timerKey); }

    const [removed] = room.players.splice(idx, 1);
    socket.leave(upper);

    if (room.hostId === removed.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    if (room.players.length > 0) {
      io.to(upper).emit('player_left', {
        players: room.players,
        removedPlayer: removed,
        hostId: room.hostId,
      });
    }

    room.lastActivity = Date.now();
    console.log(`[room] ${upper} player "${playerName}" left lobby (players: ${room.players.length})`);
  });

  // ── heartbeat ────────────────────────────────────────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);

    for (const [code, room] of rooms) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      if (room.gameStarted) {
        // In-game disconnect: keep room + player intact; they can rejoin_game
        console.log(`[room] ${code} in-game disconnect: "${room.players[idx].name}" — may rejoin`);
        break;
      }

      // Lobby disconnect: start a 60-second grace period before evicting.
      // This absorbs page refreshes, transport upgrades, and brief network blips.
      const playerName        = room.players[idx].name;
      const timerKey          = `${code}:${playerName}`;
      const disconnectedSockId = socket.id;

      // Cancel any previous grace timer for this player (e.g. double-disconnect)
      const existing = lobbyDisconnectTimers.get(timerKey);
      if (existing) clearTimeout(existing);

      console.log(`[room] ${code} lobby disconnect: "${playerName}" — 60s grace started`);

      const t = setTimeout(() => {
        lobbyDisconnectTimers.delete(timerKey);
        const r = rooms.get(code);
        if (!r || r.gameStarted) return; // Game started during grace — leave them in

        const i = r.players.findIndex((p) => p.name === playerName);
        if (i === -1) return; // Already evicted somehow

        // If the player reconnected their id will be different — don't evict
        if (r.players[i].id !== disconnectedSockId) return;

        const [removed] = r.players.splice(i, 1);
        if (r.hostId === removed.id && r.players.length > 0) {
          r.hostId = r.players[0].id;
        }

        if (r.players.length > 0) {
          io.to(code).emit('player_left', {
            players: r.players,
            removedPlayer: removed,
            hostId: r.hostId,
          });
        }
        // NOTE: We intentionally do NOT delete empty rooms here.
        // The 30-minute inactivity cleanup handles that. This prevents
        // a solo host refresh from killing the room.
        console.log(`[room] ${code} evicted "${playerName}" after 60s (players: ${r.players.length})`);
      }, LOBBY_GRACE_MS);

      lobbyDisconnectTimers.set(timerKey, t);
      break;
    }
  });
});

// ── Room cleanup (every 5 min, expire after 30 min idle) ─────────────────────

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const ROOM_TTL_MS         = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      // Cancel any pending lobby disconnect timers for this room
      for (const p of room.players) {
        const key = `${code}:${p.name}`;
        const t   = lobbyDisconnectTimers.get(key);
        if (t) { clearTimeout(t); lobbyDisconnectTimers.delete(key); }
      }
      clearTurnTimer(code);
      rooms.delete(code);
      activeGames.delete(code);
      console.log(`[room] EXPIRED ${code} (idle > 30 min) — total rooms: ${rooms.size}`);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ── Memory usage logging (every 60 s) ────────────────────────────────────────

setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`[mem] RSS=${Math.round(mem.rss / 1024 / 1024)}MB Heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB Rooms=${rooms.size}`);
}, 60_000);

// ── Keep-alive self-ping (every 5 min) to prevent Render spindown ─────────────

setInterval(() => {
  if (rooms.size > 0) {
    fetch(`http://localhost:${PORT}/health`).catch(() => {});
  }
}, 300_000);

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\nKnocks server → http://0.0.0.0:${PORT}  (CLIENT_URL: ${process.env.CLIENT_URL ?? 'http://localhost:3000'})\n`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  io.close(() => {
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});
