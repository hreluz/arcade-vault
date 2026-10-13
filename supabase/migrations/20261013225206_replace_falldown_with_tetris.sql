delete from public.games where id = 'falldown';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('tetris', 'TETRIS', 'Fit the falling pieces and clear lines.', 'Seven classic tetrominoes and a hollow nut piece fall into a 10×20 well. Slide, rotate and drop them — a ghost shows where each one lands — and clear lines to score. Every 10 lines the level rises and the pieces fall faster.', 'PUZZLE', 'cover-tetro', 'magenta', 2);
