-- Fase 1 — perfis de usuário, RLS e criação automática de perfil.
-- Rode este arquivo inteiro no SQL Editor do Supabase.

create type unit_system as enum ('metric', 'imperial');
create type goal_focus as enum ('hipertrofia', 'forca', 'emagrecimento', 'recomposicao', 'saude');
create type experience_level as enum ('iniciante', 'intermediario', 'avancado');

create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text         not null,
  birth_date          date,
  height_cm           integer      check (height_cm between 80 and 260),
  starting_weight_kg  numeric(6,2) check (starting_weight_kg between 20 and 400),
  focus               goal_focus,
  level               experience_level,
  weekly_target       integer      not null default 3 check (weekly_target between 1 and 7),
  units               unit_system  not null default 'metric',
  timezone            text         not null default 'America/Sao_Paulo',
  onboarded_at        timestamptz,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- Negar por padrão. Cada política abaixo é uma exceção explícita.
alter table public.profiles enable row level security;

create policy "perfil proprio: leitura"
  on public.profiles for select
  using (auth.uid() = id);

create policy "perfil proprio: atualizacao"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "perfil proprio: criacao"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Sem política de delete: o perfil só some junto com a conta, por cascade.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Cria o perfil no mesmo instante em que a conta nasce, para que nunca
-- exista usuário autenticado sem linha correspondente em profiles.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
