-- Fase 3 — programas de treino.
-- Rode depois de 0004_touch_updated_at_search_path.sql.
--
-- Prescrição, não execução: estas três tabelas guardam o plano. O que
-- aconteceu de fato entra em workout_sessions e sets, na Fase 4.

-- ------------------------------------------------------------------
-- routines — o programa
-- ------------------------------------------------------------------

create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 300),
  -- O programa que vale hoje. O usuário monta o próximo bloco antes de
  -- abandonar o atual, então várias rotinas convivem e só uma é a ativa.
  is_active   boolean not null default false,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Arquivar tira de circulação; não faz sentido continuar valendo.
  constraint routines_archived_not_active check (not (is_active and archived_at is not null))
);

create index routines_user_idx on public.routines (user_id);

-- No máximo uma rotina ativa por usuário.
create unique index routines_one_active_idx
  on public.routines (user_id) where is_active and archived_at is null;

-- ------------------------------------------------------------------
-- routine_days — o dia dentro do programa
-- ------------------------------------------------------------------

create table public.routine_days (
  id                uuid primary key default gen_random_uuid(),
  routine_id        uuid not null references public.routines(id) on delete cascade,
  name              text not null check (length(btrim(name)) between 1 and 60),
  -- Sequência, não calendário: quem treina em dias variáveis só percorre a
  -- ordem. suggested_weekday é dica para quem tem rotina fixa. 0 = domingo.
  position          integer not null check (position >= 0),
  suggested_weekday integer check (suggested_weekday between 0 and 6),
  notes             text check (notes is null or length(notes) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Não é único de propósito: reordenar com unicidade quebra no meio da
-- troca, e cada chamada do supabase-js é uma transação separada, então
-- deferrable não ajudaria. A reordenação reescreve a lista inteira num
-- upsert só, e a leitura desempata por (position, id).
create index routine_days_order_idx on public.routine_days (routine_id, position);

-- ------------------------------------------------------------------
-- routine_exercises — a prescrição
-- ------------------------------------------------------------------

create table public.routine_exercises (
  id             uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.routine_days(id) on delete cascade,
  -- RESTRICT, nunca CASCADE: o banco recusa apagar exercício já prescrito.
  -- A exclusão lógica por archived_at é a regra de produto; isto é a trava.
  exercise_id    uuid not null references public.exercises(id) on delete restrict,
  position       integer not null check (position >= 0),
  target_sets    integer not null default 3 check (target_sets between 1 and 10),
  -- Faixa de repetições: a progressão dupla da Fase 5 decide a partir dela.
  rep_min        integer not null check (rep_min between 1 and 100),
  rep_max        integer not null check (rep_max between 1 and 100),
  target_rir     integer check (target_rir between 0 and 5),
  rest_seconds   integer not null default 120 check (rest_seconds between 15 and 600),
  -- Nulo = usa exercises.load_step_kg. O incremento é propriedade física do
  -- equipamento, mas a mesma máquina tem anilhas diferentes em academias
  -- diferentes, e um exercício pode aparecer em duas rotinas com progressão
  -- distinta.
  load_step_kg_override numeric(5,2)
    check (load_step_kg_override is null
           or (load_step_kg_override > 0 and load_step_kg_override <= 25)),
  -- Mesmo valor no mesmo dia forma um superset. A Fase 3 deixa sempre nulo e
  -- não expõe na interface; a coluna nasce agora porque a Fase 4 precisa
  -- agrupar, e descobrir isso lá obrigaria a mexer em schema e editor juntos.
  superset_group text check (superset_group is null
                             or length(btrim(superset_group)) between 1 and 8),
  notes          text check (notes is null or length(notes) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint routine_exercises_rep_range check (rep_min <= rep_max)
);

create index routine_exercises_order_idx on public.routine_exercises (routine_day_id, position);

-- Sem este índice, todo DELETE em exercises vira varredura sequencial aqui
-- para verificar o RESTRICT.
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id);

-- ------------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------------

create trigger routines_touch_updated_at
  before update on public.routines
  for each row execute function public.touch_updated_at();

create trigger routine_days_touch_updated_at
  before update on public.routine_days
  for each row execute function public.touch_updated_at();

create trigger routine_exercises_touch_updated_at
  before update on public.routine_exercises
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;

create policy "rotinas: leitura das proprias"
  on public.routines for select to authenticated
  using (user_id = auth.uid());

create policy "rotinas: criar proprias"
  on public.routines for insert to authenticated
  with check (user_id = auth.uid());

create policy "rotinas: editar proprias"
  on public.routines for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Existe DELETE porque duplicar um programa são três inserções sem
-- transação: se a segunda falhar, a action apaga a rotina órfã. A proteção
-- do histórico virá do RESTRICT que workout_sessions deve usar ao apontar
-- para routine_days, na Fase 4.
create policy "rotinas: apagar proprias"
  on public.routines for delete to authenticated
  using (user_id = auth.uid());

create policy "dias: tudo dentro das rotinas proprias"
  on public.routine_days for all to authenticated
  using (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ));

-- Além de ser dono da rotina, o exercício prescrito precisa ser legível:
-- catálogo global ou personalizado do próprio usuário. Sem isso daria para
-- prescrever o exercício privado de outro e travar o RESTRICT dele.
create policy "prescricao: tudo dentro das rotinas proprias"
  on public.routine_exercises for all to authenticated
  using (exists (
    select 1 from public.routine_days d
    join public.routines r on r.id = d.routine_id
    where d.id = routine_day_id and r.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = routine_day_id and r.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
    )
  );
