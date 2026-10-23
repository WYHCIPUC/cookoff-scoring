import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeResults, validateScore, sanitizeScores } from '../src/scoring.js';

const dims = [
  { key: 'color', name: '色', weight: 30 },
  { key: 'aroma', name: '香', weight: 30 },
  { key: 'taste', name: '味', weight: 40 },
];

function makeConfig(groups, opts = {}) {
  return {
    settings: { dims, dropExtremes: opts.dropExtremes !== false, hideScoresDuringScoring: false },
    groups,
  };
}

function score(color, aroma, taste) {
  return { scores: { color, aroma, taste } };
}

describe('validateScore', () => {
  it('accepts valid scores', () => {
    const r = validateScore({ color: 9.5, aroma: 8, taste: 10 }, dims);
    assert.equal(r.ok, true);
    assert.equal(r.errors.length, 0);
    assert.equal(r.total, +(9.5 * 30 + 8 * 30 + 10 * 40) / 100);
  });

  it('rejects NaN', () => {
    const r = validateScore({ color: NaN, aroma: 8, taste: 9 }, dims);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('色')));
  });

  it('rejects Infinity', () => {
    const r = validateScore({ color: Infinity, aroma: 8, taste: 9 }, dims);
    assert.equal(r.ok, false);
  });

  it('rejects out-of-range', () => {
    assert.equal(validateScore({ color: 0, aroma: 8, taste: 9 }, dims).ok, false);
    assert.equal(validateScore({ color: 10.1, aroma: 8, taste: 9 }, dims).ok, false);
  });

  it('rejects missing keys', () => {
    const r = validateScore({ color: 8, aroma: 8 }, dims);
    assert.equal(r.ok, false);
  });
});

describe('computeResults', () => {
  it('throws when config.groups is missing', () => {
    assert.throws(() => computeResults({}, {}), TypeError);
  });

  it('returns empty result for no scores', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1', 'a2'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1', 'b2'], members: ['y'], judge: 'y' },
    ];
    const rows = computeResults(makeConfig(groups), {});
    assert.equal(rows.length, 2);
    assert.equal(rows[0].avgTotal, null);
  });

  it('excludes self-scoring', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
    ];
    const scores = {
      g1: { 0: { g1: score(10, 10, 10), g2: score(8, 8, 8) } },
    };
    const rows = computeResults(makeConfig(groups), scores);
    const dish = rows[0].dishes[0];
    assert.equal(dish.received, 1);
    assert.equal(dish.entries[0].jid, 'g2');
  });

  it('excludes unknown judge group', () => {
    const groups = [{ id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' }];
    const scores = { g1: { 0: { gx: score(8, 8, 8) } } };
    const rows = computeResults(makeConfig(groups), scores);
    assert.equal(rows[0].dishes[0].received, 0);
  });

  it('excludes NaN/Infinity/越界 scores', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
    ];
    const scores = {
      g1: {
        0: {
          g2: { scores: { color: 8, aroma: NaN, taste: 9 } },
        },
      },
    };
    const rows = computeResults(makeConfig(groups), scores);
    assert.equal(rows[0].dishes[0].received, 0);
  });

  it('drop extremes with 4+ judges', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
      { id: 'g3', name: 'C', dishes: ['c1'], members: ['z'], judge: 'z' },
      { id: 'g4', name: 'D', dishes: ['d1'], members: ['w'], judge: 'w' },
      { id: 'g5', name: 'E', dishes: ['e1'], members: ['v'], judge: 'v' },
    ];
    // g1 收到 g2~g5 的评分：1, 5, 9, 10
    const scores = {
      g1: {
        0: {
          g2: score(1, 1, 1),
          g3: score(5, 5, 5),
          g4: score(9, 9, 9),
          g5: score(10, 10, 10),
        },
      },
    };
    const rows = computeResults(makeConfig(groups), scores);
    const dish = rows[0].dishes[0];
    assert.equal(dish.received, 4);
    assert.equal(dish.dropped.length, 2);
    assert.equal(dish.entries.length, 4);
    // 去极值后剩下 5,9 -> avg = 7
    assert.equal(dish.avgTotal, 7);
  });

  it('does not drop with 3 judges', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
      { id: 'g3', name: 'C', dishes: ['c1'], members: ['z'], judge: 'z' },
      { id: 'g4', name: 'D', dishes: ['d1'], members: ['w'], judge: 'w' },
    ];
    const scores = {
      g1: {
        0: {
          g2: score(1, 1, 1),
          g3: score(5, 5, 5),
          g4: score(10, 10, 10),
        },
      },
    };
    const rows = computeResults(makeConfig(groups), scores);
    const dish = rows[0].dishes[0];
    assert.equal(dish.dropped.length, 0);
    // avg = (1+5+10)/3 = 5.33
    assert.equal(dish.avgTotal, 5.33);
  });

  it('handles single judge', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
    ];
    const scores = { g1: { 0: { g2: score(7, 7, 7) } } };
    const rows = computeResults(makeConfig(groups), scores);
    assert.equal(rows[0].dishes[0].avgTotal, 7);
  });

  it('ranks by total and handles ties', () => {
    const groups = [
      { id: 'g1', name: 'A', dishes: ['a1'], members: ['x'], judge: 'x' },
      { id: 'g2', name: 'B', dishes: ['b1'], members: ['y'], judge: 'y' },
      { id: 'g3', name: 'C', dishes: ['c1'], members: ['z'], judge: 'z' },
    ];
    const scores = {
      g1: { 0: { g2: score(10, 10, 10), g3: score(10, 10, 10) } },
      g2: { 0: { g1: score(9, 9, 9), g3: score(9, 9, 9) } },
      g3: { 0: { g1: score(8, 8, 8), g2: score(8, 8, 8) } },
    };
    const rows = computeResults(makeConfig(groups), scores);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].rank, 2);
    assert.equal(rows[2].rank, 3);
    assert.equal(rows[0].avgTotal, 10);
    assert.equal(rows[1].avgTotal, 9);
    assert.equal(rows[2].avgTotal, 8);
  });
});

describe('sanitizeScores', () => {
  it('returns clean scores only when all dims present', () => {
    assert.deepEqual(sanitizeScores({ color: 8, aroma: 9, taste: 10 }, dims), { color: 8, aroma: 9, taste: 10 });
    assert.equal(sanitizeScores({ color: 8, aroma: 9 }, dims), null);
    assert.equal(sanitizeScores({ color: NaN, aroma: 9, taste: 10 }, dims), null);
  });
});
