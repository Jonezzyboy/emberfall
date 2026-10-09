(function (root) {
  const W = 7;
  const H = 8;

  // Permanent, bought in the Forge with Embers. Endless runs only.
  const UPGRADES = [
    { id: 'moves', name: 'Deep Breath', desc: '+1 move every level', max: 5, base: 20 },
    { id: 'mult', name: 'Kindling', desc: '+0.1× base multiplier', max: 5, base: 40 },
    { id: 'spark', name: 'Spark Sense', desc: 'Spark tiles appear more often', max: 3, base: 60 },
    { id: 'reroll', name: 'Second Look', desc: 'Reroll the boon offer once per run', max: 2, base: 90 },
    { id: 'nova', name: 'Hair Trigger', desc: 'Novas forge from 1 fewer tile', max: 2, base: 120 },
    { id: 'luck', name: 'Ember Luck', desc: 'Each level starts with a free Nova', max: 2, base: 150 },
    { id: 'choice', name: 'Wider Hearth', desc: 'Boon offers show 4 choices', max: 1, base: 200 },
  ];

  // Run-only, one chosen after each cleared level. Both modes.
  const BOONS = [
    { id: 'bellows', name: 'Bellows', desc: '+2 moves every level', max: 3 },
    { id: 'hot', name: 'Hot Streak', desc: 'Each streak step adds +0.25× more', max: 3 },
    { id: 'big', name: 'Big Game', desc: 'Matching groups of 8+ score ×1.5', max: 2 },
    { id: 'fuse', name: 'Short Fuse', desc: 'Novas forge from 1 fewer tile', max: 2 },
    { id: 'wildfire', name: 'Wildfire', desc: 'Novas blast 5×5 instead of 3×3', max: 1 },
    { id: 'prism', name: 'Prismatic', desc: 'Prisms forge from 2 fewer tiles', max: 2 },
    { id: 'patience', name: 'Patience', desc: 'Clears of 2–3 no longer break your streak', max: 1 },
    { id: 'spark', name: 'Spark Rain', desc: 'Many more Spark tiles', max: 2 },
    { id: 'thrift', name: 'Thrift', desc: 'Leftover moves pay double', max: 2 },
    { id: 'ashward', name: 'Ashward', desc: 'No Ash for the rest of the run', max: 1, from: 3 },
    { id: 'narrow', name: 'Narrow Palette', desc: 'One fewer colour for the rest of the run', max: 1, from: 3 },
  ];

  const ASH_FROM = 4;
  const STREAK_CAP = 8;
  // Uncapped, big clears under Spark Rain refund more moves than they spend and a level never ends.
  const SPARK_CAP = 5;
  const BASE_MOVES = 16;

  let uid = 0;

  function noUpgrades() { return Object.fromEntries(UPGRADES.map((u) => [u.id, 0])); }
  function noBoons() { return Object.fromEntries(BOONS.map((b) => [b.id, 0])); }

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

  function rules(up, boons, level) {
    return {
      level,
      colors: Math.max(3, (level <= 2 ? 4 : 5) - boons.narrow),
      moves: BASE_MOVES + up.moves + boons.bellows * 2,
      baseMult: 1 + up.mult * 0.1,
      streakStep: 0.25 + boons.hot * 0.25,
      novaAt: Math.max(4, 6 - up.nova - boons.fuse),
      prismAt: Math.max(7, 11 - boons.prism * 2),
      novaRadius: 1 + boons.wildfire,
      bigGame: Math.pow(1.5, boons.big),
      patience: boons.patience > 0,
      sparkChance: 0.02 + up.spark * 0.015 + boons.spark * 0.04,
      ashChance: level >= ASH_FROM && !boons.ashward ? Math.min(0.1, 0.02 * (level - ASH_FROM + 1)) : 0,
      startAsh: level >= ASH_FROM && !boons.ashward ? Math.min(14, 3 * (level - ASH_FROM + 1)) : 0,
      startNovas: up.luck,
      leftover: 30 * (1 + boons.thrift),
    };
  }

  function target(level) { return Math.round(600 * Math.pow(1.5, level - 1) / 50) * 50; }
  function mult(streak, r) { return r.baseMult + streak * r.streakStep; }
  function upgradeCost(u, lvl) { return Math.round(u.base * Math.pow(2, lvl) / 5) * 5; }

  // Paid on levels cleared, not score: score grows exponentially with level and would flood the Forge.
  function runEmbers(level) {
    const cleared = level - 1;
    return 1 + Math.floor(cleared * (cleared + 3) / 4);
  }

  // Blasts pay per tile: on the matched-group curve a chained 5×5 Nova would dwarf every target.
  function points(n, m, r, special) {
    if (special) return Math.round(n * 40 * m);
    return Math.round(n * (n + 1) * 5 * m * (n >= 8 ? r.bigGame : 1));
  }

  function cell(rand, r) {
    if (r.ashChance && rand() < r.ashChance) return { c: -1, t: 'ash', k: ++uid };
    const c = { c: Math.floor(rand() * r.colors), t: 'n', k: ++uid };
    if (rand() < r.sparkChance) c.s = true;
    return c;
  }

  function hasMove(b) {
    for (let i = 0; i < b.length; i++) {
      const c = b[i];
      if (c.t === 'nova' || c.t === 'prism') return true;
      if (c.t !== 'n') continue;
      const x = i % W;
      if (x < W - 1 && b[i + 1].t === 'n' && b[i + 1].c === c.c) return true;
      if (i + W < b.length && b[i + W].t === 'n' && b[i + W].c === c.c) return true;
    }
    return false;
  }

  function freshBoard(rand, r) {
    const noAsh = Object.assign({}, r, { ashChance: 0 });
    let b;
    let tries = 0;
    do {
      b = [];
      for (let i = 0; i < W * H; i++) b.push(cell(rand, noAsh));
    } while (!hasMove(b) && ++tries < 20);
    return b;
  }

  function levelBoard(rand, r) {
    let board;
    let tries = 0;
    do {
      board = freshBoard(rand, r);
      for (let n = 0; n < r.startAsh; n++) {
        const k = Math.floor(rand() * board.length);
        board[k] = { c: -1, t: 'ash', k: ++uid };
      }
    } while (!hasMove(board) && ++tries < 20);
    for (let n = 0; n < r.startNovas;) {
      const k = Math.floor(rand() * board.length);
      if (board[k].t === 'nova') continue;
      board[k] = { c: Math.max(0, board[k].c), t: 'nova', k: ++uid };
      n++;
    }
    return board;
  }

  function neighbours(j) {
    const x = j % W, y = (j / W) | 0, out = [];
    if (x > 0) out.push(j - 1);
    if (x < W - 1) out.push(j + 1);
    if (y > 0) out.push(j - W);
    if (y < H - 1) out.push(j + W);
    return out;
  }

  function richestColour(b, taken) {
    const counts = {};
    b.forEach((o, m) => { if (o.t === 'n' && !taken.has(m)) counts[o.c] = (counts[o.c] || 0) + 1; });
    let best = -1;
    Object.keys(counts).forEach((c) => { if (best < 0 || counts[c] > counts[best]) best = Number(c); });
    return best;
  }

  // `pick` is the colour chosen for a tapped Prism.
  function computeHit(b, i, r, pick) {
    const set = new Set();
    const c = b[i];
    let special = false;
    if (!c || c.t === 'ash') return { set, special, n: 0, ash: 0, sparks: 0, specials: 0 };
    if (c.t === 'n') {
      const st = [i];
      while (st.length) {
        const j = st.pop();
        if (set.has(j)) continue;
        const d = b[j];
        if (!d || d.t !== 'n' || d.c !== c.c) continue;
        set.add(j);
        st.push(...neighbours(j));
      }
      if (set.size < 2) return { set, special, n: set.size, ash: 0, sparks: 0, specials: 0 };
    } else {
      special = true;
      // A Nova or Prism caught in another's blast fires too.
      const q = [i];
      while (q.length) {
        const k = q.pop();
        if (set.has(k)) continue;
        set.add(k);
        const e = b[k];
        if (e.t === 'nova') {
          const kx = k % W, ky = (k / W) | 0, rad = r.novaRadius;
          for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
            const nx = kx + dx, ny = ky + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) q.push(ny * W + nx);
          }
        } else if (e.t === 'prism') {
          // A Prism set off by a chain has nobody to ask, so it takes the colour that clears most.
          const colour = k === i && pick != null ? pick : richestColour(b, set);
          b.forEach((o, m) => { if (o.t === 'n' && o.c === colour) q.push(m); });
        }
      }
    }
    // Ash crumbles when anything next to it clears.
    [...set].forEach((j) => {
      neighbours(j).forEach((m) => { if (b[m].t === 'ash') set.add(m); });
    });
    let n = 0, ash = 0, sparks = 0, specials = 0;
    set.forEach((j) => {
      const d = b[j];
      if (d.t === 'ash') ash++;
      else n++;
      if (d.s) sparks++;
      if (d.t === 'nova' || d.t === 'prism') specials++;
    });
    return { set, special, n, ash, sparks, specials };
  }

  function preview(b, i, streak, r, pick) {
    const hit = computeHit(b, i, r, pick);
    const valid = hit.special || hit.n >= 2;
    let nextStreak;
    if (hit.n >= 4) nextStreak = Math.min(STREAK_CAP, streak + 1);
    else nextStreak = r.patience ? streak : 0;
    let spawn = null;
    if (valid && !hit.special) {
      if (hit.n >= r.prismAt) spawn = 'prism';
      else if (hit.n >= r.novaAt) spawn = 'nova';
    }
    const m = mult(nextStreak, r);
    return {
      hit, n: hit.n, valid, streak: nextStreak, mult: m, spawn,
      pts: valid ? points(hit.n, m, r, hit.special) + hit.ash * 25 : 0,
    };
  }

  // Returns null when the tap clears nothing.
  function tap(b, i, streak, r, rand, pick) {
    const p = preview(b, i, streak, r, pick);
    if (!p.valid) return null;
    const next = b.slice();
    p.hit.set.forEach((j) => { next[j] = null; });
    const fresh = new Set();
    if (p.spawn) {
      next[i] = { c: p.spawn === 'prism' ? -1 : b[i].c, t: p.spawn, k: ++uid };
      fresh.add(next[i].k);
    }
    for (let x = 0; x < W; x++) {
      const col = [];
      for (let y = H - 1; y >= 0; y--) if (next[y * W + x]) col.push(next[y * W + x]);
      for (let y = H - 1, idx = 0; y >= 0; y--, idx++) {
        if (idx < col.length) next[y * W + x] = col[idx];
        else {
          const nc = cell(rand, r);
          fresh.add(nc.k);
          next[y * W + x] = nc;
        }
      }
    }
    return {
      board: next, fresh, n: p.n, ash: p.hit.ash, sparks: p.hit.sparks, specials: p.hit.specials,
      special: p.hit.special, spawn: p.spawn, pts: p.pts, streak: p.streak, mult: p.mult,
    };
  }

  // Compared deep into a run so boons that only bite later, like Ashward, still count.
  function boonHelps(up, boons, id) {
    const deep = 99;
    const more = Object.assign({}, boons, { [id]: boons[id] + 1 });
    return JSON.stringify(rules(up, boons, deep)) !== JSON.stringify(rules(up, more, deep));
  }

  function boonOffer(rand, up, boons, level, count) {
    const pool = BOONS.filter((b) => boons[b.id] < b.max && (!b.from || level >= b.from) && boonHelps(up, boons, b.id));
    const out = [];
    while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  }

  function dayKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const Engine = {
    W, H, STREAK_CAP, SPARK_CAP, UPGRADES, BOONS, noUpgrades, noBoons, hash, mulberry, rules, target, mult, upgradeCost, runEmbers,
    points, hasMove, freshBoard, levelBoard, computeHit, preview, tap, boonOffer, dayKey,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(this);
