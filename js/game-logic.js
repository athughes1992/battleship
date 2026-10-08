(function (root) {
  'use strict';

  const SIZE = 10;
  const SHIPS = Object.freeze([
    Object.freeze({ id: 'carrier', name: 'Carrier', length: 5 }),
    Object.freeze({ id: 'battleship', name: 'Battleship', length: 4 }),
    Object.freeze({ id: 'cruiser', name: 'Cruiser', length: 3 }),
    Object.freeze({ id: 'submarine', name: 'Submarine', length: 3 }),
    Object.freeze({ id: 'destroyer', name: 'Destroyer', length: 2 }),
  ]);
  const DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function makeGrid(size, value) {
    return Array.from({ length: size }, () => Array(size).fill(value));
  }

  function shipCells(length, row, col, horizontal) {
    const cells = [];
    for (let i = 0; i < length; i++) {
      cells.push(horizontal ? [row, col + i] : [row + i, col]);
    }
    return cells;
  }

  function coordLabel(row, col) {
    return String.fromCharCode(65 + row) + (col + 1);
  }

  function randomInt(rng, n) {
    return Math.floor(rng() * n);
  }

  function pickRandom(rng, items) {
    return items[randomInt(rng, items.length)];
  }

  class Board {
    constructor(size = SIZE) {
      this.size = size;
      this.reset();
    }

    reset() {
      this.grid = makeGrid(this.size, -1);
      this.shots = makeGrid(this.size, null);
      this.ships = [];
    }

    inBounds(row, col) {
      return Number.isInteger(row) && Number.isInteger(col) &&
        row >= 0 && col >= 0 && row < this.size && col < this.size;
    }

    canPlace(length, row, col, horizontal) {
      return shipCells(length, row, col, horizontal)
        .every(([r, c]) => this.inBounds(r, c) && this.grid[r][c] === -1);
    }

    place(spec, row, col, horizontal) {
      if (this.ships.some((s) => s.id === spec.id)) return false;
      if (!this.canPlace(spec.length, row, col, horizontal)) return false;
      const cells = shipCells(spec.length, row, col, horizontal);
      const index = this.ships.length;
      this.ships.push({ id: spec.id, name: spec.name, length: spec.length, cells, hits: 0, horizontal });
      cells.forEach(([r, c]) => { this.grid[r][c] = index; });
      return true;
    }

    remove(shipId) {
      const ship = this.ships.find((s) => s.id === shipId);
      if (!ship) return null;
      this.ships = this.ships.filter((s) => s !== ship);
      this.grid = makeGrid(this.size, -1);
      this.ships.forEach((s, i) => s.cells.forEach(([r, c]) => { this.grid[r][c] = i; }));
      return ship;
    }

    shipAt(row, col) {
      if (!this.inBounds(row, col)) return null;
      const index = this.grid[row][col];
      return index >= 0 ? this.ships[index] : null;
    }

    placeRandomly(specs = SHIPS, rng = Math.random) {
      for (let attempt = 0; attempt < 100; attempt++) {
        this.reset();
        const ok = specs.every((spec) => {
          for (let tries = 0; tries < 500; tries++) {
            const horizontal = rng() < 0.5;
            const row = randomInt(rng, this.size);
            const col = randomInt(rng, this.size);
            if (this.place(spec, row, col, horizontal)) return true;
          }
          return false;
        });
        if (ok) return;
      }
      throw new Error('Unable to place ships randomly');
    }

    isFleetComplete(specs = SHIPS) {
      return specs.every((spec) => this.ships.some((s) => s.id === spec.id));
    }

    receiveShot(row, col) {
      if (!this.inBounds(row, col) || this.shots[row][col] !== null) {
        return { result: 'invalid' };
      }
      const ship = this.shipAt(row, col);
      if (!ship) {
        this.shots[row][col] = 'miss';
        return { result: 'miss' };
      }
      this.shots[row][col] = 'hit';
      ship.hits += 1;
      return { result: ship.hits === ship.length ? 'sunk' : 'hit', ship };
    }

    isSunk(ship) {
      return ship.hits >= ship.length;
    }

    allSunk() {
      return this.ships.length > 0 && this.ships.every((s) => this.isSunk(s));
    }
  }

  // The AI only learns what a human would: hit/miss for each shot, and which ship was
  // sunk (its cells are revealed to both players, as the UI does for the human).
  class AIPlayer {
    constructor(difficulty = 'normal', { size = SIZE, ships = SHIPS, rng = Math.random } = {}) {
      this.difficulty = difficulty;
      this.size = size;
      this.rng = rng;
      this.knowledge = makeGrid(size, null); // null | 'miss' | 'hit' | 'sunk'
      this.remaining = ships.map((s) => s.length);
    }

    inBounds(row, col) {
      return row >= 0 && col >= 0 && row < this.size && col < this.size;
    }

    untried() {
      const cells = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.knowledge[r][c] === null) cells.push([r, c]);
        }
      }
      return cells;
    }

    unresolvedHits() {
      const cells = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.knowledge[r][c] === 'hit') cells.push([r, c]);
        }
      }
      return cells;
    }

    isOpen(row, col) {
      return this.inBounds(row, col) && this.knowledge[row][col] === null;
    }

    chooseShot() {
      if (this.difficulty === 'easy') return this.randomShot();
      if (this.difficulty === 'hard') return this.densityShot();
      return this.huntTargetShot();
    }

    randomShot() {
      return pickRandom(this.rng, this.untried());
    }

    huntTargetShot() {
      const hits = this.unresolvedHits();
      if (hits.length > 0) {
        const inLine = [];
        const adjacent = [];
        for (const [r, c] of hits) {
          for (const [dr, dc] of DIRECTIONS) {
            if (this.isOpen(r + dr, c + dc)) {
              adjacent.push([r + dr, c + dc]);
              const br = r - dr;
              const bc = c - dc;
              if (this.inBounds(br, bc) && this.knowledge[br][bc] === 'hit') {
                inLine.push([r + dr, c + dc]);
              }
            }
          }
        }
        if (inLine.length > 0) return pickRandom(this.rng, inLine);
        if (adjacent.length > 0) return pickRandom(this.rng, adjacent);
      }
      const minLength = Math.min(...this.remaining);
      const parity = this.untried().filter(([r, c]) => (r + c) % minLength === 0);
      return parity.length > 0 ? pickRandom(this.rng, parity) : this.randomShot();
    }

    densityMap() {
      const scores = makeGrid(this.size, 0);
      const targeting = this.unresolvedHits().length > 0;
      for (const length of this.remaining) {
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            for (const horizontal of [true, false]) {
              const cells = shipCells(length, r, c, horizontal);
              let valid = true;
              let hitCount = 0;
              for (const [cr, cc] of cells) {
                if (!this.inBounds(cr, cc)) { valid = false; break; }
                const k = this.knowledge[cr][cc];
                if (k === 'miss' || k === 'sunk') { valid = false; break; }
                if (k === 'hit') hitCount += 1;
              }
              if (!valid || (targeting && hitCount === 0)) continue;
              const weight = targeting ? Math.pow(hitCount + 1, 3) : 1;
              for (const [cr, cc] of cells) {
                if (this.knowledge[cr][cc] === null) scores[cr][cc] += weight;
              }
            }
          }
        }
      }
      return scores;
    }

    densityShot() {
      const scores = this.densityMap();
      let best = -1;
      let candidates = [];
      for (const [r, c] of this.untried()) {
        const s = scores[r][c];
        if (s > best) { best = s; candidates = [[r, c]]; } else if (s === best) candidates.push([r, c]);
      }
      return best > 0 ? pickRandom(this.rng, candidates) : this.huntTargetShot();
    }

    recordResult(row, col, outcome) {
      if (outcome.result === 'invalid') return;
      this.knowledge[row][col] = outcome.result === 'miss' ? 'miss' : 'hit';
      if (outcome.result === 'sunk' && outcome.ship) {
        outcome.ship.cells.forEach(([r, c]) => { this.knowledge[r][c] = 'sunk'; });
        const i = this.remaining.indexOf(outcome.ship.length);
        if (i >= 0) this.remaining.splice(i, 1);
      }
    }
  }

  const api = { SIZE, SHIPS, Board, AIPlayer, shipCells, coordLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BattleshipLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
