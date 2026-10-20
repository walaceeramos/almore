-- Fase 6 — histórico: excluir treino concluído.
-- Rode depois de 0007_personal_records.sql.
--
-- A 0006 só deixava apagar sessão em andamento ("treino concluído é
-- histórico e não sai pelo app"). O histórico da Fase 6 precisa de saída
-- para o treino registrado por engano, então a regra passa a valer para
-- qualquer sessão do próprio usuário. O app pede confirmação em dois
-- toques e recalcula os recordes dos exercícios depois.
--
-- O cascade leva session_exercises, sets e os personal_records que
-- apontavam para a sessão. O RESTRICT em exercises não é afetado: ele
-- protege o exercício, não a sessão.

drop policy "sessoes: descartar em andamento" on public.workout_sessions;

create policy "sessoes: apagar proprias"
  on public.workout_sessions for delete to authenticated
  using (user_id = auth.uid());
