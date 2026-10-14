# Implemented games

Games in the `games` table that have a real canvas engine (`lib/engines/<id>.ts`, registered in
`ENGINES` in `lib/engines/index.ts`) and save scores to the leaderboards. Source: Supabase
`games` table, checked 2026-10-14.

| Order | Id          | Title     | Category | Color   | Engine                      | Sound | Spec                                                                                 | Reference                     |
| ----- | ----------- | --------- | -------- | ------- | --------------------------- | ----- | ------------------------------------------------------------------------------------ | ----------------------------- |
| 1     | `arkanoid`  | ARKANOID  | ARCADE   | cyan    | `lib/engines/arkanoid.ts`   | Yes   | [08](../specs/08-arkanoid-game.md), [09](../specs/09-arkanoid-sound.md) (sound)      | `started-games/04-arkanoid`   |
| 2     | `tetris`    | TETRIS    | PUZZLE   | magenta | `lib/engines/tetris.ts`     | No    | [07](../specs/07-tetris-game.md)                                                     | `started-games/03-tetris`     |
| 3     | `snake`     | SNAKE     | ARCADE   | green   | `lib/engines/snake.ts`      | No    | [10](../specs/10-snake-game.md)                                                      | —                             |
| 6     | `asteroids` | ASTEROIDS | SHOOTER  | yellow  | `lib/engines/asteroids.ts`  | No    | [05](../specs/05-asteroids-game.md)                                                  | `started-games/02-asteroids`  |

## ARKANOID

- **Short:** Bounce the ball and smash the bricks.
- **Description:** Slide your paddle with the mouse or the arrow keys and keep the ball in play to
  break every brick. Five levels, each with its own brick pattern and a faster ball. Clear all five
  to win, but you only have three lives.
- **Controls:** ← → / MOUSE MOVE · P PAUSE
- **Cover:** `cover-bricks`
- **Notes:** replaced the BLOCK BUSTER placeholder (`replace_block_buster_with_arkanoid`). Levels in
  `lib/engines/arkanoid-levels.ts`. Only game with sound.

## TETRIS

- **Short:** Fit the falling pieces and clear lines.
- **Description:** Seven classic tetrominoes and a hollow nut piece fall into a 10×20 well. Slide,
  rotate and drop them — a ghost shows where each one lands — and clear lines to score. Every 10
  lines the level rises and the pieces fall faster.
- **Controls:** ← → MOVE · ↑ ROTATE · ↓ SOFT DROP · SPACE DROP · P PAUSE
- **Cover:** `cover-tetro`
- **Notes:** replaced the FALLDOWN placeholder (`replace_falldown_with_tetris`).

## SNAKE

- **Short:** Eat the fruit, grow longer, don't bite yourself.
- **Description:** Steer a neon snake around a 32×24 grid and eat the fruit that appears one at a
  time. Each fruit adds a segment and points, and every five fruits the level rises and the snake
  speeds up. Hit a wall or your own tail and the run is over.
- **Controls:** ← ↑ → ↓ / WASD STEER · P PAUSE
- **Cover:** `cover-snake`
- **Notes:** replaced the SERPENTINE placeholder (`replace_serpentine_with_snake`).

## ASTEROIDS

- **Short:** Split asteroids into dust in zero gravity.
- **Description:** Your triangular ship drifts through a wrap-around asteroid field. Rotate, thrust
  and fire to split big rocks into medium and small fragments. Grab the 3X core for a few seconds of
  triple shot, and clear the field to warp to the next level.
- **Controls:** ← → ROTATE · ↑ THRUST · SPACE FIRE · P PAUSE
- **Cover:** `cover-rocas`
- **Notes:** first real engine; kept its original catalog row from `create_games`.

## Still placeholders

These rows exist in the `games` table but have no engine; the player runs a simulated score and
cannot save it.

| Order | Id           | Title      | Category |
| ----- | ------------ | ---------- | -------- |
| 4     | `glutton`    | GLUTTON    | ARCADE   |
| 5     | `invaders`   | INVADERS   | SHOOTER  |
| 7     | `froggeria`  | FROGGERIA  | ARCADE   |
| 8     | `pixel-duel` | PIXEL DUEL | VERSUS   |
