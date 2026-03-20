import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './game/GameRoom';
import { calculatePayout } from './game/Pot';
import { Card, ClassifiedHand, GamePlayer } from './game/types';

// ── Lobby types ───────────────────────────────────────────────────────────────

interface LobbyPlayer {
  id: string;   // = socket.id
  name: string;
}

interface RoomState {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  knockTarget: 5 | 6;
  gameStarted: boolean;
  lastActivity: number; // Date.now() ms
}

// ── Maps ─────────────────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>();
const activeGames = new Map<string, GameRoom>(); // roomCode → GameRoom

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
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

// ── Game event emitters ───────────────────────────────────────────────────────

function emitRoundStart(io: Server, game: GameRoom, roomCode: string) {
  const dealt = game.startRound();         // advances phase → IN_OUT
  const s = game.getState();
  const payout = calculatePayout(s.round, s.potTotal);
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
    io.to(pl.socketId).emit('cards_dealt', { round: s.round, cards });
  }

  // First actor
  const actor = game.currentActor();
  if (actor) {
    io.to(actor.socketId).emit('your_turn', { phase: 'in_out' });
    io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'in_out' });
  }
}

function resolveAndEmit(io: Server, game: GameRoom, roomCode: string) {
  const summary = game.resolveRound();
  const s = game.getState();

  const participants = s.players.filter(
    (p) => p.choice === 'in' || p.choice === 'join',
  );
  const nonParticipants = s.players.filter(
    (p) => p.choice !== 'in' && p.choice !== 'join',
  );

  if (participants.length >= 2) {
    const winnerPlayer = s.players.find((p) => p.id === summary.winner)!;
    const losers = participants.filter((p) => p.id !== summary.winner);
    const eachLoserPays = losers.length > 0 ? summary.payout / losers.length : 0;

    // showdown_reveal → participants only
    const allHandsMap = new Map(
      participants.map((p) => [p.id, p.bestHand as ClassifiedHand]),
    );

    for (const p of participants) {
      io.to(p.socketId).emit('showdown_reveal', {
        participants: participants.map((pp) => ({
          name: pp.name,
          cards: pp.cards,
          bestHand: allHandsMap.get(pp.id),
          handType: allHandsMap.get(pp.id)?.type,
        })),
        winner: winnerPlayer.name,
        payout: summary.payout,
        eachLoserPays,
      });
    }

    // showdown_public → non-participants (no cards)
    for (const p of nonParticipants) {
      io.to(p.socketId).emit('showdown_public', {
        participantNames: participants.map((pp) => pp.name),
        winnerName: winnerPlayer.name,
        payout: summary.payout,
        eachLoserPays,
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
    io.to(roomCode).emit('game_over', {
      winnerName: winner.name,
      winnerKnocks: winner.knocks,
      potTotal: s.potTotal,
      finalBalances: s.players.map(({ name, balance, knocks }) => ({
        name,
        balance,
        knocks,
      })),
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
    resolveAndEmit(io, game, roomCode);
  } else if (s.phase === 'SHOWDOWN') {
    // All players said IN — skip challenge window
    resolveAndEmit(io, game, roomCode);
  } else if (s.phase === 'CHALLENGE_JOIN') {
    const actor = game.currentChallengeJoinActor();
    if (actor) {
      io.to(actor.socketId).emit('your_turn', { phase: 'challenge_join' });
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'challenge_join' });
    }
  } else {
    // Still IN_OUT
    const actor = game.currentActor();
    if (actor) {
      io.to(actor.socketId).emit('your_turn', { phase: 'in_out' });
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'in_out' });
    }
  }
}

function afterChallengeJoin(io: Server, game: GameRoom, roomCode: string) {
  const s = game.getState();

  if (s.phase === 'SHOWDOWN') {
    resolveAndEmit(io, game, roomCode);
  } else {
    // Still CHALLENGE_JOIN — more OUT players to answer
    const actor = game.currentChallengeJoinActor();
    if (actor) {
      io.to(actor.socketId).emit('your_turn', { phase: 'challenge_join' });
      io.to(roomCode).emit('waiting_for', { playerName: actor.name, phase: 'challenge_join' });
    }
  }
}

// ── Express + Socket.IO ───────────────────────────────────────────────────────

const PORT       = process.env.PORT       ? Number(process.env.PORT) : 3001;
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

io.on('connection', (socket: Socket) => {
  console.log(`[+] ${socket.id}`);

  // ── LOBBY: create_room ──────────────────────────────────────────────────────
  socket.on(
    'create_room',
    ({ playerName, knockTarget }: { playerName: string; knockTarget: 5 | 6 }) => {
      if (!playerName?.trim()) { socket.emit('error', { message: 'Name required' }); return; }

      const code = uniqueCode();
      rooms.set(code, {
        code,
        hostId: socket.id,
        players: [{ id: socket.id, name: playerName.trim() }],
        knockTarget,
        gameStarted: false,
        lastActivity: Date.now(),
      });
      socket.join(code);

      socket.emit('room_created', {
        roomCode: code,
        knockTarget,
        players: rooms.get(code)!.players,
        hostId: socket.id,
      });

      console.log(`Room ${code} created by "${playerName}"`);
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
        players: room.players,
        hostId: room.hostId,
      });

      io.to(room.code).emit('player_joined', {
        players: room.players,
        newPlayer: player,
        hostId: room.hostId,
      });

      console.log(`"${playerName}" joined ${room.code}`);
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
    );
    activeGames.set(roomCode, game);

    io.to(roomCode).emit('game_started', {
      players: room.players,
      knockTarget: room.knockTarget,
    });

    console.log(`Game started in ${roomCode}`);

    // Small delay then deal round 1
    setTimeout(() => emitRoundStart(io, game, roomCode), 800);
  });

  // ── GAME: action_in ─────────────────────────────────────────────────────────
  socket.on('action_in', () => {
    const found = findGameBySocket(socket.id);
    if (!found) return;
    const [code, game, player] = found;
    if (game.getState().phase !== 'IN_OUT') return;

    const ok = game.submitInOut(player.id, 'in');
    if (!ok) return;

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'in' });
    afterInOut(io, game, code);
  });

  // ── GAME: action_out ────────────────────────────────────────────────────────
  socket.on('action_out', () => {
    const found = findGameBySocket(socket.id);
    if (!found) return;
    const [code, game, player] = found;
    if (game.getState().phase !== 'IN_OUT') return;

    const ok = game.submitInOut(player.id, 'out');
    if (!ok) return;

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'out' });
    afterInOut(io, game, code);
  });

  // ── GAME: action_join ───────────────────────────────────────────────────────
  socket.on('action_join', () => {
    const found = findGameBySocket(socket.id);
    if (!found) return;
    const [code, game, player] = found;
    if (game.getState().phase !== 'CHALLENGE_JOIN') return;

    const ok = game.submitJoinPass(player.id, 'join');
    if (!ok) return;

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'join' });
    afterChallengeJoin(io, game, code);
  });

  // ── GAME: action_pass ───────────────────────────────────────────────────────
  socket.on('action_pass', () => {
    const found = findGameBySocket(socket.id);
    if (!found) return;
    const [code, game, player] = found;
    if (game.getState().phase !== 'CHALLENGE_JOIN') return;

    const ok = game.submitJoinPass(player.id, 'pass');
    if (!ok) return;

    touchRoom(code);
    io.to(code).emit('player_acted', { playerName: player.name, action: 'pass' });
    afterChallengeJoin(io, game, code);
  });

  // ── GAME: rejoin_game (reconnect with new socketId) ──────────────────────────
  socket.on('rejoin_game', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const game = activeGames.get(roomCode?.toUpperCase());
    if (!game) { socket.emit('error', { message: 'Game not found' }); return; }

    const s = game.getState();
    const player = s.players.find((p) => p.name === playerName);
    if (!player) { socket.emit('error', { message: 'Player not in game' }); return; }

    // Re-associate socket
    (player as GamePlayer).socketId = socket.id;
    socket.join(roomCode);

    const room = rooms.get(roomCode);
    if (room) {
      const lp = room.players.find((p) => p.name === playerName);
      if (lp) lp.id = socket.id;
      room.lastActivity = Date.now();
    }

    socket.emit('state_snapshot', {
      orbit: s.orbit,
      round: s.round,
      potTotal: s.potTotal,
      phase: s.phase,
      knockTarget: s.knockTarget,
      players: publicPlayers(game),
      myCards: player.cards,
    });

    console.log(`"${playerName}" rejoined ${roomCode}`);
  });

  // ── GAME: request_state (reconnect) ─────────────────────────────────────────
  socket.on('request_state', ({ roomCode }: { roomCode: string }) => {
    const game = activeGames.get(roomCode);
    if (!game) return;
    const s = game.getState();
    const me = s.players.find((p) => p.socketId === socket.id);
    if (!me) return;

    socket.emit('state_snapshot', {
      orbit: s.orbit,
      round: s.round,
      potTotal: s.potTotal,
      phase: s.phase,
      knockTarget: s.knockTarget,
      players: publicPlayers(game),
      myCards: me.cards,
    });
  });

  // ── disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);

    // Remove from lobby
    for (const [code, room] of rooms) {
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx === -1) continue;

      const [removed] = room.players.splice(idx, 1);

      if (room.players.length === 0) {
        rooms.delete(code);
      } else {
        if (room.hostId === socket.id) room.hostId = room.players[0].id;
        io.to(code).emit('player_left', {
          players: room.players,
          removedPlayer: removed,
          hostId: room.hostId,
        });
      }
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
      rooms.delete(code);
      activeGames.delete(code);
      console.log(`Room ${code} expired (idle > 30 min)`);
    }
  }
}, CLEANUP_INTERVAL_MS);

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\nKnocks server → http://0.0.0.0:${PORT}  (CLIENT_URL: ${CLIENT_URL})\n`);
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
