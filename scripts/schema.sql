-- Chroma Rush tables. Already applied to the Neon database; kept for reference and fresh setups.
-- Run one statement at a time.

create table if not exists players (
  id text primary key,
  display_name text not null,
  username text,
  source text not null default 'guest',
  best_score integer not null default 0,
  best_distance integer not null default 0,
  best_time_ms integer not null default 0,
  total_games integer not null default 0,
  total_crystals integer not null default 0,
  total_distance bigint not null default 0,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

create table if not exists game_runs (
  id text primary key,
  player_id text not null,
  score integer not null,
  distance integer not null,
  crystals integer not null,
  duration_ms integer not null,
  seed integer not null,
  lives_used integer not null default 0,
  valid boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists players_best_score_idx on players (best_score desc, created_at);
create index if not exists game_runs_daily_idx on game_runs (created_at desc) where valid;
create index if not exists game_runs_player_idx on game_runs (player_id, created_at desc);
