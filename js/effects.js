(function (root) {
  'use strict';

  // Visual effects are temporary child elements / classes layered on top of the board,
  // so they survive ui.js re-rendering cell classes.
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function removeLater(node, ms) {
    setTimeout(() => node.remove(), ms);
  }

  function addFx(cell, className, ms, delayMs = 0) {
    const span = document.createElement('span');
    span.className = `fx ${className}`;
    span.setAttribute('aria-hidden', 'true');
    if (delayMs) span.style.animationDelay = `${delayMs}ms`;
    cell.appendChild(span);
    removeLater(span, ms + delayMs);
    return span;
  }

  function restartClass(node, className, ms) {
    node.classList.remove(className);
    void node.offsetWidth; // force reflow so the animation restarts
    node.classList.add(className);
    setTimeout(() => node.classList.remove(className), ms);
  }

  function shot(cell, result) {
    if (result === 'miss') {
      addFx(cell, 'splash', 700);
      return;
    }
    addFx(cell, 'burst', 700);
    if (!reducedMotion) restartClass(cell.closest('.board'), 'shake', 450);
  }

  function sunk(cells) {
    cells.forEach((cell, i) => addFx(cell, 'sink-flash', 900, i * 90));
  }

  function aim(cell, ms) {
    return addFx(cell, 'crosshair', ms);
  }

  function banner(wrap, text, tone) {
    const div = document.createElement('div');
    div.className = `banner ${tone}`;
    div.setAttribute('aria-hidden', 'true');
    div.textContent = text;
    wrap.appendChild(div);
    removeLater(div, 1900);
  }

  function pulse(node) {
    restartClass(node, 'pop', 400);
  }

  function confetti() {
    if (reducedMotion) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#f5b83d', '#e2463b', '#4fb37a', '#5aa9e6', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('span');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.8}s`;
      piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    removeLater(layer, 5000);
  }

  function defeat() {
    const layer = document.createElement('div');
    layer.className = 'defeat-flash';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    removeLater(layer, 1600);
  }

  root.BattleshipEffects = { shot, sunk, aim, banner, pulse, confetti, defeat, reducedMotion };
})(window);
