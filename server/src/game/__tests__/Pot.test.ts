import { addOrbitContribution, calculatePayout, settleShowdown } from '../Pot';
import { GamePlayer } from '../types';

function makePlayer(id: string): GamePlayer {
  return {
    id,
    name: id,
    socketId: id,
    cards: [],
    bestHand: null,
    balance: 0,
    knocks: 0,
    choice: null,
    totalOrbitFees: 0,
    showdownWinnings: 0,
    showdownLosses: 0,
    potCollected: 0,
  };
}

describe('addOrbitContribution', () => {
  test('adds numPlayers * 2 to pot', () => {
    expect(addOrbitContribution(0, 4)).toBe(8);
    expect(addOrbitContribution(8, 4)).toBe(16);
    expect(addOrbitContribution(0, 6)).toBe(12);
  });
});

describe('calculatePayout', () => {
  test('orbits 1 and 2 return full pot regardless of limit', () => {
    expect(calculatePayout(1, 20, 12)).toBe(20);
    expect(calculatePayout(2, 20, 12)).toBe(20);
    expect(calculatePayout(1, 20, 'none')).toBe(20);
    expect(calculatePayout(2, 20, 'none')).toBe(20);
  });

  test('orbit 3+ default limit (12) caps at 12', () => {
    expect(calculatePayout(3, 20)).toBe(12);
    expect(calculatePayout(4, 20)).toBe(12);
    expect(calculatePayout(10, 20)).toBe(12);
  });

  test('orbit 3+ returns pot if under limit', () => {
    expect(calculatePayout(3, 8, 12)).toBe(8);
    expect(calculatePayout(3, 8, 18)).toBe(8);
  });

  test('orbit 3+ limit 18 caps at 18', () => {
    expect(calculatePayout(3, 30, 18)).toBe(18);
    expect(calculatePayout(3, 15, 18)).toBe(15);
  });

  test('orbit 3+ limit 24 caps at 24', () => {
    expect(calculatePayout(3, 50, 24)).toBe(24);
    expect(calculatePayout(3, 20, 24)).toBe(20);
  });

  test('orbit 3+ with none returns full pot', () => {
    expect(calculatePayout(3, 50, 'none')).toBe(50);
    expect(calculatePayout(5, 100, 'none')).toBe(100);
  });
});

describe('settleShowdown', () => {
  test('single loser: loser loses payout, winner gains payout', () => {
    const winner = makePlayer('w');
    const loser = makePlayer('l');
    settleShowdown(winner, [loser], 12);
    expect(winner.balance).toBe(12);
    expect(loser.balance).toBe(-12);
  });

  test('two losers: payout split equally', () => {
    const winner = makePlayer('w');
    const l1 = makePlayer('l1');
    const l2 = makePlayer('l2');
    settleShowdown(winner, [l1, l2], 12);
    expect(winner.balance).toBe(12);
    expect(l1.balance).toBe(-6);
    expect(l2.balance).toBe(-6);
  });
});
