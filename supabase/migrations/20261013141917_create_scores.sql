create table public.scores (
  id         bigint generated always as identity primary key,
  game_id    text not null references public.games(id) on delete cascade,
  name       text not null check (name ~ '^[A-Z0-9_]{1,10}$'),
  score      int  not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index scores_board_idx on public.scores (game_id, score desc, created_at asc);
alter table public.scores enable row level security;
create policy "scores are public" on public.scores for select to anon, authenticated using (true);
create policy "anyone can submit a score" on public.scores for insert to anon, authenticated with check (true);

create view public.game_best_scores with (security_invoker = true) as
  select game_id, max(score) as best from public.scores group by game_id;
