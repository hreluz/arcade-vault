delete from public.games where id = 'froggeria';

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  ('frogger', 'FROGGER', 'Cross the road and river without getting squashed.', 'Guide your frog across a road packed with cars and a river full of floating logs and turtles. Fill the five goal slots on the other side to complete the round; each level speeds up traffic and shortens the time limit. Three lives and plenty of asphalt ahead.', 'ARCADE', 'cover-rana', 'green', 7);
