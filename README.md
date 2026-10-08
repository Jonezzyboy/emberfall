# Emberfall.

Clear the board. Chase the chain. Come back tomorrow. Part of [The Daily Shelf](https://jonezzyboy.github.io/).

**Play it: [jonezzyboy.github.io/emberfall](https://jonezzyboy.github.io/emberfall/)**

## The game

- **Tap a group** of two or more matching tiles to clear it. A group of *n*
  scores `n × (n + 1) × 5`, times your multiplier — big groups pay far more.
  Hover (or focus) a tile to preview the payout first.
- **Streaks:** every clear of 4+ adds +0.5× to the multiplier; a smaller clear
  resets it.
- **Specials:** 6+ tiles forge a **Nova** (clears 3×3), 11+ forge a **Prism**
  (clears every tile of its colour). Specials caught in a blast fire too, so
  one tap can cascade.
- **Levels:** hit a rising target within 16 moves. Leftover moves pay 30 each.
  Run out and the run ends. A fifth colour arrives at level 3.

## Modes

- **Daily board** — seeded from the local date, so everyone gets the same
  first board. Upgrades are off. Tracks a day streak and copies a share line.
- **Endless run** — a random board with your Forge upgrades applied.

## The Forge

Every run pays Embers (`score / 40 + 5 per level cleared`), win or lose. Spend
them on four permanent upgrades: extra moves, base multiplier, cheaper Novas,
and a free Nova at each level start. The hearth on the home screen pays up to
20 Embers a day, one tap at a time.

Progress is saved to `localStorage` in the browser only.

## Develop

```sh
npm start   # serve on :8000
npm test    # engine tests (node, no deps)
```

`engine.js` holds the pure rules (board, flood fill, chains, gravity, scoring)
and is shared by the page and the tests; `game.js` is the UI.
