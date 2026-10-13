create table public.games (
  id         text primary key check (id ~ '^[a-z0-9-]+$'),
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null check (cover like 'cover-%'),
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order int  not null unique,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy "games are public" on public.games for select to anon, authenticated using (true);

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('block-buster', 'BLOCK BUSTER', 'Bounce the ball and smash neon walls.', 'Pilot a paddle-ship and bounce a plasma core to pulverize walls of chromatic blocks. Every level rearranges the grid into impossible patterns. How far will your streak go?', 'ARCADE', 'cover-bricks', 'cyan', 1),
  ('falldown', 'FALLDOWN', 'Fit the pieces before the ceiling crushes you.', 'Geometric pieces fall out of the darkness. Rotate them, lock them in and clear lines to survive. The speed ramps up mercilessly every 10 lines.', 'PUZZLE', 'cover-tetro', 'magenta', 2),
  ('serpentine', 'SERPENTINE', 'Grow without biting your own tail.', 'A serpent of light sweeps the grid hunting magenta cores. Every bite makes it longer and faster. One wrong move and it devours itself.', 'ARCADE', 'cover-snake', 'green', 3),
  ('glutton', 'GLUTTON', 'Gobble dots and escape the ghosts.', 'A hungry circle patrols a maze collecting glowing dots. Four specters chase it, but every so often a pill appears that turns the tables.', 'ARCADE', 'cover-glot', 'yellow', 4),
  ('invaders', 'INVADERS', 'Defend the planet from alien rows.', 'Waves of hostile pixels descend formation after formation. Slide your cannon sideways and fire with precision before they touch the surface.', 'SHOOTER', 'cover-invaders', 'green', 5),
  ('asteroids', 'ASTEROIDS', 'Split asteroids into dust in zero gravity.', 'Your triangular ship drifts through a wrap-around asteroid field. Rotate, thrust and fire to split big rocks into medium and small fragments. Grab the 3X core for a few seconds of triple shot, and clear the field to warp to the next level.', 'SHOOTER', 'cover-rocas', 'yellow', 6),
  ('froggeria', 'FROGGERIA', 'Cross the pixel highway.', 'Hop between lanes of speeding cars and logs drifting down the river. Reach the lily pads before time runs out.', 'ARCADE', 'cover-rana', 'green', 7),
  ('pixel-duel', 'PIXEL DUEL', 'Two paddles. One ball. Maximum reflexes.', 'The purest duel: two vertical paddles face off to bounce a glowing ball. Solo mode against the CPU or a local two-player match.', 'VERSUS', 'cover-duelo', 'cyan', 8);
