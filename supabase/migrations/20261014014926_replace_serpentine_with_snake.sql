delete from public.games where id = 'serpentine';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('snake', 'SNAKE', 'Eat the fruit, grow longer, don''t bite yourself.', 'Steer a neon snake around a 32×24 grid and eat the fruit that appears one at a time. Each fruit adds a segment and points, and every five fruits the level rises and the snake speeds up. Hit a wall or your own tail and the run is over.', 'ARCADE', 'cover-snake', 'green', 3);
