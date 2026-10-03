-- Fase 2 — catálogo de exercícios.
-- Rode depois de 0001_profiles.sql.

create type movement_pattern as enum (
  'empurrar_horizontal', 'empurrar_vertical', 'puxar_horizontal', 'puxar_vertical',
  'agachamento', 'dobradica_quadril', 'extensao_joelho', 'flexao_joelho',
  'isolador', 'core', 'carregamento'
);

create type equipment_kind as enum (
  'barra', 'halter', 'maquina', 'cabo', 'peso_corporal', 'kettlebell', 'elastico', 'outro'
);

create type muscle_role as enum ('primario', 'secundario');

create table public.muscles (
  id          text primary key,
  name        text    not null,
  region      text    not null,
  sort_order  integer not null default 0
);

create table public.exercises (
  id                   uuid primary key default gen_random_uuid(),
  -- Nulo = exercício global do catálogo. Preenchido = personalizado do usuário.
  owner_id             uuid references auth.users(id) on delete cascade,
  slug                 text unique,
  name                 text not null check (length(btrim(name)) between 2 and 80),
  pattern              movement_pattern not null,
  equipment            equipment_kind   not null,
  is_unilateral        boolean not null default false,
  default_rest_seconds integer not null default 120 check (default_rest_seconds between 15 and 600),
  load_step_kg         numeric(5,2) not null default 2.5 check (load_step_kg > 0 and load_step_kg <= 25),
  cue                  text check (cue is null or length(cue) <= 400),
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Exercício global precisa de slug; personalizado não usa slug.
  constraint exercises_slug_scope check ((owner_id is null) = (slug is not null))
);

create index exercises_owner_idx on public.exercises (owner_id);
create index exercises_pattern_idx on public.exercises (pattern);
create index exercises_equipment_idx on public.exercises (equipment);
-- Busca por nome sem depender de extensão extra.
create index exercises_name_idx on public.exercises (lower(name));
-- Um usuário não repete o nome de um exercício próprio.
create unique index exercises_owner_name_idx
  on public.exercises (owner_id, lower(name)) where owner_id is not null;

create table public.exercise_muscles (
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  muscle_id    text not null references public.muscles(id),
  role         muscle_role not null,
  contribution numeric(3,2) not null default 1.00 check (contribution > 0 and contribution <= 1),
  primary key (exercise_id, muscle_id)
);

create index exercise_muscles_muscle_idx on public.exercise_muscles (muscle_id);

create trigger exercises_touch_updated_at
  before update on public.exercises
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.muscles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_muscles enable row level security;

-- Tabela de referência: qualquer autenticado lê, ninguém escreve pelo app.
create policy "musculos: leitura autenticada"
  on public.muscles for select to authenticated using (true);

-- Catálogo global é legível por todos; o personalizado só pelo dono.
create policy "exercicios: leitura do catalogo e dos proprios"
  on public.exercises for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

create policy "exercicios: criar apenas proprios"
  on public.exercises for insert to authenticated
  with check (owner_id = auth.uid() and slug is null);

create policy "exercicios: editar apenas proprios"
  on public.exercises for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "exercicios: apagar apenas proprios"
  on public.exercises for delete to authenticated
  using (owner_id = auth.uid());

-- Vínculo muscular acompanha a permissão do exercício dono.
create policy "vinculo muscular: leitura"
  on public.exercise_muscles for select to authenticated
  using (exists (
    select 1 from public.exercises e
    where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
  ));

create policy "vinculo muscular: escrita nos proprios"
  on public.exercise_muscles for all to authenticated
  using (exists (
    select 1 from public.exercises e where e.id = exercise_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.exercises e where e.id = exercise_id and e.owner_id = auth.uid()
  ));
