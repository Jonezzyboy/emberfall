const assert = require('node:assert/strict');
const E = require('../engine.js');

let k = 0;
function grid(rows) {
  return rows.join('').split('').map((ch) => {
    k++;
    if (ch === '*') return { c: 0, t: 'nova', k };
    if (ch === 'P') return { c: 1, t: 'prism', k };
    if (ch === '#') return { c: -1, t: 'ash', k };
    if (ch === 's') return { c: 2, t: 'n', s: true, k };
    return { c: Number(ch), t: 'n', k };
  });
}

// Checkerboard of 0/1 with no adjacent matches anywhere.
const CHECKER = Array.from({ length: E.H }, (_, y) => Array.from({ length: E.W }, (_, x) => String((x + y) % 2)).join(''));
const R1 = E.rules(E.noUpgrades(), E.noBoons(), 1);
const fixed = (v) => () => v;

{
  const b = grid(CHECKER);
  assert.equal(E.hasMove(b), false, 'checkerboard has no moves');
  assert.equal(E.tap(b, 0, 0, R1, Math.random), null, 'lone tile does nothing');
}

{
  const rows = CHECKER.slice();
  rows[0] = '2222' + rows[0].slice(4);
  const r = E.tap(grid(rows), 1, 0, R1, fixed(0.99));
  assert.equal(r.n, 4);
  assert.equal(r.streak, 1, '4+ builds the streak');
  assert.equal(r.pts, E.points(4, R1.baseMult + R1.streakStep, R1, false));
  assert.ok(r.board.every(Boolean), 'gravity refills every hole');
  assert.equal(r.fresh.size, 4, 'four new tiles fall in');
}

{
  const rows = CHECKER.slice();
  rows[0] = '222222' + rows[0].slice(6);
  const r = E.tap(grid(rows), 0, 0, R1, fixed(0.5));
  assert.equal(r.spawn, 'nova', '6 forges a Nova');
}

{
  const rows = CHECKER.slice();
  rows[0] = '22#' + rows[0].slice(3);
  const hit = E.computeHit(grid(rows), 0, R1);
  assert.equal(hit.n, 2);
  assert.equal(hit.ash, 1, 'ash next to a clear crumbles');
  const ashOnly = E.computeHit(grid(rows), 2, R1);
  assert.equal(ashOnly.set.size, 0, 'ash cannot be tapped');
}

{
  // A Nova whose blast reaches a Prism fires the Prism, which takes the colour with most tiles left.
  const rows = CHECKER.slice();
  rows[3] = '0*P' + rows[3].slice(3);
  rows[7] = '2222222';
  const b = grid(rows);
  const hit = E.computeHit(b, 3 * E.W + 1, R1);
  assert.ok(hit.special);
  assert.equal(hit.specials, 2);
  const swept = [0, 1, 2].filter((c) => b.every((d, m) => d.t !== 'n' || d.c !== c || hit.set.has(m)));
  assert.equal(swept.length, 1, 'a chained Prism wipes out exactly one colour');
  assert.notEqual(swept[0], 2, 'and picks a plentiful one, not the scarce one');
  assert.equal(E.preview(b, 3 * E.W + 1, 0, R1).pts, Math.round(hit.n * 40 * (R1.baseMult + R1.streakStep)), 'blasts pay per tile');
}

{
  // A tapped Prism clears the colour the player picks.
  const rows = CHECKER.slice();
  rows[0] = 'P' + rows[0].slice(1);
  rows[7] = '2222222';
  const b = grid(rows);
  for (const pick of [0, 1, 2]) {
    const r = E.preview(b, 0, 0, R1, pick);
    const total = b.filter((d) => d.t === 'n' && d.c === pick).length;
    assert.ok(r.valid);
    assert.equal(r.n, total + 1, `Prism with pick ${pick} clears all of it`);
  }
  const spawned = E.tap(grid(['00000000000' + CHECKER.join('').slice(11)].join('').match(/.{7}/g)), 0, 0, R1, () => 0.99);
  assert.ok(spawned.board.some((d) => d.t === 'prism' && d.c === -1), 'a forged Prism has no colour of its own');
}

{
  const wild = E.rules(E.noUpgrades(), Object.assign(E.noBoons(), { wildfire: 1 }), 1);
  const rows = CHECKER.slice();
  rows[4] = '000*' + rows[4].slice(4);
  assert.equal(E.computeHit(grid(rows), 4 * E.W + 3, wild).n, 25, 'Wildfire blasts 5×5');
}

{
  const rows = CHECKER.slice();
  rows[0] = 'ss' + rows[0].slice(2);
  assert.equal(E.computeHit(grid(rows), 0, R1).sparks, 2);
}

{
  let streak = 0;
  for (let i = 0; i < 20; i++) {
    const rows = CHECKER.slice();
    rows[0] = '2222' + rows[0].slice(4);
    streak = E.tap(grid(rows), 0, streak, R1, fixed(0.99)).streak;
  }
  assert.equal(streak, E.STREAK_CAP, 'streak caps');
  const patient = E.rules(E.noUpgrades(), Object.assign(E.noBoons(), { patience: 1 }), 1);
  const rows = CHECKER.slice();
  rows[0] = '22' + rows[0].slice(2);
  assert.equal(E.tap(grid(rows), 0, 3, patient, fixed(0.99)).streak, 3, 'Patience keeps the streak on small clears');
  assert.equal(E.tap(grid(rows), 0, 3, R1, fixed(0.99)).streak, 0);
}

{
  const r4 = E.rules(E.noUpgrades(), E.noBoons(), 4);
  assert.ok(r4.ashChance > 0 && r4.startAsh > 0, 'ash arrives at level 4');
  const warded = E.rules(E.noUpgrades(), Object.assign(E.noBoons(), { ashward: 1 }), 6);
  assert.equal(warded.ashChance, 0);
  assert.equal(warded.startAsh, 0, 'Ashward keeps Ash off fresh boards too');
  assert.ok(E.levelBoard(E.mulberry(7), warded).every((c) => c.t !== 'ash'));
  assert.equal(E.rules(E.noUpgrades(), Object.assign(E.noBoons(), { narrow: 1 }), 3).colors, 4);
  assert.equal(E.rules(Object.assign(E.noUpgrades(), { nova: 2 }), Object.assign(E.noBoons(), { fuse: 2 }), 1).novaAt, 4, 'nova threshold floors at 4');
}

{
  const offer = E.boonOffer(E.mulberry(1), E.noUpgrades(), E.noBoons(), 2, 3);
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer.map((b) => b.id)).size, 3, 'offers are distinct');
  assert.ok(offer.every((b) => !b.from || b.from <= 2), 'level-gated boons stay out early');
  const maxed = Object.fromEntries(E.BOONS.map((b) => [b.id, b.max]));
  assert.equal(E.boonOffer(Math.random, E.noUpgrades(), maxed, 9, 3).length, 0);
  const triggered = Object.assign(E.noUpgrades(), { nova: 2 });
  for (let s = 1; s < 50; s++) {
    assert.ok(E.boonOffer(E.mulberry(s), triggered, E.noBoons(), 5, 4).every((b) => b.id !== 'fuse'), 'Short Fuse is not offered once Novas are at their floor');
  }
}

{
  const day = 'emberfall:2026-10-08';
  const a = E.levelBoard(E.mulberry(E.hash(day)), R1).map((c) => c.c).join('');
  const b = E.levelBoard(E.mulberry(E.hash(day)), R1).map((c) => c.c).join('');
  assert.equal(a, b, 'daily board is deterministic per date');
  for (let s = 1; s < 30; s++) {
    assert.ok(E.hasMove(E.levelBoard(E.mulberry(s), E.rules(E.noUpgrades(), E.noBoons(), 8))), 'fresh boards are playable');
  }
}

{
  const lucky = E.rules(Object.assign(E.noUpgrades(), { luck: 2 }), E.noBoons(), 1);
  for (let s = 1; s < 30; s++) {
    assert.equal(E.levelBoard(E.mulberry(s), lucky).filter((c) => c.t === 'nova').length, 2, 'every free Nova lands');
  }
}

assert.deepEqual([1, 2, 3].map(E.target), [600, 900, 1350]);
assert.deepEqual([1, 2, 5, 9].map(E.runEmbers), [1, 2, 8, 23]);
assert.equal(E.upgradeCost(E.UPGRADES[0], 2), 80);

console.log('engine: ok');
