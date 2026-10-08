const assert = require('node:assert/strict');
const E = require('../engine.js');

const N = (c) => ({ c, t: 'n', k: Math.random() });

function grid(rows) {
  return rows.join('').split('').map((ch) => {
    if (ch === '*') return { c: 0, t: 'nova', k: Math.random() };
    if (ch === 'P') return { c: 1, t: 'prism', k: Math.random() };
    return N(Number(ch));
  });
}

// Checkerboard of 0/1 with no adjacent matches anywhere.
const CHECKER = Array.from({ length: E.H }, (_, y) => Array.from({ length: E.W }, (_, x) => String((x + y) % 2)).join(''));

{
  const b = grid(CHECKER);
  assert.equal(E.hasMove(b), false, 'checkerboard has no moves');
  assert.equal(E.tap(b, 0, { streak: 0, up: E.noUpgrades(), rand: Math.random, colors: 4 }), null, 'lone tile does nothing');
}

{
  const rows = CHECKER.slice();
  rows[0] = '2222' + rows[0].slice(4);
  const b = grid(rows);
  const hit = E.computeHit(b, 1);
  assert.equal(hit.set.size, 4, 'flood fill finds the row group');
  const r = E.tap(b, 1, { streak: 0, up: E.noUpgrades(), rand: () => 0.99, colors: 4 });
  assert.equal(r.n, 4);
  assert.equal(r.streak, 1, '4+ builds the streak');
  assert.equal(r.pts, E.points(4, 1.5));
  assert.equal(r.board.length, E.W * E.H);
  assert.ok(r.board.every(Boolean), 'gravity refills every hole');
  assert.equal(r.fresh.size, 4, 'four new tiles fall in');
}

{
  const rows = CHECKER.slice();
  rows[0] = '222222' + rows[0].slice(6);
  const r = E.tap(grid(rows), 0, { streak: 0, up: E.noUpgrades(), rand: () => 0.5, colors: 4 });
  assert.equal(r.spawn, 'nova', '6 forges a Nova');
  assert.equal(r.board[0].t === 'nova' || r.board.some((c) => c.t === 'nova'), true);
}

{
  const up = Object.assign(E.noUpgrades(), { nova: 2 });
  assert.equal(E.novaAt(up), 4);
  assert.equal(E.novaAt(Object.assign(E.noUpgrades(), { nova: 9 })), 4, 'nova threshold floors at 4');
}

{
  // A Nova whose blast reaches a Prism fires the Prism, which clears every tile of its colour.
  const rows = CHECKER.slice();
  rows[3] = '0*P' + rows[3].slice(3);
  const b = grid(rows);
  const hit = E.computeHit(b, 3 * E.W + 1);
  const colourOnes = b.filter((c) => c.t === 'n' && c.c === 1).length;
  assert.ok(hit.special);
  assert.ok(hit.set.size >= colourOnes + 2, 'chain reaction includes the Prism colour sweep');
}

{
  const a = E.mulberry(E.hash('emberfall:2026-10-08'));
  const b = E.mulberry(E.hash('emberfall:2026-10-08'));
  const ba = E.levelBoard(a, 1, E.noUpgrades()).map((c) => c.c).join('');
  const bb = E.levelBoard(b, 1, E.noUpgrades()).map((c) => c.c).join('');
  assert.equal(ba, bb, 'daily board is deterministic per date');
  assert.ok(E.hasMove(E.levelBoard(E.mulberry(1), 1, E.noUpgrades())), 'fresh boards are playable');
}

assert.deepEqual([1, 2, 3, 4].map(E.target), [400, 550, 800, 1100]);
assert.equal(E.colorsFor(2), 4);
assert.equal(E.colorsFor(3), 5);

console.log('engine: ok');
