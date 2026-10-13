delete from public.games where id = 'block-buster';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('arkanoid', 'ARKANOID', 'Bounce the ball and smash the bricks.', 'Slide your paddle with the mouse or the arrow keys and keep the ball in play to break every brick. Five levels, each with its own brick pattern and a faster ball. Clear all five to win, but you only have three lives.', 'ARCADE', 'cover-bricks', 'cyan', 1);
