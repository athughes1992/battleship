(function () {
  'use strict';

  const { SIZE, SHIPS, Board, AIPlayer, coordLabel } = window.BattleshipLogic;
  const fx = window.BattleshipEffects;
  const sound = window.BattleshipSound;
  const AI_THINK_MS = 450;
  const AI_AIM_MS = 550;
  const RESULT_SOUND_DELAY_MS = 140;
  const GAME_OVER_DELAY_MS = 1300;
  const RECORD_KEY = 'battleship-record-v1';
  const DIFFICULTIES = ['easy', 'normal', 'hard'];

  const $ = (id) => document.getElementById(id);
  const el = {
    playerBoard: $('player-board'),
    enemyBoard: $('enemy-board'),
    enemyWrap: $('enemy-wrap'),
    playerWrap: $('player-wrap'),
    legend: $('legend'),
    muteBtn: $('mute-btn'),
    playerFleet: $('player-fleet'),
    enemyFleet: $('enemy-fleet'),
    status: $('status'),
    difficulty: $('difficulty'),
    rotateBtn: $('rotate-btn'),
    randomBtn: $('random-btn'),
    clearBtn: $('clear-btn'),
    startBtn: $('start-btn'),
    setupControls: $('setup-controls'),
    battleControls: $('battle-controls'),
    badge: $('difficulty-badge'),
    restartBtn: $('restart-btn'),
    record: $('record'),
    overlay: $('game-over'),
    overTitle: $('game-over-title'),
    overDetail: $('game-over-detail'),
    playAgainBtn: $('play-again-btn'),
  };

  const state = {
    phase: 'setup', // 'setup' | 'battle' | 'over'
    player: new Board(),
    enemy: null,
    ai: null,
    difficulty: 'normal',
    horizontal: true,
    selectedId: SHIPS[0].id,
    hover: null,
    turn: null, // 'player' | 'ai'
    lastPlayerShot: null,
    lastAiShot: null,
    stats: { shots: 0, hits: 0 },
    gameId: 0,
    timer: null,
  };

  const playerCells = buildGrid(el.playerBoard, onPlayerCell);
  const enemyCells = buildGrid(el.enemyBoard, onEnemyCell);

  function coord(r, c) {
    return coordLabel(r, c).replace(/^([A-J])/, '$1-');
  }

  function buildGrid(container, onClick) {
    const cells = [];
    container.textContent = '';
    container.appendChild(makeLabel(''));
    for (let c = 0; c < SIZE; c++) container.appendChild(makeLabel(String(c + 1)));
    for (let r = 0; r < SIZE; r++) {
      container.appendChild(makeLabel(String.fromCharCode(65 + r)));
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cell';
        btn.addEventListener('click', () => onClick(r, c));
        btn.addEventListener('mouseenter', () => setHover(container, r, c));
        btn.addEventListener('focus', () => setHover(container, r, c));
        container.appendChild(btn);
        row.push(btn);
      }
      cells.push(row);
    }
    container.addEventListener('mouseleave', () => setHover(container, null));
    return cells;
  }

  function makeLabel(text) {
    const div = document.createElement('div');
    div.className = 'label';
    div.textContent = text;
    div.setAttribute('aria-hidden', 'true');
    return div;
  }

  function setHover(container, r, c) {
    if (container !== el.playerBoard || state.phase !== 'setup') return;
    state.hover = r === null ? null : [r, c];
    render();
  }

  function setStatus(text) {
    el.status.textContent = text;
    fx.pulse(el.status);
  }

  function playShotSounds(result) {
    sound.play('fire');
    setTimeout(() => sound.play(result === 'miss' ? 'miss' : result), RESULT_SOUND_DELAY_MS);
  }

  function showShotEffects(cells, wrap, r, c, outcome, bannerText, tone) {
    fx.shot(cells[r][c], outcome.result);
    if (outcome.result === 'sunk') {
      fx.sunk(outcome.ship.cells.map(([sr, sc]) => cells[sr][sc]));
      fx.banner(wrap, bannerText, tone);
    }
  }

  function renderMute() {
    const muted = sound.isMuted();
    el.muteBtn.textContent = muted ? 'Sound: Off' : 'Sound: On';
    el.muteBtn.setAttribute('aria-pressed', String(muted));
  }

  function selectedSpec() {
    return SHIPS.find((s) => s.id === state.selectedId) || null;
  }

  function nextUnplaced() {
    const spec = SHIPS.find((s) => !state.player.ships.some((p) => p.id === s.id));
    return spec ? spec.id : null;
  }

  // ---------- Setup ----------

  function onPlayerCell(r, c) {
    if (state.phase !== 'setup') return;
    const spec = selectedSpec();
    if (spec && state.player.place(spec, r, c, state.horizontal)) {
      state.selectedId = nextUnplaced();
    } else {
      const existing = state.player.shipAt(r, c);
      if (existing) {
        state.player.remove(existing.id);
        state.selectedId = existing.id;
        state.horizontal = existing.horizontal;
      } else if (spec) {
        setStatus(`The ${spec.name} doesn't fit there. Try another spot or rotate (R).`);
        render();
        return;
      }
    }
    setupStatus();
    render();
  }

  function setupStatus() {
    const spec = selectedSpec();
    if (spec) {
      setStatus(`Place your ${spec.name} (${spec.length} spaces). Click a placed ship to move it.`);
    } else {
      setStatus('Fleet ready! Click a ship to move it, or press Start Battle.');
    }
  }

  function rotate() {
    if (state.phase !== 'setup') return;
    state.horizontal = !state.horizontal;
    render();
  }

  function randomize() {
    if (state.phase !== 'setup') return;
    state.player.placeRandomly(SHIPS);
    state.selectedId = null;
    setupStatus();
    render();
  }

  function clearBoard() {
    if (state.phase !== 'setup') return;
    state.player.reset();
    state.selectedId = SHIPS[0].id;
    setupStatus();
    render();
  }

  // ---------- Battle ----------

  function startBattle() {
    if (state.phase !== 'setup' || !state.player.isFleetComplete()) return;
    state.difficulty = DIFFICULTIES.includes(el.difficulty.value) ? el.difficulty.value : 'normal';
    state.enemy = new Board();
    state.enemy.placeRandomly(SHIPS);
    state.ai = new AIPlayer(state.difficulty);
    state.stats = { shots: 0, hits: 0 };
    state.lastPlayerShot = null;
    state.lastAiShot = null;
    state.hover = null;
    state.phase = 'battle';
    state.gameId += 1;
    state.turn = Math.random() < 0.5 ? 'player' : 'ai';
    sound.unlock();
    el.badge.textContent = `AI: ${capitalize(state.difficulty)}`;
    if (state.turn === 'player') {
      setStatus('Coin flip: you go first! Fire at Enemy Waters.');
    } else {
      setStatus('Coin flip: the AI goes first...');
      scheduleAi();
    }
    render();
  }

  function onEnemyCell(r, c) {
    if (state.phase !== 'battle' || state.turn !== 'player') return;
    const outcome = state.enemy.receiveShot(r, c);
    if (outcome.result === 'invalid') return;
    state.stats.shots += 1;
    state.lastPlayerShot = [r, c];
    const where = coord(r, c);
    let msg;
    if (outcome.result === 'miss') {
      msg = `You fired at ${where}: miss.`;
    } else {
      state.stats.hits += 1;
      msg = outcome.result === 'sunk'
        ? `You fired at ${where}: hit! You sank the enemy's ${outcome.ship.name}!`
        : `You fired at ${where}: hit! ${outcome.ship.name}.`;
    }
    playShotSounds(outcome.result);
    if (state.enemy.allSunk()) {
      render();
      showShotEffects(enemyCells, el.enemyWrap, r, c, outcome, `SUNK! Enemy ${outcome.ship.name}`, 'good');
      endGame(true);
      return;
    }
    state.turn = 'ai';
    setStatus(`${msg} Enemy is aiming...`);
    render();
    if (outcome.result !== 'miss') {
      showShotEffects(enemyCells, el.enemyWrap, r, c, outcome, `SUNK! Enemy ${outcome.ship.name}`, 'good');
    } else {
      fx.shot(enemyCells[r][c], 'miss');
    }
    scheduleAi();
  }

  function scheduleAi() {
    const id = state.gameId;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      if (id !== state.gameId || state.phase !== 'battle') return;
      const [r, c] = state.ai.chooseShot();
      fx.aim(playerCells[r][c], AI_AIM_MS);
      state.timer = setTimeout(() => {
        if (id === state.gameId && state.phase === 'battle') aiTurn(r, c);
      }, AI_AIM_MS);
    }, AI_THINK_MS);
  }

  function aiTurn(r, c) {
    const outcome = state.player.receiveShot(r, c);
    state.ai.recordResult(r, c, outcome);
    state.lastAiShot = [r, c];
    const where = coord(r, c);
    let msg;
    if (outcome.result === 'miss') msg = `Enemy fired at ${where}: miss.`;
    else if (outcome.result === 'sunk') msg = `Enemy fired at ${where}: they sank your ${outcome.ship.name}!`;
    else msg = `Enemy fired at ${where}: hit on your ${outcome.ship.name}!`;
    playShotSounds(outcome.result);
    const bannerText = outcome.ship ? `Your ${outcome.ship.name} was sunk!` : '';
    if (state.player.allSunk()) {
      render();
      showShotEffects(playerCells, el.playerWrap, r, c, outcome, bannerText, 'bad');
      endGame(false);
      return;
    }
    state.turn = 'player';
    setStatus(`${msg} Your turn.`);
    render();
    showShotEffects(playerCells, el.playerWrap, r, c, outcome, bannerText, 'bad');
  }

  function endGame(playerWon) {
    clearTimeout(state.timer);
    state.gameId += 1;
    const id = state.gameId;
    state.phase = 'over';
    state.turn = null;
    recordResult(state.difficulty, playerWon);
    const accuracy = state.stats.shots ? Math.round((100 * state.stats.hits) / state.stats.shots) : 0;
    el.overTitle.textContent = playerWon ? 'Victory!' : 'Defeat';
    el.overDetail.textContent = playerWon
      ? `You sank the entire enemy fleet in ${state.stats.shots} shots (${accuracy}% accuracy).`
      : `The AI sank your fleet. You fired ${state.stats.shots} shots (${accuracy}% accuracy). Enemy ships are now revealed.`;
    setStatus(playerWon ? 'Victory! The enemy fleet is destroyed.' : 'Defeat. Your fleet has been sunk.');
    render();
    state.timer = setTimeout(() => {
      if (id !== state.gameId) return;
      el.overlay.hidden = false;
      el.playAgainBtn.focus();
      if (playerWon) { fx.confetti(); sound.play('victory'); } else { fx.defeat(); sound.play('defeat'); }
    }, GAME_OVER_DELAY_MS);
  }

  function newGame() {
    if (state.phase === 'battle' && !window.confirm('Abandon the current battle and start over?')) return;
    clearTimeout(state.timer);
    state.gameId += 1;
    state.player = new Board();
    state.enemy = null;
    state.ai = null;
    state.phase = 'setup';
    state.turn = null;
    state.selectedId = SHIPS[0].id;
    el.overlay.hidden = true;
    setupStatus();
    render();
  }

  // ---------- Record (localStorage) ----------

  function loadRecord() {
    const empty = {};
    DIFFICULTIES.forEach((d) => { empty[d] = { wins: 0, losses: 0 }; });
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RECORD_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return empty;
      DIFFICULTIES.forEach((d) => {
        const entry = parsed[d];
        if (entry && Number.isSafeInteger(entry.wins) && Number.isSafeInteger(entry.losses) && entry.wins >= 0 && entry.losses >= 0) {
          empty[d] = { wins: entry.wins, losses: entry.losses };
        }
      });
    } catch (e) {
      // Storage unavailable or corrupted: fall back to an empty record.
    }
    return empty;
  }

  function recordResult(difficulty, won) {
    const record = loadRecord();
    if (won) record[difficulty].wins += 1; else record[difficulty].losses += 1;
    try {
      window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
    } catch (e) {
      // Ignore: record just won't persist.
    }
    renderRecord();
  }

  function renderRecord() {
    const record = loadRecord();
    el.record.textContent = DIFFICULTIES
      .map((d) => `${capitalize(d)}: ${record[d].wins}W - ${record[d].losses}L`)
      .join('   |   ');
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Rendering ----------

  function previewCells() {
    const spec = selectedSpec();
    if (state.phase !== 'setup' || !spec || !state.hover) return null;
    const [r, c] = state.hover;
    const cells = [];
    for (let i = 0; i < spec.length; i++) cells.push(state.horizontal ? [r, c + i] : [r + i, c]);
    return {
      cells: cells.filter(([row, col]) => row >= 0 && row < SIZE && col >= 0 && col < SIZE),
      valid: state.player.canPlace(spec.length, r, c, state.horizontal),
    };
  }

  function isSame(a, r, c) {
    return a !== null && a[0] === r && a[1] === c;
  }

  function render() {
    const setup = state.phase === 'setup';
    const preview = previewCells();
    const previewSet = new Set(preview ? preview.cells.map(([r, c]) => r * SIZE + c) : []);

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const btn = playerCells[r][c];
        const ship = state.player.shipAt(r, c);
        const shot = state.player.shots[r][c];
        const sunk = ship && state.player.isSunk(ship);
        btn.className = 'cell';
        if (ship) btn.classList.add('ship');
        if (shot === 'miss') btn.classList.add('miss');
        if (shot === 'hit') btn.classList.add(sunk ? 'sunk' : 'hit');
        if (previewSet.has(r * SIZE + c)) {
          btn.classList.add('preview');
          if (!preview.valid) btn.classList.add('invalid');
        }
        if (isSame(state.lastAiShot, r, c) && !setup) btn.classList.add('last-shot');
        btn.disabled = !setup;
        btn.setAttribute('aria-label', `${coord(r, c)}: ${describe(ship, shot, sunk, true)}`);
      }
    }

    el.enemyWrap.hidden = setup;
    el.legend.hidden = setup;
    el.enemyBoard.classList.toggle('active', state.phase === 'battle' && state.turn === 'player');
    if (state.enemy) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const btn = enemyCells[r][c];
          const ship = state.enemy.shipAt(r, c);
          const shot = state.enemy.shots[r][c];
          const sunk = ship && state.enemy.isSunk(ship);
          btn.className = 'cell';
          if (shot === 'miss') btn.classList.add('miss');
          if (shot === 'hit') btn.classList.add(sunk ? 'sunk' : 'hit');
          if (state.phase === 'over' && ship && !shot) btn.classList.add('revealed');
          if (isSame(state.lastPlayerShot, r, c)) btn.classList.add('last-shot');
          btn.disabled = !(state.phase === 'battle' && state.turn === 'player' && shot === null);
          const known = shot !== null || state.phase === 'over';
          btn.setAttribute('aria-label', `${coord(r, c)}: ${known ? describe(ship, shot, sunk, state.phase === 'over') : 'not fired at'}`);
        }
      }
    }

    el.playerBoard.classList.toggle('placing', setup);
    el.setupControls.hidden = !setup;
    el.battleControls.hidden = setup;
    el.difficulty.disabled = !setup;
    el.rotateBtn.textContent = `Rotate (R): ${state.horizontal ? 'Horizontal' : 'Vertical'}`;
    el.startBtn.disabled = !state.player.isFleetComplete();
    renderFleet(el.playerFleet, state.player, setup);
    if (state.enemy) renderFleet(el.enemyFleet, state.enemy, false);
  }

  function describe(ship, shot, sunk, revealShip) {
    if (shot === 'miss') return 'miss';
    if (shot === 'hit') return sunk ? `${ship.name}, sunk` : `${ship.name}, hit`;
    return ship && revealShip ? `${ship.name}` : 'water';
  }

  function renderFleet(list, board, selectable) {
    list.textContent = '';
    SHIPS.forEach((spec) => {
      const li = document.createElement('li');
      const placed = board.ships.find((s) => s.id === spec.id);
      li.textContent = `${spec.name} (${spec.length})`;
      if (selectable) {
        li.classList.add('selectable');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        if (placed) li.classList.add('placed');
        if (state.selectedId === spec.id) li.classList.add('current');
        const choose = () => {
          if (placed) {
            board.remove(spec.id);
            state.horizontal = placed.horizontal;
          }
          state.selectedId = spec.id;
          setupStatus();
          render();
        };
        li.addEventListener('click', choose);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
        });
      } else if (placed && board.isSunk(placed)) {
        li.classList.add('sunk');
        li.textContent += ' - sunk';
      }
      list.appendChild(li);
    });
  }

  // ---------- Wiring ----------

  el.muteBtn.addEventListener('click', () => {
    sound.setMuted(!sound.isMuted());
    sound.unlock();
    renderMute();
  });
  el.rotateBtn.addEventListener('click', rotate);
  el.randomBtn.addEventListener('click', randomize);
  el.clearBtn.addEventListener('click', clearBoard);
  el.startBtn.addEventListener('click', startBattle);
  el.restartBtn.addEventListener('click', newGame);
  el.playAgainBtn.addEventListener('click', newGame);
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) rotate();
    if (e.key === 'Escape' && !el.overlay.hidden) { el.overlay.hidden = true; }
  });

  setupStatus();
  renderRecord();
  renderMute();
  render();
})();
