"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2, Settings2, X } from "lucide-react";
import type { RoutineDetail, RoutineDayDetail, PrescribedExercise } from "@/features/routines/queries";
import {
  addDay,
  removeDay,
  reorderDays,
  addExercise,
  removeExercise,
  reorderExercises,
  updateDay,
  updatePrescription,
} from "@/features/routines/actions";
import type { RoutineActionState } from "@/features/routines/schemas";
import { WEEKDAYS, repRangeLabel } from "@/features/routines/labels";
import { restLabel } from "@/features/exercises/labels";
import { kg } from "@/core/utils/format";
import { ExercisePicker, type PickableExercise } from "@/components/exercise-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

function paraFormData(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) {
    if (Array.isArray(valor)) valor.forEach((v) => fd.append(chave, v));
    else fd.set(chave, valor);
  }
  return fd;
}

/** Chama uma Server Action de botão sem travar a interface inteira. */
function useAcao() {
  const [pendente, startTransition] = useTransition();
  function executar(action: (fd: FormData) => Promise<void>, campos: Record<string, string | string[]>) {
    startTransition(() => void action(paraFormData(campos)));
  }
  return { pendente, executar };
}

/**
 * Para as ações que gravam formulário. O editor salva a cada operação, sem
 * botão de salvar no fim, então uma falha precisa aparecer: o estado local
 * continuaria exibindo o valor novo, e o usuário sairia achando que gravou.
 */
function useAcaoComErro() {
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function executar(
    action: (prev: RoutineActionState, fd: FormData) => Promise<RoutineActionState>,
    campos: Record<string, string | string[]>,
    aoConcluir?: () => void,
  ) {
    startTransition(async () => {
      const estado = await action({}, paraFormData(campos));
      const primeiroCampo = Object.values(estado.fieldErrors ?? {})[0]?.[0];
      const mensagem = estado.error ?? primeiroCampo ?? null;
      setErro(mensagem);
      if (!mensagem) aoConcluir?.();
    });
  }

  return { pendente, erro, executar };
}

function AvisoErro({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="mt-2 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
      {mensagem}
    </p>
  );
}

/* ------------------------------------------------------------------ *
 * Prescrição de um exercício
 * ------------------------------------------------------------------ */

function Prescricao({
  item,
  primeiro,
  ultimo,
  onMover,
  onRemover,
}: {
  item: PrescribedExercise;
  primeiro: boolean;
  ultimo: boolean;
  onMover: (direcao: -1 | 1) => void;
  onRemover: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const { erro, executar } = useAcaoComErro();

  const [sets, setSets] = useState(item.targetSets);
  const [repMin, setRepMin] = useState(item.repMin);
  const [repMax, setRepMax] = useState(item.repMax);
  const [rir, setRir] = useState(item.targetRir);
  const [descanso, setDescanso] = useState(item.restSeconds);
  const [incremento, setIncremento] = useState<number | null>(
    item.loadStepKgOverride === null ? null : Number(item.loadStepKgOverride),
  );

  const faixaInvalida = repMin > repMax;

  function salvar() {
    if (faixaInvalida) return;
    executar(
      updatePrescription,
      {
        id: item.id,
        targetSets: String(sets),
        repMin: String(repMin),
        repMax: String(repMax),
        targetRir: rir === null ? "" : String(rir),
        restSeconds: String(descanso),
        loadStepKgOverride: incremento === null ? "" : String(incremento),
      },
      // Só fecha o painel quando gravou: com erro, o valor digitado fica à vista.
      () => setAberto(false),
    );
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={primeiro}
            aria-label={`Subir ${item.exerciseName}`}
            className="flex h-6 w-9 items-center justify-center rounded-t text-muted hover:bg-raised disabled:opacity-30"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={ultimo}
            aria-label={`Descer ${item.exerciseName}`}
            className="flex h-6 w-9 items-center justify-center rounded-b text-muted hover:bg-raised disabled:opacity-30"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">{item.exerciseName}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {sets} × {repRangeLabel(repMin, repMax)} · {restLabel(descanso)}
            {rir !== null && ` · RIR ${rir}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={`Ajustar ${item.exerciseName}`}
          className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised"
        >
          <Settings2 className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onRemover}
          aria-label={`Remover ${item.exerciseName}`}
          className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised hover:text-bad"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {aberto && (
        <div className="mt-3 space-y-3 rounded border border-line bg-ink p-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberStepper label="Séries" name="targetSets" value={sets} onChange={setSets} min={1} max={10} />
            <NumberStepper
              label="Descanso"
              name="restSeconds"
              value={descanso}
              onChange={setDescanso}
              min={15}
              max={600}
              step={15}
              unit="s"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberStepper label="Repetições mín." name="repMin" value={repMin} onChange={setRepMin} min={1} max={100} />
            <NumberStepper
              label="Repetições máx."
              name="repMax"
              value={repMax}
              onChange={setRepMax}
              min={1}
              max={100}
              errors={faixaInvalida ? ["O máximo não pode ser menor que o mínimo"] : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberStepper
              label="RIR alvo"
              name="targetRir"
              value={rir ?? 2}
              onChange={setRir}
              min={0}
              max={5}
              hint="Repetições em reserva"
            />
            <NumberStepper
              label="Incremento"
              name="loadStepKgOverride"
              value={incremento ?? item.loadStepKg}
              onChange={setIncremento}
              min={0.25}
              max={25}
              step={0.25}
              unit="kg"
              hint={incremento === null ? `Herdado: ${kg(item.loadStepKg)} kg` : "Ajustado para este programa"}
            />
          </div>

          {incremento !== null && (
            <button
              type="button"
              onClick={() => setIncremento(null)}
              className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
            >
              <X className="size-3" aria-hidden />
              Voltar ao incremento do exercício
            </button>
          )}

          <AvisoErro mensagem={erro} />

          <div className="flex gap-2 pt-1">
            <Button type="button" onClick={salvar} disabled={faixaInvalida}>
              Salvar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Um dia
 * ------------------------------------------------------------------ */

function Dia({
  dia,
  primeiro,
  ultimo,
  podeRemover,
  exercicios,
  onMoverDia,
}: {
  dia: RoutineDayDetail;
  primeiro: boolean;
  ultimo: boolean;
  podeRemover: boolean;
  exercicios: PickableExercise[];
  onMoverDia: (direcao: -1 | 1) => void;
}) {
  const { executar } = useAcao();
  const { erro: erroDia, executar: salvarCampos } = useAcaoComErro();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState(dia.name);
  const [diaSemana, setDiaSemana] = useState(dia.suggestedWeekday);

  function salvarDia() {
    salvarCampos(
      updateDay,
      {
        id: dia.id,
        name: nome.trim() || dia.name,
        suggestedWeekday: diaSemana === null ? "" : String(diaSemana),
      },
      () => setEditandoNome(false),
    );
  }

  function moverExercicio(index: number, direcao: -1 | 1) {
    const ids = dia.exercises.map((e) => e.id);
    const destino = index + direcao;
    if (destino < 0 || destino >= ids.length) return;
    const a = ids[index];
    const b = ids[destino];
    if (!a || !b) return;
    ids[index] = b;
    ids[destino] = a;
    executar(reorderExercises, { ids });
  }

  return (
    <section className="rounded border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMoverDia(-1)}
            disabled={primeiro}
            aria-label={`Subir ${dia.name}`}
            className="flex h-6 w-9 items-center justify-center rounded-t text-muted hover:bg-raised disabled:opacity-30"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMoverDia(1)}
            disabled={ultimo}
            aria-label={`Descer ${dia.name}`}
            className="flex h-6 w-9 items-center justify-center rounded-b text-muted hover:bg-raised disabled:opacity-30"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>

        {editandoNome ? (
          <div className="flex-1 space-y-2 py-1">
            <Field label="Nome do dia" name={`nome-${dia.id}`} value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} />
            <div className="space-y-1.5">
              <label htmlFor={`weekday-${dia.id}`} className="block text-sm text-muted">
                Dia da semana sugerido
              </label>
              <select
                id={`weekday-${dia.id}`}
                value={diaSemana === null ? "" : String(diaSemana)}
                onChange={(e) => setDiaSemana(e.target.value === "" ? null : Number(e.target.value))}
                className="min-h-11 w-full rounded border border-line bg-surface px-3 text-[16px]"
              >
                <option value="">Sem sugestão</option>
                {WEEKDAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-faint">É só uma dica. O programa continua sendo uma sequência.</p>
            </div>
            <AvisoErro mensagem={erroDia} />
            <div className="flex gap-2">
              <Button type="button" onClick={salvarDia}>
                Salvar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNome(dia.name);
                  setDiaSemana(dia.suggestedWeekday);
                  setEditandoNome(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditandoNome(true)}
              className="min-w-0 flex-1 py-2 text-left"
            >
              <span className="block truncate font-condensed text-lg font-semibold">{dia.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {dia.exercises.length} {dia.exercises.length === 1 ? "exercício" : "exercícios"}
                {dia.suggestedWeekday !== null &&
                  ` · ${WEEKDAYS.find((d) => d.value === dia.suggestedWeekday)?.label}`}
                {" · tocar para renomear"}
              </span>
            </button>
            {podeRemover && (
              <button
                type="button"
                onClick={() => executar(removeDay, { id: dia.id })}
                aria-label={`Remover ${dia.name}`}
                className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised hover:text-bad"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </>
        )}
      </header>

      {dia.exercises.length === 0 ? (
        <p className="px-4 py-4 text-sm text-faint">Nenhum exercício. Adicione o primeiro abaixo.</p>
      ) : (
        <ul className="divide-y divide-line">
          {dia.exercises.map((e, i) => (
            <Prescricao
              key={e.id}
              item={e}
              primeiro={i === 0}
              ultimo={i === dia.exercises.length - 1}
              onMover={(d) => moverExercicio(i, d)}
              onRemover={() => executar(removeExercise, { id: e.id })}
            />
          ))}
        </ul>
      )}

      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={() => setSeletorAberto(true)}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded text-sm text-brand hover:bg-raised"
        >
          <Plus className="size-4" aria-hidden />
          Adicionar exercício
        </button>
      </div>

      {seletorAberto && (
        <ExercisePicker
          exercises={exercicios}
          disabledIds={dia.exercises.map((e) => e.exerciseId)}
          title={`Adicionar em ${dia.name}`}
          onClose={() => setSeletorAberto(false)}
          onPick={(ex) => {
            executar(addExercise, { routineDayId: dia.id, exerciseId: ex.id });
            setSeletorAberto(false);
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

export function Editor({ programa, exercicios }: { programa: RoutineDetail; exercicios: PickableExercise[] }) {
  const { executar } = useAcao();

  function moverDia(index: number, direcao: -1 | 1) {
    const ids = programa.days.map((d) => d.id);
    const destino = index + direcao;
    if (destino < 0 || destino >= ids.length) return;
    const a = ids[index];
    const b = ids[destino];
    if (!a || !b) return;
    ids[index] = b;
    ids[destino] = a;
    executar(reorderDays, { ids });
  }

  return (
    <div className="space-y-3">
      {programa.days.map((dia, i) => (
        <Dia
          key={dia.id}
          dia={dia}
          primeiro={i === 0}
          ultimo={i === programa.days.length - 1}
          podeRemover={programa.days.length > 1}
          exercicios={exercicios}
          onMoverDia={(d) => moverDia(i, d)}
        />
      ))}

      <button
        type="button"
        onClick={() => executar(addDay, { routineId: programa.id })}
        className="flex min-h-14 w-full items-center justify-center gap-1.5 rounded border border-dashed border-line text-sm text-muted hover:bg-surface hover:text-body"
      >
        <Plus className="size-4" aria-hidden />
        Adicionar dia
      </button>
    </div>
  );
}
