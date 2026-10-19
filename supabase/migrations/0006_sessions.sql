-- Fase 4 — execução do treino.
-- Rode depois de 0005_routines.sql.
--
-- Execução, não prescrição: estas três tabelas guardam o que aconteceu.
-- O plano continua em routines, routine_days e routine_exercises, e a
-- sessão copia dele o que vigorava no dia — editar o programa depois não
-- pode reescrever o passado.

create type public.session_status as enum ('em_andamento', 'concluida');
create type public.set_kind as enum ('aquecimento', 'trabalho');

-- ------------------------------------------------------------------
-- workout_sessions — o treino feito
-- ------------------------------------------------------------------

create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- SET NULL, e não o RESTRICT que o comentário da 0005 previa: o editor
  -- apaga dias de verdade (removeDay), e RESTRICT faria a remoção de um dia
  -- já treinado falhar. A sessão não perde nada com isso, porque o título e
  -- a prescrição estão copiados nela. Perde só o vínculo com o plano.
  routine_id       uuid references public.routines(id) on delete set null,
  routine_day_id   uuid references public.routine_days(id) on delete set null,
  -- "Nome do programa · Nome do dia" no momento do início.
  title_snapshot   text not null check (length(btrim(title_snapshot)) between 1 and 130),
  status           public.session_status not null default 'em_andamento',
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  -- Percepção de esforço da sessão inteira, de 1 a 10.
  perceived_effort integer check (perceived_effort between 1 and 10),
  notes            text check (notes is null or length(notes) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint workout_sessions_finished_iff_done
    check ((status = 'concluida') = (finished_at is not null)),
  constraint workout_sessions_finished_after_start
    check (finished_at is null or finished_at >= started_at)
);

create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

-- No máximo uma sessão em andamento por usuário. Mesmo padrão da rotina ativa.
create unique index workout_sessions_one_open_idx
  on public.workout_sessions (user_id) where status = 'em_andamento';

-- Sem estes índices, apagar um dia ou um programa varre a tabela inteira
-- para aplicar o SET NULL.
create index workout_sessions_routine_idx on public.workout_sessions (routine_id);
create index workout_sessions_routine_day_idx on public.workout_sessions (routine_day_id);

-- ------------------------------------------------------------------
-- session_exercises — o exercício dentro da sessão, com o snapshot
-- ------------------------------------------------------------------

create table public.session_exercises (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.workout_sessions(id) on delete cascade,
  -- RESTRICT, nunca CASCADE: o banco recusa apagar exercício com histórico.
  exercise_id         uuid not null references public.exercises(id) on delete restrict,
  -- De onde veio a prescrição. Nulo quando o exercício foi acrescentado
  -- durante a sessão, ou quando a prescrição foi removida do programa.
  routine_exercise_id uuid references public.routine_exercises(id) on delete set null,
  position            integer not null check (position >= 0),
  -- Snapshot da prescrição. As três colunas de alvo são nulas juntas: o
  -- exercício acrescentado na hora não tem prescrição, e inventar uma
  -- contaminaria a progressão da Fase 5.
  target_sets         integer check (target_sets between 1 and 10),
  rep_min             integer check (rep_min between 1 and 100),
  rep_max             integer check (rep_max between 1 and 100),
  target_rir          integer check (target_rir between 0 and 5),
  -- Sempre preenchidos: o cronômetro e o passo do peso precisam deles.
  rest_seconds        integer not null check (rest_seconds between 15 and 600),
  -- Incremento já resolvido (override da prescrição ou o do exercício).
  load_step_kg        numeric(5,2) not null check (load_step_kg > 0 and load_step_kg <= 25),
  notes               text check (notes is null or length(notes) <= 300),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint session_exercises_targets_together check (
    (target_sets is null) = (rep_min is null) and (rep_min is null) = (rep_max is null)
  ),
  constraint session_exercises_rep_range check (rep_min is null or rep_min <= rep_max)
);

create index session_exercises_order_idx on public.session_exercises (session_id, position);
-- Serve o RESTRICT em exercises e a busca do "última vez".
create index session_exercises_exercise_idx on public.session_exercises (exercise_id, created_at desc);
create index session_exercises_routine_exercise_idx on public.session_exercises (routine_exercise_id);

-- ------------------------------------------------------------------
-- sets — a série feita
-- ------------------------------------------------------------------

-- Uma linha é uma série concluída. As que faltam são a diferença entre
-- target_sets e as linhas existentes; não se criam linhas vazias.
create table public.sets (
  -- Gerado no cliente: registrar a mesma série duas vezes (toque duplo,
  -- nova tentativa após timeout) cai no mesmo id e não duplica. É também o
  -- que a fila offline da Fase 9 vai precisar.
  id                  uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number          integer not null check (set_number >= 1),
  kind                public.set_kind not null default 'trabalho',
  -- Nulo = só o peso do corpo. Preenchido em exercício de peso corporal é a
  -- carga adicional.
  weight_kg           numeric(6,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 999.99)),
  reps                integer not null check (reps between 0 and 100),
  rir                 integer check (rir between 0 and 10),
  completed_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Não é único, pelo mesmo motivo de routine_days.position: renumerar após
-- remover uma série quebraria no meio da troca.
create index sets_order_idx on public.sets (session_exercise_id, set_number);

-- ------------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------------

create trigger workout_sessions_touch_updated_at
  before update on public.workout_sessions
  for each row execute function public.touch_updated_at();

create trigger session_exercises_touch_updated_at
  before update on public.session_exercises
  for each row execute function public.touch_updated_at();

create trigger sets_touch_updated_at
  before update on public.sets
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.workout_sessions enable row level security;
alter table public.session_exercises enable row level security;
alter table public.sets enable row level security;

create policy "sessoes: leitura das proprias"
  on public.workout_sessions for select to authenticated
  using (user_id = auth.uid());

-- O dia e o programa apontados precisam ser do próprio usuário. Sem isso
-- daria para pendurar uma sessão no programa de outro.
create policy "sessoes: criar proprias"
  on public.workout_sessions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (routine_id is null or exists (
      select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid()
    ))
    and (routine_day_id is null or exists (
      select 1 from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = routine_day_id and r.user_id = auth.uid()
    ))
  );

-- Sessão concluída continua editável: a Fase 6 edita o passado.
create policy "sessoes: editar proprias"
  on public.workout_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Descartar apaga de verdade, mas só enquanto está em andamento. Treino
-- concluído é histórico e não sai pelo app.
create policy "sessoes: descartar em andamento"
  on public.workout_sessions for delete to authenticated
  using (user_id = auth.uid() and status = 'em_andamento');

-- Mesmo cuidado de routine_exercises: o exercício precisa ser legível,
-- senão daria para usar o exercício privado de outro e travar o RESTRICT.
create policy "exercicios da sessao: tudo dentro das sessoes proprias"
  on public.session_exercises for all to authenticated
  using (exists (
    select 1 from public.workout_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
    )
    and (routine_exercise_id is null or exists (
      select 1 from public.routine_exercises re
      join public.routine_days d on d.id = re.routine_day_id
      join public.routines r on r.id = d.routine_id
      where re.id = routine_exercise_id and r.user_id = auth.uid()
    ))
  );

create policy "series: tudo dentro das sessoes proprias"
  on public.sets for all to authenticated
  using (exists (
    select 1 from public.session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    where se.id = session_exercise_id and s.user_id = auth.uid()
  ));
