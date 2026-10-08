(function (root) {
  const W = 7;
  const H = 8;

  const UPGRADES = [
    { id: 'moves', name: 'Deep Breath', desc: '+2 moves every level', max: 5, base: 30 },
    { id: 'mult', name: 'Kindling', desc: '+0.25× base multiplier', max: 5, base: 45 },
    { id: 'nova', name: 'Short Fuse', desc: 'Novas forge from 1 fewer tile', max: 3, base: 60 },
    { id: 'luck', name: 'Ember Luck', desc: 'Each level starts with a free Nova', max: 3, base: 80 },
  ];

  let uid = 0;

  function noUpgrades() { return { moves: 0, nova: 0, mult: 0, luck: 0 }; }

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function target(level) { return Math.round(400 * Math.pow(1.4, level - 1) / 50) * 50; }
  function mult(streak, up) { return 1 + up.mult * 0.25 + streak * 0.5; }
  function novaAt(up) { return Math.max(4, 6 - up.nova); }
  function upgradeCost(u, lvl) { return u.base * Math.pow(2, lvl); }
  function colorsFor(level) { return level <= 2 ? 4 : 5; }
  function points(n, m) { return Math.round(n * (n + 1) * 5 * m); }
  function runEmbers(score, level) { return Math.floor(score / 40) + (level - 1) * 5; }

  function cell(rand, colors) { return { c: Math.floor(rand() * colors), t: 'n', k: ++uid }; }

  function hasMove(b) {
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c.t !== 'n') return true;
      const x = i % W;
      if (x < W - 1 && b[i + 1].t === 'n' && b[i + 1].c === c.c) return true;
      if (i + W < b.length && b[i + W].t === 'n' && b[i + W].c === c.c) return true;
    }
    return false;
  }

  function freshBoard(rand, colors) {
    let b;
    let tries = 0;
    do {
      b = [];
      for (let i = 0; i < W * H; i++) b.push(cell(rand, colors));
    } while (!hasMove(b) && ++tries < 20);
    return b;
  }

  function levelBoard(rand, level, up) {
    const board = freshBoard(rand, colorsFor(level));
    for (let n = 0; n < up.luck; n++) {
      const k = Math.floor(rand() * board.length);
      board[k] = { c: board[k].c, t: 'nova', k: ++uid };
    }
    return board;
  }

  function computeHit(b, i) {
    const set = new Set();
    const c = b[i];
    if (!c) return { set, special: false };
    if (c.t === 'n') {
      const st = [i];
      while (st.length) {
        const j = st.pop();
        if (set.has(j)) continue;
        const d = b[j];
        if (!d || d.t !== 'n' || d.c !== c.c) continue;
        set.add(j);
        const x = j % W, y = (j / W) | 0;
        if (x > 0) st.push(j - 1);
        if (x < W - 1) st.push(j + 1);
        if (y > 0) st.push(j - W);
        if (y < H - 1) st.push(j + W);
      }
      return { set, special: false };
    }
    // A Nova or Prism caught in another's blast fires too.
    const q = [i];
    while (q.length) {
      const k = q.pop();
      if (set.has(k)) continue;
      set.add(k);
      const e = b[k];
      if (e.t === 'nova') {
        const kx = k % W, ky = (k / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = kx + dx, ny = ky + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) q.push(ny * W + nx);
        }
      } else if (e.t === 'prism') {
        b.forEach((o, m) => { if (o.t === 'n' && o.c === e.c) q.push(m); });
      }
    }
    return { set, special: true };
  }

  function preview(b, i, streak, up) {
    const hit = computeHit(b, i);
    const n = hit.set.size;
    const valid = hit.special || n >= 2;
    const nextStreak = n >= 4 ? streak + 1 : 0;
    let spawn = null;
    if (valid && !hit.special) {
      if (n >= 11) spawn = 'prism';
      else if (n >= novaAt(up)) spawn = 'nova';
    }
    return { hit, n, valid, streak: nextStreak, mult: mult(nextStreak, up), pts: valid ? points(n, mult(nextStreak, up)) : 0, spawn };
  }

  // Returns null when the tap clears nothing.
  function tap(b, i, opts) {
    const p = preview(b, i, opts.streak, opts.up);
    if (!p.valid) return null;
    const next = b.slice();
    p.hit.set.forEach((j) => { next[j] = null; });
    const fresh = new Set();
    if (p.spawn) {
      next[i] = { c: b[i].c, t: p.spawn, k: ++uid };
      fresh.add(next[i].k);
    }
    for (let x = 0; x < W; x++) {
      const col = [];
      for (let y = H - 1; y >= 0; y--) if (next[y * W + x]) col.push(next[y * W + x]);
      for (let y = H - 1, idx = 0; y >= 0; y--, idx++) {
        if (idx < col.length) next[y * W + x] = col[idx];
        else {
          const nc = cell(opts.rand, opts.colors);
          fresh.add(nc.k);
          next[y * W + x] = nc;
        }
      }
    }
    return { board: next, fresh, n: p.n, special: p.hit.special, spawn: p.spawn, pts: p.pts, streak: p.streak, mult: p.mult };
  }

  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const Engine = {
    W, H, UPGRADES, noUpgrades, hash, mulberry, target, mult, novaAt, upgradeCost, colorsFor, points, runEmbers,
    hasMove, freshBoard, levelBoard, computeHit, preview, tap, dayKey,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(this);
