import { resolveShowdown } from '../Showdown';
import { GamePlayer, Card } from '../types';
import { settleShowdown, calculatePayout } from '../Pot';

function makePlayer(id: string, cards: Card[]): GamePlayer {
  return {
    id, name: id, socketId: id,
    cards, bestHand: null, balance: 0, knocks: 0, choice: 'in',
    totalOrbitFees: 0, showdownWinnings: 0, showdownLosses: 0, potCollected: 0,
  };
}

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

// Helper: settle and return balance change map
function settle(
  players: GamePlayer[],
  round: number,
  challengeAmount: number,
): Record<string, number> {
  const all = players.flatMap((p) => p.cards);
  const result = resolveShowdown(players, round, all);
  if (!result.tie && result.winner) {
    settleShowdown(result.winner, result.payers, challengeAmount);
  }
  return Object.fromEntries(players.map((p) => [p.id, p.balance]));
}

// ── Core resolveShowdown tests ─────────────────────────────────────────────────

describe('resolveShowdown', () => {
  test('2 players — trail beats pair: payers=[loser], safePlayers=[]', () => {
    const p1 = makePlayer('p1', [c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds')]);   // trail
    const p2 = makePlayer('p2', [c(14, 'spades'), c(14, 'hearts'), c(2, 'clubs')]);    // pair
    const result = resolveShowdown([p1, p2], 3, [...p1.cards, ...p2.cards]);
    expect(result.winner!.id).toBe('p1');
    expect(result.payers.map((l) => l.id)).toEqual(['p2']);
    expect(result.safePlayers).toHaveLength(0);
  });

  test('3 players — trail/pure_seq/high_card: only worst (high_card) pays', () => {
    const p1 = makePlayer('p1', [c(8, 'spades'), c(8, 'hearts'), c(8, 'diamonds')]);   // trail
    const p2 = makePlayer('p2', [c(6, 'clubs'), c(5, 'clubs'), c(4, 'clubs')]);        // pure_seq
    const p3 = makePlayer('p3', [c(14, 'spades'), c(9, 'hearts'), c(3, 'diamonds')]);  // high_card/pair
    const all = [...p1.cards, ...p2.cards, ...p3.cards];
    const result = resolveShowdown([p1, p2, p3], 3, all);
    expect(result.winner!.id).toBe('p1');
    expect(result.payers).toHaveLength(1);   // only p3 (worst) pays
    expect(result.payers[0].id).toBe('p3');
    expect(result.safePlayers).toHaveLength(1);
    expect(result.allHands).toHaveLength(3);
  });

  test('round 4 uses muflis — worst normal hand wins', () => {
    const p1 = makePlayer('p1', [c(14, 'spades'), c(13, 'hearts'), c(12, 'diamonds'), c(11, 'clubs')]);
    const p2 = makePlayer('p2', [c(7, 'spades'), c(7, 'hearts'), c(7, 'diamonds'), c(2, 'clubs')]);
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 4, all);
    expect(result.winner!.id).toBe('p1');
  });

  test('round 5 uses normal ranking', () => {
    const p1 = makePlayer('p1', [c(9, 'spades'), c(9, 'hearts'), c(9, 'diamonds'), c(2, 'clubs'), c(3, 'hearts')]);
    const p2 = makePlayer('p2', [c(14, 'spades'), c(13, 'hearts'), c(12, 'diamonds'), c(11, 'clubs'), c(10, 'spades')]);
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 5, all);
    expect(result.winner!.id).toBe('p1');
  });

  test('6 players — only the worst (1 player) pays', () => {
    const players = [
      makePlayer('p1', [c(5, 'spades'), c(5, 'hearts'), c(5, 'diamonds')]),   // trail - wins
      makePlayer('p2', [c(14, 'spades'), c(13, 'spades'), c(12, 'spades')]),  // pure_seq
      makePlayer('p3', [c(10, 'spades'), c(9, 'hearts'), c(8, 'diamonds')]),  // seq
      makePlayer('p4', [c(2, 'spades'), c(7, 'spades'), c(11, 'spades')]),    // color
      makePlayer('p5', [c(4, 'spades'), c(4, 'hearts'), c(14, 'diamonds')]),  // pair
      makePlayer('p6', [c(14, 'spades'), c(9, 'hearts'), c(3, 'diamonds')]),  // worst
    ];
    const all = players.flatMap((p) => p.cards);
    const result = resolveShowdown(players, 3, all);
    expect(result.winner!.id).toBe('p1');
    expect(result.payers).toHaveLength(1);
    expect(result.safePlayers).toHaveLength(4);
  });

  test('round 1 — single card comparison', () => {
    const p1 = makePlayer('p1', [c(14, 'spades')]);
    const p2 = makePlayer('p2', [c(14, 'hearts')]);
    const all = [...p1.cards, ...p2.cards];
    const result = resolveShowdown([p1, p2], 1, all);
    expect(result.winner!.id).toBe('p1');
  });
});

// ── Spec tests: 6 examples ─────────────────────────────────────────────────────

describe('worst-hand-pays spec', () => {
  const AMT = 12;

  // Example 1: 3 players all different — middle player is SAFE
  test('Example 1 — 3 players all different: middle safe, worst pays full', () => {
    // A: trail → winner, B: pair of 8s → safe, C: high card → payer -$12
    const A = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs')]);   // all red/mix → no joker needed, trail
    const B = makePlayer('B', [c(8, 'hearts'), c(8, 'diamonds'), c(3, 'clubs')]);   // 2R+1B → 3C joker, real=8H+8D → trail 8s? No wait
    // Let me use all-same-color cards so no joker:
    // A: trail 7 — use 7H,7D,7C: 7H=R,7D=R,7C=B → 2R+1B → joker=7C, real=7H+7D → trail 7-7-7 ✓
    // B: pair 8s — 8H=R,8D=R,3C=B → 2R+1B → joker=3C, real=8H+8D → trail 8s! Better than pair
    // This approach gets complicated. Use fixed round that avoids joker logic:
    // Use round 5 (normal, picks best 3 from 5) to avoid joker interference
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    const pB = makePlayer('B', [c(8, 'hearts'), c(8, 'diamonds'), c(4, 'clubs'), c(2, 'hearts'), c(5, 'spades')]);
    const pC = makePlayer('C', [c(14, 'spades'), c(9, 'clubs'), c(3, 'hearts'), c(6, 'diamonds'), c(10, 'clubs')]);
    const all = [...pA.cards, ...pB.cards, ...pC.cards];
    const result = resolveShowdown([pA, pB, pC], 5, all);
    // pA picks trail 7-7-7 (winner), pB picks pair 8s, pC picks high_card (worst)
    expect(result.winner!.id).toBe('A');
    expect(result.payers.map((p) => p.id)).toContain('C');
    expect(result.safePlayers.map((p) => p.id)).toContain('B');
    // Settlement
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);        // winner +$12
    expect(pB.balance).toBe(0);          // safe — unchanged
    expect(pC.balance).toBe(-AMT);       // payer -$12
  });

  // Example 2: 3 players, two tied worst → split
  test('Example 2 — two tied worst: each pays $6', () => {
    // A: trail, B: pair of 4s, C: pair of 4s (identical)
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    // B and C: pair of 4s, same kicker — identical hand
    const pB = makePlayer('B', [c(4, 'spades'), c(4, 'clubs'), c(9, 'spades'), c(2, 'clubs'), c(6, 'hearts')]);
    const pC = makePlayer('C', [c(4, 'hearts'), c(4, 'diamonds'), c(9, 'hearts'), c(2, 'diamonds'), c(6, 'clubs')]);
    const all = [...pA.cards, ...pB.cards, ...pC.cards];
    const result = resolveShowdown([pA, pB, pC], 5, all);
    expect(result.winner!.id).toBe('A');
    expect(result.payers).toHaveLength(2);
    expect(result.payers.map((p) => p.id).sort()).toEqual(['B', 'C']);
    expect(result.safePlayers).toHaveLength(0);
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);        // winner +$12
    expect(pB.balance).toBe(-AMT / 2);  // tied worst -$6
    expect(pC.balance).toBe(-AMT / 2);  // tied worst -$6
  });

  // Example 3: 3 players, two losers different strength — weaker pays, middle safe
  test('Example 3 — 3 players, different losers: only weakest pays', () => {
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    const pB = makePlayer('B', [c(8, 'hearts'), c(8, 'diamonds'), c(4, 'clubs'), c(2, 'hearts'), c(5, 'spades')]);
    const pC = makePlayer('C', [c(4, 'hearts'), c(4, 'diamonds'), c(9, 'hearts'), c(2, 'diamonds'), c(6, 'clubs')]);
    const all = [...pA.cards, ...pB.cards, ...pC.cards];
    const result = resolveShowdown([pA, pB, pC], 5, all);
    expect(result.winner!.id).toBe('A');
    // pB has pair 8s, pC has pair 4s → pC is worst
    expect(result.payers.map((p) => p.id)).toEqual(['C']);
    expect(result.safePlayers.map((p) => p.id)).toContain('B');
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);   // winner +$12
    expect(pB.balance).toBe(0);     // safe
    expect(pC.balance).toBe(-AMT);  // payer -$12
  });

  // Example 4: 4 players, one worst
  test('Example 4 — 4 players, one worst: two middle players safe', () => {
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    // B: sequence (10-9-8)
    const pB = makePlayer('B', [c(10, 'spades'), c(9, 'hearts'), c(8, 'diamonds'), c(2, 'hearts'), c(3, 'clubs')]);
    // C: pair of Kings
    const pC = makePlayer('C', [c(13, 'hearts'), c(13, 'diamonds'), c(4, 'clubs'), c(2, 'clubs'), c(5, 'hearts')]);
    // D: high card (worst)
    const pD = makePlayer('D', [c(14, 'spades'), c(9, 'clubs'), c(3, 'hearts'), c(6, 'diamonds'), c(10, 'clubs')]);
    const all = [...pA.cards, ...pB.cards, ...pC.cards, ...pD.cards];
    const result = resolveShowdown([pA, pB, pC, pD], 5, all);
    expect(result.winner!.id).toBe('A');
    expect(result.payers.map((p) => p.id)).toContain('D');
    expect(result.payers).toHaveLength(1);
    expect(result.safePlayers).toHaveLength(2);
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);   // winner +$12
    expect(pB.balance).toBe(0);     // safe
    expect(pC.balance).toBe(0);     // safe
    expect(pD.balance).toBe(-AMT);  // payer -$12
  });

  // Example 5: 4 players, three tied worst → split three ways
  test('Example 5 — 4 players, three tied worst: each pays $4', () => {
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    // B, C, D: identical pair of 4s with same kicker
    const pB = makePlayer('B', [c(4, 'spades'), c(4, 'clubs'), c(9, 'spades'), c(2, 'clubs'), c(6, 'hearts')]);
    const pC = makePlayer('C', [c(4, 'hearts'), c(4, 'diamonds'), c(9, 'hearts'), c(2, 'diamonds'), c(6, 'clubs')]);
    // D needs different suits from B/C but same ranks to give same hand
    const pD = makePlayer('D', [c(4, 'spades'), c(4, 'hearts'), c(9, 'clubs'), c(2, 'hearts'), c(6, 'spades')]);
    const all = [...pA.cards, ...pB.cards, ...pC.cards, ...pD.cards];
    const result = resolveShowdown([pA, pB, pC, pD], 5, all);
    expect(result.winner!.id).toBe('A');
    expect(result.payers).toHaveLength(3);
    expect(result.safePlayers).toHaveLength(0);
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);        // winner +$12
    expect(pB.balance).toBe(-AMT / 3);  // tied worst -$4
    expect(pC.balance).toBe(-AMT / 3);
    expect(pD.balance).toBe(-AMT / 3);
  });

  // Example 6: 2 players — normal case
  test('Example 6 — 2 players: loser pays full amount', () => {
    const pA = makePlayer('A', [c(7, 'hearts'), c(7, 'diamonds'), c(7, 'clubs'), c(2, 'spades'), c(3, 'spades')]);
    const pB = makePlayer('B', [c(8, 'hearts'), c(8, 'diamonds'), c(4, 'clubs'), c(2, 'hearts'), c(5, 'spades')]);
    const all = [...pA.cards, ...pB.cards];
    const result = resolveShowdown([pA, pB], 5, all);
    expect(result.winner!.id).toBe('A');
    expect(result.payers.map((p) => p.id)).toEqual(['B']);
    expect(result.safePlayers).toHaveLength(0);
    settleShowdown(result.winner!, result.payers, AMT);
    expect(pA.balance).toBe(AMT);   // winner +$12
    expect(pB.balance).toBe(-AMT);  // payer -$12
  });
});
