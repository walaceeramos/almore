-- Correção — fixa o search_path de touch_updated_at.
--
-- A função dispara nos triggers de profiles e de exercises. Sem search_path
-- declarado, o caminho de resolução de nomes vem de quem executa a
-- instrução, o que torna o corpo sensível a um schema plantado na frente
-- do public. É o aviso function_search_path_mutable do linter do Supabase.
-- handle_new_user, na 0001, já nasceu com search_path fixo; esta não.
--
-- search_path vazio é o mais estrito. `now()` continua resolvendo porque
-- pg_catalog é sempre pesquisado antes do caminho declarado.
--
-- `create or replace` preserva os triggers: eles referenciam a função pelo
-- identificador, não pelo corpo. Não editar a 0001, que já foi aplicada.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
