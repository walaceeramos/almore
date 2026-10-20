-- Fase 5 — recordes pessoais.
-- Rode depois de 0006_sessions.sql.
--
-- Derivado, não fonte: os recordes são recalculados do zero a partir de
-- `sets` (core/domain/records.ts) sempre que uma sessão é concluída. A
-- tabela existe para o detalhe do exercício e o resumo não precisarem
-- varrer o histórico inteiro a cada leitura. Se ela e as séries
-- divergirem, as séries mandam.
--
-- Volume e consistência não têm tabela: são calculados das séries na hora,
-- como manda o planejamento.

create type public.record_kind as enum ('carga_maxima', 'melhor_serie', 'volume_serie', 'volume_sessao');

create table public.personal_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- RESTRICT, como toda FK para exercises.
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  kind        public.record_kind not null,
  -- carga_maxima e melhor_serie em kg; os dois volumes em kg × repetições.
  value       numeric(10,2) not null check (value > 0),
  -- Série de origem. CASCADE: apagar a série apaga o recorde, e o próximo
  -- recálculo encontra o novo. Nulo só em volume_sessao, que é da sessão.
  set_id      uuid references public.sets(id) on delete cascade,
  session_id  uuid not null references public.workout_sessions(id) on delete cascade,
  -- Carga e repetições da série de origem, para a tela mostrar "100 kg × 5"
  -- e marcar 1RM acima de 12 repetições como estimativa fraca.
  weight_kg   numeric(6,2) not null check (weight_kg >= 0),
  reps        integer not null check (reps between 1 and 100),
  achieved_at timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Um recorde atual por exercício e tipo. É o alvo do upsert do recálculo.
  constraint personal_records_one_per_kind unique (user_id, exercise_id, kind),
  constraint personal_records_set_iff_set_kind check ((kind = 'volume_sessao') = (set_id is null))
);

-- O índice único já começa por user_id. Estes servem o RESTRICT em
-- exercises e os CASCADE vindos de sets e workout_sessions.
create index personal_records_exercise_idx on public.personal_records (exercise_id);
create index personal_records_set_idx on public.personal_records (set_id);
create index personal_records_session_idx on public.personal_records (session_id);

create trigger personal_records_touch_updated_at
  before update on public.personal_records
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.personal_records enable row level security;

create policy "recordes: leitura dos proprios"
  on public.personal_records for select to authenticated
  using (user_id = auth.uid());

-- O recálculo grava como o próprio usuário. A sessão de origem precisa ser
-- dele e o exercício precisa ser legível, pelo mesmo motivo das outras
-- tabelas que apontam para exercises.
create policy "recordes: gravar proprios"
  on public.personal_records for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
    )
  );
