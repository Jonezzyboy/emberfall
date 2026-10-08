(function () {
  const E = Engine;
  const SAVE_KEY = 'emberfall-v1';
  // Read by the Daily Shelf landing page, which shares this origin.
  const SHELF_KEY = 'dailies-v1';
  const STATS_KEY = 'emberfall-stats-v1';
  const START_MOVES = 16;
  const HEARTH_MAX = 20;

  const COLORS = [
    { hex: '#f2b33d', name: 'Amber', d: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z' },
    { hex: '#e4572e', name: 'Coral', d: 'M12 4L20.5 19H3.5Z' },
    { hex: '#1fa392', name: 'Teal', d: 'M5.5 5.5H18.5V18.5H5.5Z' },
    { hex: '#7b6cf6', name: 'Violet', d: 'M12 3L21 12L12 21L3 12Z' },
    { hex: '#e9e4d8', name: 'Bone', d: 'M12 3L20 7.5V16.5L12 21L4 16.5V7.5Z' },
  ];
  const STAR = 'M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4Z';
  const RING = 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18ZM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z';

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const round2 = (n) => Math.round(n * 100) / 100;

  function loadSave() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* no storage */ }
    const save = Object.assign({
      embers: 0, best: 0, bestLevel: 0, runs: 0,
      daily: { date: '', score: 0, level: 0 }, dayStreak: 0, lastDay: '',
      hearth: { date: '', n: 0 },
    }, s || {});
    save.up = Object.assign(E.noUpgrades(), (s && s.up) || {});
    return save;
  }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* no storage */ }
  }

  function markShelf() {
    try {
      const shelf = JSON.parse(localStorage.getItem(SHELF_KEY)) || {};
      shelf.emberfall = E.dayKey(0);
      localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
      localStorage.setItem(STATS_KEY, JSON.stringify({ streak: save.dayStreak }));
    } catch (e) { /* no storage */ }
  }

  const save = loadSave();
  let run = null;
  let rand = Math.random;
  let hover = -1;
  let result = null;
  let endTimer = 0;
  let toastTimer = 0;

  // ---------- screens ----------

  function show(name) {
    clearTimeout(endTimer);
    for (const id of ['home', 'play', 'shop', 'over']) $(id).hidden = id !== name;
    if (name === 'home') renderHome();
    if (name === 'shop') renderShop();
    window.scrollTo(0, 0);
  }

  function toast(msg) {
    const t = $('toast');
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function renderEmbers() {
    document.querySelectorAll('[data-embers]').forEach((el) => { el.textContent = fmt(save.embers); });
  }

  function renderHome() {
    const today = E.dayKey(0);
    const done = save.daily.date === today;
    renderEmbers();
    $('dailyLabel').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    $('dailyStatus').textContent = done ? `Today: ${fmt(save.daily.score)} · Lv ${save.daily.level}` : 'Not played yet today';
    $('playDaily').textContent = done ? 'Beat your score' : "Play today's board";
    const alive = save.dayStreak > 0 && (save.lastDay === today || save.lastDay === E.dayKey(-1));
    $('streakText').textContent = alive ? `${save.dayStreak}-day streak` : 'Start a streak';
    $('bestText').textContent = save.best > 0 ? `Best ${fmt(save.best)} · Lv ${save.bestLevel}` : 'No runs yet';

    const n = save.hearth.date === today ? save.hearth.n : 0;
    const full = n >= HEARTH_MAX;
    $('hearth').disabled = full;
    $('hearthCount').textContent = `${n}/${HEARTH_MAX}`;
    $('hearthText').textContent = full ? 'Banked for today. Back tomorrow.' : 'Tap for +1 Ember, a few times a day';
  }

  function renderShop() {
    renderEmbers();
    const list = $('upgrades');
    list.replaceChildren();
    for (const u of E.UPGRADES) {
      const lvl = save.up[u.id];
      const maxed = lvl >= u.max;
      const cost = E.upgradeCost(u, lvl);

      const row = document.createElement('div');
      row.className = 'upgrade';
      const body = document.createElement('div');
      body.className = 'upgrade-body';
      const name = document.createElement('div');
      name.className = 'upgrade-name';
      name.textContent = u.name;
      const desc = document.createElement('div');
      desc.className = 'muted small';
      desc.textContent = u.desc;
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < u.max; i++) {
        const p = document.createElement('span');
        if (i < lvl) p.className = 'on';
        pips.append(p);
      }
      body.append(name, desc, pips);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn num';
      btn.textContent = maxed ? 'Maxed' : fmt(cost);
      btn.disabled = maxed || save.embers < cost;
      btn.setAttribute('aria-label', maxed ? `${u.name} maxed` : `Buy ${u.name} for ${cost} embers`);
      btn.addEventListener('click', () => buy(u));

      row.append(body, btn);
      list.append(row);
    }
  }

  // ---------- board ----------

  const boardEl = $('board');
  const tiles = [];
  for (let i = 0; i < E.W * E.H; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd"/></svg>';
    b.addEventListener('click', () => tap(i));
    b.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') setHover(i); });
    b.addEventListener('focus', () => setHover(i));
    boardEl.append(b);
    tiles.push(b);
  }
  boardEl.addEventListener('pointerleave', () => setHover(-1));

  function setHover(i) {
    if (hover === i) return;
    hover = i;
    renderBoard(null);
  }

  function renderBoard(fresh) {
    if (!run) return;
    const p = hover >= 0 ? E.preview(run.board, hover, run.streak, run.up) : null;
    const hl = p && p.valid ? p.hit.set : null;
    boardEl.classList.toggle('focus', !!hl);

    run.board.forEach((c, i) => {
      const el = tiles[i];
      const col = COLORS[c.c];
      let bg, d, glyph, label;
      if (c.t === 'nova') { bg = '#fff1d0'; d = STAR; glyph = '#e4572e'; label = 'Nova'; }
      else if (c.t === 'prism') { bg = '#2a2240'; d = RING; glyph = col.hex; label = `${col.name} prism`; }
      else { bg = col.hex; d = col.d; glyph = 'rgba(20,16,30,.5)'; label = col.name; }
      el.style.background = bg;
      const path = el.firstChild.firstChild;
      path.setAttribute('d', d);
      path.setAttribute('fill', glyph);
      el.setAttribute('aria-label', label);
      el.classList.toggle('hl', !!(hl && hl.has(i)));
      if (fresh && fresh.has(c.k)) {
        el.classList.remove('drop');
        void el.offsetWidth;
        el.classList.add('drop');
      }
    });

    const pv = $('preview');
    pv.className = 'preview';
    if (p && p.valid) {
      let extra = '';
      if (p.spawn === 'prism') extra = ' · forges a Prism';
      else if (p.spawn === 'nova') extra = ' · forges a Nova';
      else if (!p.hit.special && p.n < 4 && run.streak > 0) extra = ' · breaks streak';
      pv.textContent = `${p.hit.special ? 'Detonates ' : ''}${p.n} tiles → +${fmt(p.pts)}${extra}`;
      pv.classList.add('on');
    } else if (p) {
      pv.textContent = 'Lonely tile — needs a matching neighbour';
      pv.classList.add('off');
    } else {
      pv.textContent = 'Clear 4+ at once to build a streak';
    }
  }

  function renderHud() {
    $('modeLabel').textContent = run.mode === 'daily' ? 'Daily board' : 'Endless';
    $('modeLabel').className = 'eyebrow ' + (run.mode === 'daily' ? 'amber' : 'teal');
    $('levelText').textContent = `LV ${run.level}`;
    $('score').textContent = fmt(run.score);
    $('moves').textContent = run.moves;
    $('moves').classList.toggle('low', run.moves <= 3);
    $('levelProgress').textContent = `${fmt(Math.min(run.levelScore, run.target))} / ${fmt(run.target)}`;
    $('bar').style.width = Math.min(100, run.levelScore / run.target * 100).toFixed(1) + '%';
    $('mult').textContent = '×' + round2(E.mult(run.streak, run.up));
    $('streak').textContent = run.streak;
    $('novaAt').textContent = E.novaAt(run.up);
  }

  function popScore(main, sub) {
    const pop = $('pop');
    $('popText').textContent = main;
    $('popSub').textContent = sub;
    pop.classList.remove('go');
    void pop.offsetWidth;
    pop.classList.add('go');
  }

  // ---------- run ----------

  function startRun(mode) {
    clearTimeout(endTimer);
    const seed = mode === 'daily' ? E.hash('emberfall:' + E.dayKey(0)) : (Math.random() * 4294967296) >>> 0;
    rand = E.mulberry(seed);
    const up = mode === 'daily' ? E.noUpgrades() : Object.assign({}, save.up);
    run = { mode, up, score: 0, streak: 0, maxGroup: 0, peakMult: E.mult(0, up), ending: false };
    startLevel(1);
    show('play');
  }

  function startLevel(level) {
    Object.assign(run, {
      level,
      colors: E.colorsFor(level),
      board: E.levelBoard(rand, level, run.up),
      target: E.target(level),
      moves: START_MOVES + run.up.moves * 2,
      levelScore: 0,
      cleared: false,
    });
    hover = -1;
    $('clearOverlay').hidden = true;
    $('endingOverlay').hidden = true;
    $('pop').classList.remove('go');
    renderHud();
    renderBoard(new Set(run.board.map((c) => c.k)));
  }

  function tap(i) {
    if (!run || run.cleared || run.ending) return;
    const r = E.tap(run.board, i, { streak: run.streak, up: run.up, rand, colors: run.colors });
    if (!r) { toast('Needs a neighbour of the same colour'); return; }

    run.board = r.board;
    run.streak = r.streak;
    run.moves -= 1;
    run.levelScore += r.pts;
    run.score += r.pts;
    run.maxGroup = Math.max(run.maxGroup, r.n);
    run.peakMult = Math.max(run.peakMult, r.mult);

    let sub = '';
    if (r.spawn) sub = r.spawn === 'prism' ? 'Prism forged' : 'Nova forged';
    else if (r.special) sub = `${r.n} tiles detonated`;
    else if (r.mult > 1) sub = '×' + round2(r.mult);
    popScore('+' + fmt(r.pts), sub);

    let fresh = r.fresh;
    if (run.levelScore >= run.target) {
      const bonus = run.moves * 30;
      run.score += bonus;
      run.cleared = true;
      $('clearTitle').textContent = `Level ${run.level} cleared`;
      $('clearScore').textContent = fmt(run.score);
      $('bonusText').textContent = run.moves > 0 ? `${run.moves} moves to spare → +${fmt(bonus)} bonus` : 'Cleared on the last move';
      $('nextTarget').textContent = fmt(E.target(run.level + 1));
      $('clearOverlay').hidden = false;
      setTimeout(() => $('nextLevel').focus({ preventScroll: true }), 50);
    } else if (run.moves <= 0) {
      run.ending = true;
      $('endingOverlay').hidden = false;
      endTimer = setTimeout(endRun, 1100);
    } else if (!E.hasMove(run.board)) {
      run.board = E.freshBoard(rand, run.colors);
      fresh = new Set(run.board.map((c) => c.k));
      toast('No moves left — board reshuffled');
    }
    renderHud();
    renderBoard(fresh);
  }

  function endRun() {
    clearTimeout(endTimer);
    const today = E.dayKey(0);
    const earned = E.runEmbers(run.score, run.level);
    const newBest = run.score > save.best && run.score > 0;
    save.embers += earned;
    save.runs += 1;
    if (newBest) { save.best = run.score; save.bestLevel = run.level; }
    if (run.mode === 'daily') {
      if (save.daily.date !== today || run.score > save.daily.score) save.daily = { date: today, score: run.score, level: run.level };
      if (save.lastDay !== today) {
        save.dayStreak = save.lastDay === E.dayKey(-1) ? save.dayStreak + 1 : 1;
        save.lastDay = today;
      }
      markShelf();
    }
    persist();
    result = { score: run.score, level: run.level, embers: earned, newBest, mode: run.mode, maxGroup: run.maxGroup, peakMult: run.peakMult };
    run = null;
    renderOver();
    show('over');
  }

  function renderOver() {
    const r = result;
    const daily = r.mode === 'daily';
    $('overLabel').textContent = (daily ? 'Daily board' : 'Endless') + ' · run over';
    $('overLabel').className = 'eyebrow ' + (daily ? 'amber' : 'teal');
    $('resScore').textContent = fmt(r.score);
    $('resBest').hidden = !r.newBest;
    $('resLevel').textContent = r.level;
    $('resGroup').textContent = `${r.maxGroup} tiles`;
    $('resMult').textContent = '×' + round2(r.peakMult);
    $('resEmbers').textContent = '+' + r.embers;
    $('share').hidden = !daily;

    const costs = E.UPGRADES.filter((u) => save.up[u.id] < u.max).map((u) => E.upgradeCost(u, save.up[u.id]));
    const cheapest = costs.length ? Math.min(...costs) : Infinity;
    let nudge;
    if (daily) nudge = 'Same board for everyone today. Share your line, then come back tomorrow for a new one.';
    else if (cheapest === Infinity) nudge = 'Every upgrade is maxed. It is all skill from here.';
    else if (save.embers >= cheapest) nudge = 'You can afford an upgrade in the Forge.';
    else nudge = `${cheapest - save.embers} more Embers until your next upgrade.`;
    $('resNudge').textContent = nudge;
  }

  function buy(u) {
    const lvl = save.up[u.id];
    const cost = E.upgradeCost(u, lvl);
    if (lvl >= u.max || save.embers < cost) return;
    save.embers -= cost;
    save.up[u.id] = lvl + 1;
    persist();
    renderShop();
    toast(`${u.name} → level ${lvl + 1}`);
  }

  function stoke() {
    const today = E.dayKey(0);
    if (save.hearth.date !== today) save.hearth = { date: today, n: 0 };
    if (save.hearth.n >= HEARTH_MAX) return;
    save.hearth.n += 1;
    save.embers += 1;
    persist();
    renderHome();
  }

  function share() {
    const r = result;
    let bar = '';
    for (let i = 1; i <= Math.min(r.level, 12); i++) bar += i < r.level ? '■' : '□';
    const text = `Emberfall Daily ${E.dayKey(0)}\n${bar} Lv ${r.level}\n${fmt(r.score)} pts · biggest clear ${r.maxGroup}\nhttps://jonezzyboy.github.io/emberfall/`;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ text }).catch(() => {});
      return;
    }
    try {
      navigator.clipboard.writeText(text).then(() => toast('Result copied'), () => toast('Clipboard blocked'));
    } catch (e) { toast('Clipboard blocked'); }
  }

  // ---------- wiring ----------

  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => startRun(b.dataset.start)));
  $('playDaily').addEventListener('click', () => startRun('daily'));
  $('playEndless').addEventListener('click', () => startRun('endless'));
  $('playAgain').addEventListener('click', () => startRun(result ? result.mode : 'endless'));
  $('nextLevel').addEventListener('click', () => startLevel(run.level + 1));
  $('quit').addEventListener('click', () => { if (run) endRun(); });
  $('hearth').addEventListener('click', stoke);
  $('share').addEventListener('click', share);

  show('home');
})();
