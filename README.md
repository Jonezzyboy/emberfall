# Emberfall.

Clear the board. Chase the chain. Come back tomorrow. Part of [The Daily Shelf](https://jonezzyboy.github.io/).

**Play it: [jonezzyboy.github.io/emberfall](https://jonezzyboy.github.io/emberfall/)**

## The game

- **Tap a group** of two or more matching tiles to clear it. A group of *n*
  scores `n × (n + 1) × 5`, times your multiplier — big groups pay far more.
  Hover (or focus) a tile to preview the payout first.
- **Streaks:** each clear of 4+ adds +0.25× to the multiplier, up to 8 steps;
  a smaller clear resets it, and so does a new level.
- **Specials:** 6+ tiles forge a **Nova** (clears 3×3), 11+ forge a **Prism**
  (tap it, then tap any colour to clear every tile of it). Specials caught in
  a blast fire too; a Prism set off that way takes the colour with most tiles
  left.
  Blasts pay 40 a tile.
- **Ash** arrives at level 4: dead tiles that crumble when a neighbour clears.
- **Sparks** are marked tiles worth +1 move each, up to 5 a level.
- **Levels:** hit a target that grows ×1.5 a level, in 16 moves. Leftover
  moves pay 30 each. A fifth colour arrives at level 3.

## Boons

Clearing a level offers three boons, kept for the rest of the run: more moves,
stronger streaks, cheaper or bigger Novas, easier Prisms, more Sparks, no
more Ash, one fewer colour, and so on. Each boon has its own stack limit.

## Modes

- **Daily board** — the board and every boon offer are seeded from the local
  date, so everyone plays the same run. Forge upgrades are off. The first daily
  each day pays double Embers. Tracks a day streak and copies a share line.
- **Endless run** — random boards with your Forge upgrades applied.

## Embers, the Forge and Feats

A run pays `1 + ⌊c(c + 3) / 4⌋` Embers for `c` levels cleared. Score doesn't
count: it grows exponentially with level and would flood the Forge. Embers buy
permanent upgrades in the Forge (costs double with each level), and one-off
Feats pay a little extra. The hearth pays 5 a day.

Balance was tuned with a greedy simulated player (always takes the biggest
payout, picks boons at random) over a few hundred runs per tier:

| Forge        | median level | Embers / run |
| ------------ | ------------ | ------------ |
| none         | 8            | ~18          |
| half-bought  | 11           | ~33          |
| maxed (3560) | 13           | ~46          |

Progress is saved to `localStorage` in the browser only.

## Develop

```sh
npm start   # serve on :8000
npm test    # engine tests (node, no deps)
```

`engine.js` holds the pure rules (board, flood fill, chains, ash, gravity,
scoring, boons, economy) and is shared by the page and the tests; `game.js` is
the UI.
