'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Board, AIPlayer, SHIPS, SIZE, coordLabel } = require('../js/game-logic.js');

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('ships cannot overlap or go out of bounds', () => {
  const b = new Board();
  assert.ok(b.place(SHIPS[0], 0, 0, true));
  assert.ok(!b.place(SHIPS[1], 0, 2, false), 'overlap');
  assert.ok(!b.place(SHIPS[1], 0, 7, true), 'out of bounds');
  assert.ok(!b.place(SHIPS[1], 7, 0, false), 'out of bounds vertical');
  assert.ok(!b.place(SHIPS[0], 5, 5, true), 'duplicate ship');
  assert.ok(b.place(SHIPS[1], 1, 0, true));
});

test('remove frees cells and keeps other ships indexed', () => {
  const b = new Board();
  b.place(SHIPS[0], 0, 0, true);
  b.place(SHIPS[1], 2, 0, true);
  b.remove('carrier');
  assert.strictEqual(b.shipAt(0, 0), null);
  assert.strictEqual(b.shipAt(2, 3).id, 'battleship');
  assert.ok(b.place(SHIPS[0], 0, 0, true));
});

test('random placement places the full fleet without overlap', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const b = new Board();
    b.placeRandomly(SHIPS, seededRng(seed));
    assert.ok(b.isFleetComplete());
    const occupied = b.grid.flat().filter((v) => v >= 0).length;
    assert.strictEqual(occupied, SHIPS.reduce((n, s) => n + s.length, 0));
  }
});

test('shots report miss, hit, sunk, invalid and game over', () => {
  const b = new Board();
  b.place(SHIPS[4], 0, 0, true);
  assert.strictEqual(b.receiveShot(5, 5).result, 'miss');
  assert.strictEqual(b.receiveShot(5, 5).result, 'invalid');
  assert.strictEqual(b.receiveShot(-1, 0).result, 'invalid');
  assert.strictEqual(b.receiveShot(10, 0).result, 'invalid');
  assert.strictEqual(b.receiveShot(0.5, 0).result, 'invalid');
  assert.strictEqual(b.receiveShot(0, 0).result, 'hit');
  assert.ok(!b.allSunk());
  const last = b.receiveShot(0, 1);
  assert.strictEqual(last.result, 'sunk');
  assert.strictEqual(last.ship.id, 'destroyer');
  assert.ok(b.allSunk());
});

test('coordinate labels', () => {
  assert.strictEqual(coordLabel(0, 0), 'A1');
  assert.strictEqual(coordLabel(9, 9), 'J10');
});

function playGame(difficulty, seed) {
  const rng = seededRng(seed);
  const board = new Board();
  board.placeRandomly(SHIPS, rng);
  const ai = new AIPlayer(difficulty, { rng });
  const seen = new Set();
  let shots = 0;
  while (!board.allSunk()) {
    const [r, c] = ai.chooseShot();
    const key = r * SIZE + c;
    assert.ok(!seen.has(key), `${difficulty} AI repeated a shot`);
    seen.add(key);
    ai.recordResult(r, c, board.receiveShot(r, c));
    shots++;
    assert.ok(shots <= SIZE * SIZE);
  }
  return shots;
}

test('every difficulty finishes games without repeating shots; harder is stronger', () => {
  const avg = {};
  for (const d of ['easy', 'normal', 'hard']) {
    let total = 0;
    const games = 150;
    for (let seed = 1; seed <= games; seed++) total += playGame(d, seed * 7919);
    avg[d] = total / games;
  }
  console.log('average shots to win:', avg);
  assert.ok(avg.normal < avg.easy - 15, JSON.stringify(avg));
  assert.ok(avg.hard < avg.normal, JSON.stringify(avg));
});
