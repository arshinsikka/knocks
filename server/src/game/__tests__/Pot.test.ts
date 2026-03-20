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
  test('rounds 1 and 2 return full pot', () => {
    expect(calculatePayout(1, 20)).toBe(20);
    expect(calculatePayout(2, 20)).toBe(20);
  });

  test('rounds 3-5 are capped at 12', () => {
    expect(calculatePayout(3, 20)).toBe(12);
    expect(calculatePayout(4, 20)).toBe(12);
    expect(calculatePayout(5, 20)).toBe(12);
  });

  test('rounds 3-5 return pot if under 12', () => {
    expect(calculatePayout(3, 8)).toBe(8);
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
