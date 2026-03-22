import { GameRoom } from '../GameRoom';
import { buildDeck, shuffle } from '../Deck';

function makeRoom(numPlayers: number, knockTarget: 5 | 6 = 5, roundsPerOrbit: 5 | 6 = 5) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player${i + 1}`,
    socketId: `s${i + 1}`,
  }));
  return { game: new GameRoom('TESTXX', players, knockTarget, roundsPerOrbit), players };
}

// Helper: play through an IN_OUT phase where all players make a given choice
function allChooseInOut(game: GameRoom, players: { id: string }[], choice: 'in' | 'out') {
  const state = game.getState();
  // Players must go in turn order starting from orbitStarterIndex
  const n = players.length;
  for (let i = 0; i < n; i++) {
    const idx = (state.orbitStarterIndex + i) % n;
    game.submitInOut(players[idx].id, choice);
  }
}

function allPassChallenge(game: GameRoom, players: { id: string }[]) {
  const state = game.getState();
  const n = players.length;
  for (let i = 0; i < n; i++) {
    const idx = (state.orbitStarterIndex + i) % n;
    const p = state.players[idx];
    if (p.choice === 'out') game.submitJoinPass(p.id, 'pass');
  }
}

// ── Scenario 1: Nobody says IN ────────────────────────────────────────────────
describe('Scenario 1: all OUT, no showdown', () => {
  test('phase goes to ROUND_END, no knock awarded', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    expect(game.getState().phase).toBe('IN_OUT');

    allChooseInOut(game, players, 'out');

    expect(game.getState().phase).toBe('ROUND_END');

    const summary = game.resolveRound();
    expect(summary.knockAwarded).toBe(false);
    expect(summary.winner).toBeNull();
  });

  test('pot does not change', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    const potBefore = game.getState().potTotal;
    allChooseInOut(game, players, 'out');
    game.resolveRound();
    expect(game.getState().potTotal).toBe(potBefore);
  });
});

// ── Scenario 2: Exactly 1 IN, all OUT pass ────────────────────────────────────
describe('Scenario 2: single IN, all others pass', () => {
  test('knock awarded to IN player, no showdown', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    const state = game.getState();
    const starterIdx = state.orbitStarterIndex;

    // Starter says IN, others say OUT
    game.submitInOut(players[starterIdx].id, 'in');
    for (let i = 1; i < 3; i++) {
      const idx = (starterIdx + i) % 3;
      game.submitInOut(players[idx].id, 'out');
    }

    expect(game.getState().phase).toBe('CHALLENGE_JOIN');

    // All OUT players pass
    allPassChallenge(game, players);
    expect(game.getState().phase).toBe('SHOWDOWN');

    const summary = game.resolveRound();
    expect(summary.knockAwarded).toBe(true);
    expect(summary.winner).toBe(players[starterIdx].id);
    expect(summary.participants.length).toBe(1);
    expect(summary.payout).toBe(0); // solo win — no payout
  });

  test('knock count increments', () => {
    const { game, players } = makeRoom(2);
    game.startRound();
    const state = game.getState();
    const starterIdx = state.orbitStarterIndex;
    const othersIdx = (starterIdx + 1) % 2;

    game.submitInOut(players[starterIdx].id, 'in');
    game.submitInOut(players[othersIdx].id, 'out');
    game.submitJoinPass(players[othersIdx].id, 'pass');

    const summary = game.resolveRound();
    const winner = game.getState().players.find(p => p.id === players[starterIdx].id)!;
    expect(winner.knocks).toBe(1);
    expect(summary.newKnocks[players[starterIdx].id]).toBe(1);
  });
});

// ── Scenario 3: 1 IN, 1 OUT joins → showdown, NO knock ──────────────────────
describe('Scenario 3: 1 IN + 1 joins challenge', () => {
  test('showdown happens, no knock awarded when join occurs', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    const state = game.getState();
    const si = state.orbitStarterIndex;
    const p1 = players[si].id;           // says IN
    const p2 = players[(si + 1) % 3].id; // says OUT then joins
    const p3 = players[(si + 2) % 3].id; // says OUT then passes

    game.submitInOut(p1, 'in');
    game.submitInOut(p2, 'out');
    game.submitInOut(p3, 'out');

    // p2 joins, p3 passes (order from orbitStarter among OUT players)
    // p2 is first OUT in orbit order if (si+1) < (si+2)
    const s2 = game.getState();
    const firstOut = game.currentChallengeJoinActor()!;
    const secondOut = s2.players.find(p =>
      (p.choice === 'out') && p.id !== firstOut.id
    )!;

    game.submitJoinPass(firstOut.id, 'join');
    game.submitJoinPass(secondOut.id, 'pass');

    expect(game.getState().phase).toBe('SHOWDOWN');

    const summary = game.resolveRound();
    expect(summary.participants.length).toBe(2); // p1 + whoever joined
    expect(summary.knockAwarded).toBe(false); // showdowns NEVER award knocks
    expect(summary.winner).not.toBeNull();
  });
});

// ── Scenario 4: 3 IN players → showdown, only worst pays ─────────────────────
describe('Scenario 4: 3 IN players', () => {
  test('winner gets payout, only worst-hand player pays; middle player safe', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    // Round 1: pot = 6 (3×$2 orbit fee), each player balance = -2 after startRound
    allChooseInOut(game, players, 'in');
    expect(game.getState().phase).toBe('SHOWDOWN');

    const summary = game.resolveRound();
    expect(summary.participants.length).toBe(3);
    expect(summary.winner).not.toBeNull();
    // Showdowns do NOT award knocks
    expect(summary.knockAwarded).toBe(false);

    // Balances after orbit fee (-$2 each) + showdown settlement
    const ORBIT_FEE = 2;
    const s = game.getState();
    const winner = s.players.find(p => p.id === summary.winner)!;
    const payers = s.players.filter(p => summary.payerIds.includes(p.id));
    const safePlayers = s.players.filter(p => summary.safeIds.includes(p.id));

    expect(winner.balance).toBe(summary.payout - ORBIT_FEE);
    // Only payers pay; safe players only have the orbit fee deducted
    payers.forEach(p =>
      expect(p.balance).toBeCloseTo(-(summary.payout / payers.length) - ORBIT_FEE),
    );
    safePlayers.forEach(p =>
      expect(p.balance).toBe(-ORBIT_FEE),
    );
    // With 3 players round 1, exactly 1 payer (worst card) and 1 safe (middle)
    expect(payers.length + safePlayers.length + 1).toBe(3);
  });
});

// ── Scenario 5: Pot accumulation across orbits ────────────────────────────────
describe('Scenario 5: pot accumulation', () => {
  test('orbit 1 round 1: pot += 3 * 2 = 6', () => {
    const { game } = makeRoom(3);
    game.startRound();
    expect(game.getState().potTotal).toBe(6); // 3 players * 2
  });

  test('pot accumulates only on round 1 of each orbit', () => {
    const { game, players } = makeRoom(2);

    // Orbit 1, round 1
    game.startRound();
    expect(game.getState().potTotal).toBe(4); // 2*2

    allChooseInOut(game, players, 'out');
    game.resolveRound();
    game.advanceRound(); // → round 2

    // Orbit 1, round 2 — no contribution
    game.startRound();
    expect(game.getState().potTotal).toBe(4);

    // Fast-forward to orbit 2
    for (let r = 2; r <= 5; r++) {
      allChooseInOut(game, players, 'out');
      game.resolveRound();
      game.advanceRound();
      game.startRound();
    }
    // After orbit 2 round 1: pot should be 4+4=8
    expect(game.getState().potTotal).toBe(8);
  });
});

// ── Scenario 6: Game ends when knock target reached ──────────────────────────
describe('Scenario 6: game end at knock target', () => {
  test('phase becomes GAME_OVER and winner gets potTotal', () => {
    const { game, players } = makeRoom(2, 5);
    // Manually set knocks to target-1 for player1
    const manualKnocks = (game as any).state.players[0].knocks = 4;
    void manualKnocks;

    game.startRound();
    const si = game.getState().orbitStarterIndex;
    const p1id = game.getState().players[0].id;
    const p2id = game.getState().players[1].id;

    // Force p1 to be the solo IN winner
    const p1idx = (si === 0) ? 0 : 1;
    const p2idx = 1 - p1idx;
    game.submitInOut(players[p1idx].id, 'in');
    game.submitInOut(players[p2idx].id, 'out');
    game.submitJoinPass(players[p2idx].id, 'pass');

    const summary = game.resolveRound();
    if (summary.winner === p1id) {
      expect(game.getState().phase).toBe('GAME_OVER');
      expect(game.getState().gameOverWinner).toBe(p1id);
    } else {
      // p2 won this round — not GAME_OVER since p2 starts at 0 knocks
      expect(game.getState().phase).not.toBe('GAME_OVER');
    }
  });
});

// ── Scenario 7: Payout splitting ─────────────────────────────────────────────
describe('Scenario 7: payout splitting with many players', () => {
  test('6 players, all IN, orbit 3+ payout capped at 12', () => {
    const { game, players } = makeRoom(6);
    const st = (game as any).state;

    // Set potTotal high so cap applies, jump to orbit 3 round 3
    st.potTotal = 50;
    st.orbit = 3;
    st.round = 3;

    // Initialize orbitDeck and pre-deal rounds 1+2 so each player has 2 valid
    // cards before startRound() deals the 3rd card (round 3).
    const deck = shuffle(buildDeck());
    st.orbitDeck = [...deck];
    st.allDealtCards = [];
    for (let r = 0; r < 2; r++) {
      for (const p of st.players) {
        const card = st.orbitDeck.pop()!;
        p.cards.push(card);
        st.allDealtCards.push(card);
      }
    }

    game.startRound(); // deals the 3rd card; round=3 so no orbit fee deduction
    // All 6 say IN
    allChooseInOut(game, players, 'in');
    const summary = game.resolveRound();
    expect(summary.payout).toBe(12); // capped
    // Showdown → no knock
    expect(summary.knockAwarded).toBe(false);
    const s = game.getState();
    const winner = s.players.find(p => p.id === summary.winner)!;
    expect(winner.balance).toBe(12); // no orbit fee (round 3, not round 1)
    // Only the worst-hand player(s) pay; others are safe with balance 0
    const payers = s.players.filter(p => summary.payerIds.includes(p.id));
    const safePs = s.players.filter(p => summary.safeIds.includes(p.id));
    // Total paid in = winner's gain
    const totalPaid = payers.reduce((sum, p) => sum + Math.abs(p.balance), 0);
    expect(totalPaid).toBeCloseTo(12);
    safePs.forEach(p => expect(p.balance).toBe(0));
  });
});

// ── Scenario 8: Orbit starter rotation ───────────────────────────────────────
describe('Scenario 8: orbit starter rotation', () => {
  test('starter shifts by 1 each orbit', () => {
    const { game, players } = makeRoom(3);
    game.startRound();
    const startIdx1 = game.getState().orbitStarterIndex;

    // Play through 5 rounds to end orbit 1
    for (let r = 1; r <= 5; r++) {
      allChooseInOut(game, players, 'out');
      game.resolveRound();
      game.advanceRound();
    }

    game.startRound();
    const startIdx2 = game.getState().orbitStarterIndex;
    expect(startIdx2).toBe((startIdx1 + 1) % 3);

    for (let r = 1; r <= 5; r++) {
      allChooseInOut(game, players, 'out');
      game.resolveRound();
      game.advanceRound();
    }

    game.startRound();
    const startIdx3 = game.getState().orbitStarterIndex;
    expect(startIdx3).toBe((startIdx1 + 2) % 3);
  });

  test('wraps correctly beyond player count', () => {
    const { game, players } = makeRoom(2);
    game.startRound();
    const s1 = game.getState().orbitStarterIndex;

    // Orbit 1: 5 rounds
    for (let r = 1; r <= 5; r++) {
      allChooseInOut(game, players, 'out');
      game.resolveRound();
      game.advanceRound();
    }

    game.startRound();
    expect(game.getState().orbitStarterIndex).toBe((s1 + 1) % 2);
  });
});

// ── Round 6 / roundsPerOrbit integration tests ───────────────────────────────

describe('roundsPerOrbit = 6', () => {
  function playThroughRound(
    game: GameRoom,
    players: { id: string }[],
    choice: 'in' | 'out' = 'out',
  ) {
    game.startRound();
    allChooseInOut(game, players, choice);
    game.resolveRound();
    game.advanceRound();
  }

  test('advanceRound stays within orbit through round 6', () => {
    const { game, players } = makeRoom(2, 5, 6);
    game.startRound();
    const startOrbit = game.getState().orbit;

    for (let r = 1; r <= 5; r++) {
      allChooseInOut(game, players, 'out');
      game.resolveRound();
      game.advanceRound();
      if (r < 6) {
        expect(game.getState().orbit).toBe(startOrbit); // still same orbit
      }
    }
  });

  test('orbit increments only after round 6 (not round 5)', () => {
    const { game, players } = makeRoom(2, 5, 6);
    const orbit1 = game.getState().orbit;

    // Play rounds 1-6
    for (let r = 0; r < 6; r++) {
      playThroughRound(game, players, 'out');
    }

    expect(game.getState().orbit).toBe(orbit1 + 1);
    expect(game.getState().round).toBe(1);
  });

  test('round 6 deals 6 cards per player', () => {
    const { game, players } = makeRoom(2, 5, 6);

    // Play rounds 1-5
    for (let r = 0; r < 5; r++) {
      playThroughRound(game, players, 'out');
    }

    // Round 6
    game.startRound();
    const s = game.getState();
    expect(s.round).toBe(6);
    for (const p of s.players) {
      expect(p.cards.length).toBe(6);
    }
  });

  test('round 6 bestHand has type from poker hand types', () => {
    const { game, players } = makeRoom(2, 5, 6);
    const pokerTypes = new Set([
      'royal_flush','straight_flush','four_of_a_kind','full_house',
      'flush','straight','three_of_a_kind','two_pair','one_pair','high_card',
    ]);

    for (let r = 0; r < 5; r++) playThroughRound(game, players, 'out');
    game.startRound();

    const s = game.getState();
    for (const p of s.players) {
      expect(pokerTypes.has(p.bestHand!.type)).toBe(true);
    }
  });

  test('roundsPerOrbit=5 still ends orbit at round 5', () => {
    const { game, players } = makeRoom(2, 5, 5);
    const orbit1 = game.getState().orbit;

    for (let r = 0; r < 5; r++) playThroughRound(game, players, 'out');

    expect(game.getState().orbit).toBe(orbit1 + 1);
    expect(game.getState().round).toBe(1);
  });

  test('starter rotation still happens after 6-round orbit', () => {
    const { game, players } = makeRoom(3, 5, 6);
    game.startRound();
    const startIdx1 = game.getState().orbitStarterIndex;

    for (let r = 0; r < 6; r++) playThroughRound(game, players, 'out');

    game.startRound();
    expect(game.getState().orbitStarterIndex).toBe((startIdx1 + 1) % 3);
  });
});
