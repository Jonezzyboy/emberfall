(function () {
  const E = Engine;
  const SAVE_KEY = 'emberfall-v1';
  const SAVE_VERSION = 2;
  // Read by the Daily Shelf landing page, which shares this origin.
  const SHELF_KEY = 'dailies-v1';
  const STATS_KEY = 'emberfall-stats-v1';
  const HEARTH_MAX = 5;

  const COLORS = [
    { hex: '#f2b33d', name: 'Amber', d: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z' },
    { hex: '#e4572e', name: 'Coral', d: 'M12 4L20.5 19H3.5Z' },
    { hex: '#1fa392', name: 'Teal', d: 'M5.5 5.5H18.5V18.5H5.5Z' },
    { hex: '#7b6cf6', name: 'Violet', d: 'M12 3L21 12L12 21L3 12Z' },
    { hex: '#e9e4d8', name: 'Bone', d: 'M12 3L20 7.5V16.5L12 21L4 16.5V7.5Z' },
  ];
  const STAR = 'M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4Z';
  const RING = 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18ZM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z';
  const CRACK = 'M7 6l4 5l-3 3l4 4M14 5l-1 4l4 3l-2 6';

  const FEATS = [
    { id: 'first', name: 'First Light', desc: 'Clear level 1', reward: 2 },
    { id: 'nova', name: 'Supernova', desc: 'Forge a Nova', reward: 3 },
    { id: 'prism', name: 'Refraction', desc: 'Forge a Prism', reward: 5 },
    { id: 'chain', name: 'Chain Reaction', desc: 'Set off 2 or more specials in one tap', reward: 10 },
    { id: 'landslide', name: 'Landslide', desc: 'Clear 15+ matching tiles at once', reward: 10 },
    { id: 'whitehot', name: 'White Hot', desc: `Max out your streak (${E.STREAK_CAP})`, reward: 8 },
    { id: 'sweeper', name: 'Ash Sweeper', desc: 'Crumble 15 Ash in one run', reward: 8 },
    { id: 'sparks', name: 'Live Wire', desc: `Collect all ${E.SPARK_CAP} Sparks in one level`, reward: 8 },
    { id: 'lv5', name: 'Kindled', desc: 'Reach level 5', reward: 5 },
    { id: 'lv10', name: 'Blaze', desc: 'Reach level 10', reward: 15 },
    { id: 'lv15', name: 'Inferno', desc: 'Reach level 15', reward: 40 },
    { id: 'daily3', name: 'Regular', desc: 'Play the daily 3 days running', reward: 15 },
    { id: 'daily7', name: 'Devotee', desc: 'Play the daily 7 days running', reward: 30 },
  ];

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const round2 = (n) => Math.round(n * 100) / 100;

  function loadSave() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* no storage */ }
    const save = Object.assign({
      embers: 0, best: 0, bestLevel: 0, runs: 0,
      daily: { date: '', score: 0, level: 0 }, dayStreak: 0, lastDay: '',
      hearth: { date: '', n: 0 }, feats: {},
    }, s || {});
    // Version 1 paid out far too fast; its Embers and upgrades don't carry over.
    if (s && s.v !== SAVE_VERSION) {
      save.embers = 0;
      save.up = {};
      save.feats = {};
    }
    save.v = SAVE_VERSION;
    save.up = Object.assign(E.noUpgrades(), save.up || {});
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
  persist();
  let run = null;
  let rand = Math.random;
  let hover = -1;
  let result = null;
  let endTimer = 0;
  let toastTimer = 0;
  const toastQueue = [];

  // ---------- feats ----------

  function award(id) {
    if (save.feats[id]) return;
    const f = FEATS.find((x) => x.id === id);
    save.feats[id] = true;
    save.embers += f.reward;
    persist();
    toast(`Feat: ${f.name} · +${f.reward} Embers`);
  }

  // ---------- screens ----------

  function show(name) {
    clearTimeout(endTimer);
    for (const id of ['home', 'play', 'shop', 'feats', 'over']) $(id).hidden = id !== name;
    if (name === 'home') renderHome();
    if (name === 'shop') renderShop();
    if (name === 'feats') renderFeats();
    window.scrollTo(0, 0);
  }

  function toast(msg) {
    toastQueue.push(msg);
    if (toastQueue.length === 1) nextToast();
  }

  function nextToast() {
    const t = $('toast');
    if (!toastQueue.length) { t.hidden = true; return; }
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = toastQueue[0];
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastQueue.shift(); nextToast(); }, 1900);
  }

  function renderEmbers() {
    document.querySelectorAll('[data-embers]').forEach((el) => { el.textContent = fmt(save.embers); });
  }

  function renderHome() {
    const today = E.dayKey(0);
    const done = save.daily.date === today;
    renderEmbers();
    $('featCount').textContent = `${FEATS.filter((f) => save.feats[f.id]).length}/${FEATS.length}`;
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
    $('hearthText').textContent = full ? 'Banked for today. Back tomorrow.' : `Tap for +1 Ember, ${HEARTH_MAX} a day`;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderShop() {
    renderEmbers();
    const list = $('upgrades');
    list.replaceChildren();
    for (const u of E.UPGRADES) {
      const lvl = save.up[u.id];
      const maxed = lvl >= u.max;
      const cost = E.upgradeCost(u, lvl);

      const pips = el('div', 'pips');
      for (let i = 0; i < u.max; i++) pips.append(el('span', i < lvl ? 'on' : ''));
      const body = el('div', 'upgrade-body');
      body.append(el('div', 'upgrade-name', u.name), el('div', 'muted small', u.desc), pips);

      const btn = el('button', 'btn num', maxed ? 'Maxed' : fmt(cost));
      btn.type = 'button';
      btn.disabled = maxed || save.embers < cost;
      btn.setAttribute('aria-label', maxed ? `${u.name} maxed` : `Buy ${u.name} for ${cost} embers`);
      btn.addEventListener('click', () => buy(u));

      const row = el('div', 'upgrade');
      row.append(body, btn);
      list.append(row);
    }
  }

  function renderFeats() {
    const done = FEATS.filter((f) => save.feats[f.id]).length;
    $('featTotal').textContent = `${done}/${FEATS.length}`;
    const list = $('featList');
    list.replaceChildren();
    for (const f of FEATS) {
      const got = !!save.feats[f.id];
      const row = el('div', 'feat' + (got ? ' done' : ''));
      const mark = el('span', 'feat-mark');
      if (got) mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5l9-10"/></svg>';
      const body = el('div', 'feat-body');
      body.append(el('span', 'feat-name', f.name), el('span', 'muted small', f.desc));
      row.append(mark, body, el('span', 'num amber', `+${f.reward}`));
      row.setAttribute('aria-label', `${f.name}: ${f.desc}. ${got ? 'Earned' : 'Not yet earned'}.`);
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
    const p = hover >= 0 ? E.preview(run.board, hover, run.streak, run.rules) : null;
    const hl = p && p.valid ? p.hit.set : null;
    boardEl.classList.toggle('focus', !!hl);

    run.board.forEach((c, i) => {
      const t = tiles[i];
      const col = COLORS[c.c];
      let bg, d, fill = 'none', stroke = 'none', label;
      if (c.t === 'nova') { bg = '#fff1d0'; d = STAR; fill = '#e4572e'; label = 'Nova'; }
      else if (c.t === 'prism') { bg = '#2a2240'; d = RING; fill = col.hex; label = `${col.name} prism`; }
      else if (c.t === 'ash') { bg = '#4a4458'; d = CRACK; stroke = 'rgba(20,16,30,.6)'; label = 'Ash'; }
      else { bg = col.hex; d = col.d; fill = 'rgba(20,16,30,.5)'; label = col.name + (c.s ? ' spark' : ''); }
      t.style.backgroundColor = bg;
      const path = t.firstChild.firstChild;
      path.setAttribute('d', d);
      path.setAttribute('fill', fill);
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      t.setAttribute('aria-label', label);
      t.classList.toggle('ash', c.t === 'ash');
      t.classList.toggle('spark', !!c.s);
      t.classList.toggle('hl', !!(hl && hl.has(i)));
      if (fresh && fresh.has(c.k)) {
        t.classList.remove('drop');
        void t.offsetWidth;
        t.classList.add('drop');
      }
    });

    const pv = $('preview');
    pv.className = 'preview';
    if (run.cleared) {
      pv.textContent = '';
    } else if (p && p.valid) {
      const bits = [`${p.hit.special ? 'Detonates ' : ''}${p.n} tiles → +${fmt(p.pts)}`];
      if (p.hit.ash) bits.push(`${p.hit.ash} ash`);
      if (p.spawn === 'prism') bits.push('forges a Prism');
      else if (p.spawn === 'nova') bits.push('forges a Nova');
      else if (p.streak === 0 && run.streak > 0) bits.push('breaks streak');
      pv.textContent = bits.join(' · ');
      pv.classList.add('on');
    } else if (p) {
      pv.textContent = run.board[hover].t === 'ash' ? 'Ash — clear a tile next to it' : 'Lonely tile — needs a matching neighbour';
      pv.classList.add('off');
    } else {
      pv.textContent = 'Clear 4+ at once to build a streak';
    }
  }

  function renderHud() {
    const r = run.rules;
    $('modeLabel').textContent = run.mode === 'daily' ? 'Daily board' : 'Endless';
    $('modeLabel').className = 'eyebrow ' + (run.mode === 'daily' ? 'amber' : 'teal');
    $('levelText').textContent = `LV ${run.level}`;
    $('score').textContent = fmt(run.score);
    $('moves').textContent = run.moves;
    $('moves').classList.toggle('low', run.moves <= 3);
    $('levelProgress').textContent = `${fmt(Math.min(run.levelScore, run.target))} / ${fmt(run.target)}`;
    $('bar').style.width = Math.min(100, run.levelScore / run.target * 100).toFixed(1) + '%';
    $('mult').textContent = '×' + round2(E.mult(run.streak, r));
    $('streak').textContent = `${run.streak}/${E.STREAK_CAP}`;
    $('sparks').textContent = `${run.sparks}/${E.SPARK_CAP}`;
    $('novaAt').textContent = r.novaAt;
    $('prismAt').textContent = r.prismAt;

    const rb = $('runBoons');
    rb.replaceChildren();
    const owned = E.BOONS.filter((b) => run.boons[b.id]);
    if (owned.length) {
      owned.forEach((b, i) => {
        if (i) rb.append(' · ');
        rb.append(el('b', '', b.name + (run.boons[b.id] > 1 ? ` ×${run.boons[b.id]}` : '')));
      });
    }
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
    const day = E.dayKey(0);
    rand = E.mulberry(mode === 'daily' ? E.hash('emberfall:' + day) : (Math.random() * 4294967296) >>> 0);
    const up = mode === 'daily' ? E.noUpgrades() : Object.assign({}, save.up);
    run = {
      mode, day, up, boons: E.noBoons(), score: 0, streak: 0, maxGroup: 0, peakMult: 1,
      ash: 0, rerolls: up.reroll, ending: false,
    };
    startLevel(1);
    show('play');
  }

  function startLevel(level) {
    const r = E.rules(run.up, run.boons, level);
    Object.assign(run, {
      level, rules: r,
      board: E.levelBoard(rand, r),
      target: E.target(level),
      moves: r.moves,
      levelScore: 0,
      streak: 0,
      sparks: 0,
      cleared: false,
    });
    run.peakMult = Math.max(run.peakMult, r.baseMult);
    hover = -1;
    $('clearOverlay').hidden = true;
    $('endingOverlay').hidden = true;
    $('pop').classList.remove('go');
    if (level >= 5) award('lv5');
    if (level >= 10) award('lv10');
    if (level >= 15) award('lv15');
    renderHud();
    renderBoard(new Set(run.board.map((c) => c.k)));
  }

  function tap(i) {
    if (!run || run.cleared || run.ending) return;
    const r = E.tap(run.board, i, run.streak, run.rules, rand);
    if (!r) {
      toast(run.board[i].t === 'ash' ? 'Ash only crumbles when a neighbour clears' : 'Needs a neighbour of the same colour');
      return;
    }

    const gained = Math.min(r.sparks, E.SPARK_CAP - run.sparks);
    run.board = r.board;
    run.streak = r.streak;
    run.sparks += gained;
    run.moves += gained - 1;
    run.levelScore += r.pts;
    run.score += r.pts;
    run.ash += r.ash;
    run.maxGroup = Math.max(run.maxGroup, r.n);
    run.peakMult = Math.max(run.peakMult, r.mult);

    if (r.spawn === 'nova') award('nova');
    if (r.spawn === 'prism') award('prism');
    if (r.specials >= 2) award('chain');
    if (!r.special && r.n >= 15) award('landslide');
    if (r.streak >= E.STREAK_CAP) award('whitehot');
    if (run.ash >= 15) award('sweeper');
    if (run.sparks >= E.SPARK_CAP) award('sparks');

    let sub = '';
    if (r.spawn) sub = r.spawn === 'prism' ? 'Prism forged' : 'Nova forged';
    else if (r.special) sub = `${r.n} tiles detonated`;
    else if (r.mult > 1) sub = '×' + round2(r.mult);
    if (gained) sub += (sub ? ' · ' : '') + `+${gained} move${gained > 1 ? 's' : ''}`;
    popScore('+' + fmt(r.pts), sub);

    let fresh = r.fresh;
    if (run.levelScore >= run.target) {
      levelCleared();
    } else if (run.moves <= 0) {
      run.ending = true;
      $('endingOverlay').hidden = false;
      endTimer = setTimeout(endRun, 1100);
    } else if (!E.hasMove(run.board)) {
      run.board = E.freshBoard(rand, run.rules);
      fresh = new Set(run.board.map((c) => c.k));
      toast('No moves left — board reshuffled');
    }
    renderHud();
    renderBoard(fresh);
  }

  function levelCleared() {
    const bonus = run.moves * run.rules.leftover;
    run.score += bonus;
    run.cleared = true;
    run.offerRolls = 0;
    award('first');
    $('clearTitle').textContent = `Level ${run.level} cleared`;
    $('bonusText').textContent = run.moves > 0
      ? `${run.moves} moves to spare → +${fmt(bonus)} · run ${fmt(run.score)}`
      : `Cleared on the last move · run ${fmt(run.score)}`;
    $('nextTarget').textContent = fmt(E.target(run.level + 1));
    renderOffer();
    $('clearOverlay').hidden = false;
  }

  // The daily draws offers from its own seed so everyone reaching a level sees the same boons.
  function offerRand() {
    if (run.mode !== 'daily') return Math.random;
    return E.mulberry(E.hash(`emberfall-boons:${run.day}:${run.level}:${run.offerRolls}`));
  }

  function renderOffer() {
    const count = run.up.choice ? 4 : 3;
    const offer = E.boonOffer(offerRand(), run.boons, run.level + 1, count);
    const box = $('boonOffer');
    box.replaceChildren();
    if (!offer.length) {
      const go = el('button', 'btn', 'Next level');
      go.type = 'button';
      go.addEventListener('click', () => startLevel(run.level + 1));
      box.append(el('div', 'muted small', 'Every boon is maxed.'), go);
    }
    for (const b of offer) {
      const btn = el('button', 'boon');
      btn.type = 'button';
      const name = el('span', 'boon-name', b.name);
      if (run.boons[b.id]) name.append(el('span', 'num', `${run.boons[b.id]} → ${run.boons[b.id] + 1}`));
      btn.append(name, el('span', 'boon-desc', b.desc));
      btn.addEventListener('click', () => {
        run.boons[b.id] += 1;
        startLevel(run.level + 1);
      });
      box.append(btn);
    }
    const rr = $('reroll');
    rr.hidden = run.rerolls <= 0 || !offer.length;
    rr.textContent = `Reroll (${run.rerolls})`;
    setTimeout(() => { const first = box.querySelector('button'); if (first) first.focus({ preventScroll: true }); }, 50);
  }

  function reroll() {
    if (!run || !run.cleared || run.rerolls <= 0) return;
    run.rerolls -= 1;
    run.offerRolls += 1;
    renderOffer();
  }

  function endRun() {
    clearTimeout(endTimer);
    const today = E.dayKey(0);
    const daily = run.mode === 'daily';
    const firstDaily = daily && save.daily.date !== today;
    const base = E.runEmbers(run.level);
    const earned = firstDaily ? base * 2 : base;
    const newBest = run.score > save.best && run.score > 0;
    save.embers += earned;
    save.runs += 1;
    if (newBest) { save.best = run.score; save.bestLevel = run.level; }
    if (daily) {
      if (save.daily.date !== today || run.score > save.daily.score) save.daily = { date: today, score: run.score, level: run.level };
      if (save.lastDay !== today) {
        save.dayStreak = save.lastDay === E.dayKey(-1) ? save.dayStreak + 1 : 1;
        save.lastDay = today;
      }
      markShelf();
    }
    persist();
    if (save.dayStreak >= 3) award('daily3');
    if (save.dayStreak >= 7) award('daily7');
    result = {
      score: run.score, level: run.level, embers: earned, doubled: firstDaily, newBest, mode: run.mode,
      maxGroup: run.maxGroup, peakMult: run.peakMult, boons: E.BOONS.filter((b) => run.boons[b.id]).map((b) => b.name),
    };
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
    $('resEmbersNote').textContent = r.doubled ? 'doubled: first daily today' : '';
    $('share').hidden = !daily;

    const costs = E.UPGRADES.filter((u) => save.up[u.id] < u.max).map((u) => E.upgradeCost(u, save.up[u.id]));
    const cheapest = costs.length ? Math.min(...costs) : Infinity;
    let nudge;
    if (daily) nudge = 'Same board and boons for everyone today. Share your line, then come back tomorrow.';
    else if (cheapest === Infinity) nudge = 'Every upgrade is maxed. It is all skill from here.';
    else if (save.embers >= cheapest) nudge = 'You can afford an upgrade in the Forge.';
    else nudge = `${cheapest - save.embers} more Embers until your next upgrade. Every level you clear pays more than the last.`;
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
    const lines = [
      `Emberfall Daily ${E.dayKey(0)}`,
      `${bar} Lv ${r.level}`,
      `${fmt(r.score)} pts · biggest clear ${r.maxGroup}`,
    ];
    if (r.boons.length) lines.push(`Boons: ${r.boons.join(', ')}`);
    lines.push('https://jonezzyboy.github.io/emberfall/');
    const text = lines.join('\n');
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
  $('reroll').addEventListener('click', reroll);
  $('quit').addEventListener('click', () => { if (run) endRun(); });
  $('hearth').addEventListener('click', stoke);
  $('share').addEventListener('click', share);

  show('home');
})();
