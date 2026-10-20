"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  addSessionExercise,
  deleteSession,
  deleteSet,
  removeHistoryExercise,
  saveSet,
  updateSession,
} from "@/features/sessions/actions";
import type { SessionActionState } from "@/features/sessions/schemas";
import { newId } from "@/core/utils/uuid";
import { cn } from "@/core/utils/cn";
import { SetFields, draftWeight, weightLabel, type SetDraft } from "@/components/set-fields";
import { ExercisePicker, type PickableExercise } from "@/components/exercise-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

/* ------------------------------------------------------------------ *
 * Formas recebidas da página
 * ------------------------------------------------------------------ */

type Tipo = "aquecimento" | "trabalho";

export type SerieHist = {
  id: string;
  setNumber: number;
  kind: Tipo;
  weightKg: number | null;
  reps: number;
  rir: number | null;
  /** Só no cliente: o que ainda não foi confirmado pelo servidor. */
  estado?: "salvando" | "erro";
};

export type ExercicioHist = {
  /** Id de session_exercises. */
  id: string;
  exerciseId: string;
  name: string;
  isBodyweight: boolean;
  loadStepKg: number;
  prescricao: string | null;
  series: SerieHist[];
};

type Meta = {
  date: string;
  start: string;
  end: string;
  perceivedEffort: number | null;
  notes: string;
};

function paraFormData(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

function paraRascunho(s: Pick<SerieHist, "weightKg" | "reps" | "rir" | "kind">): SetDraft {
  return {
    peso: s.weightKg ?? 0,
    reps: s.reps,
    rir: s.rir ?? 2,
    usaRir: s.rir !== null,
    aquecimento: s.kind === "aquecimento",
  };
}

function AvisoErro({ mensagem, onFechar }: { mensagem: string | null; onFechar?: () => void }) {
  if (!mensagem) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">
      <p className="flex-1">{mensagem}</p>
      {onFechar && (
        <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="-m-1 p-1">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Ação destrutiva em dois toques. */
function Confirmar({
  rotulo,
  aviso,
  onConfirmar,
  className,
}: {
  rotulo: string;
  aviso: string;
  onConfirmar: () => void;
  className?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" className={cn("text-bad", className)} onClick={() => setConfirmando(true)}>
        <Trash2 className="size-4" aria-hidden />
        {rotulo}
      </Button>
    );
  }
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[13px] text-bad">{aviso}</p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setConfirmando(false)}>
          Manter
        </Button>
        <Button type="button" variant="danger" onClick={onConfirmar}>
          {rotulo}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Data, horário, esforço e observação
 * ------------------------------------------------------------------ */

const ESFORCO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function DadosDoTreino({ sessionId, meta }: { sessionId: string; meta: Meta }) {
  const [state, action] = useActionState<SessionActionState, FormData>(updateSession, {});
  const [esforco, setEsforco] = useState(meta.perceivedEffort);

  return (
    <Card>
      <form action={action} className="space-y-4" noValidate>
        <CardTitle>Dados do treino</CardTitle>
        <input type="hidden" name="id" value={sessionId} />
        <input type="hidden" name="perceivedEffort" value={esforco ?? ""} />

        <Field label="Data" name="date" type="date" defaultValue={meta.date} errors={state.fieldErrors?.date} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início" name="start" type="time" defaultValue={meta.start} errors={state.fieldErrors?.start} />
          <Field
            label="Fim"
            name="end"
            type="time"
            defaultValue={meta.end}
            errors={state.fieldErrors?.end}
            hint="Antes do início = passou da meia-noite"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm text-muted">Esforço percebido</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {ESFORCO.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={esforco === n}
                onClick={() => setEsforco(esforco === n ? null : n)}
                className={cn(
                  "min-h-11 rounded border font-condensed text-lg tabular-nums",
                  esforco === n
                    ? "border-brand bg-brand/15 text-brand"
                    : "border-line bg-surface text-muted hover:bg-raised",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm text-muted">
            Observação
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={500}
            defaultValue={meta.notes}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-[16px] placeholder:text-faint"
          />
          {state.fieldErrors?.notes && <p className="text-xs text-bad">{state.fieldErrors.notes[0]}</p>}
        </div>

        <AvisoErro mensagem={state.error ?? null} />
        {state.ok && (
          <p role="status" className="text-[13px] text-good">
            Salvo. Os recordes foram recalculados.
          </p>
        )}

        <SubmitButton>Salvar dados</SubmitButton>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Uma série
 * ------------------------------------------------------------------ */

function LinhaSerie({
  ex,
  serie,
  indice,
  onSalvar,
  onRemover,
}: {
  ex: ExercicioHist;
  serie: SerieHist;
  indice: number;
  onSalvar: (s: SerieHist) => void;
  onRemover: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<SetDraft>(() => paraRascunho(serie));

  if (editando) {
    return (
      <li className="space-y-3 bg-ink px-3 py-3">
        <p className="text-sm font-medium">Corrigir série {indice}</p>
        <SetFields isBodyweight={ex.isBodyweight} loadStepKg={ex.loadStepKg} valor={valor} onChange={setValor} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              onSalvar({
                ...serie,
                kind: valor.aquecimento ? "aquecimento" : "trabalho",
                weightKg: draftWeight(ex.isBodyweight, valor),
                reps: valor.reps,
                rir: valor.usaRir ? valor.rir : null,
              });
              setEditando(false);
            }}
          >
            Salvar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" className="ml-auto" onClick={onRemover}>
            <Trash2 className="size-4" aria-hidden />
            Remover
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={serie.estado === "erro" ? () => onSalvar(serie) : () => setEditando(true)}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised"
      >
        <span className="w-6 shrink-0 text-center font-condensed text-lg font-semibold tabular-nums text-muted">
          {indice}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-condensed text-lg tabular-nums">
            {weightLabel(ex.isBodyweight, serie.weightKg)} × {serie.reps}
          </span>
          {serie.rir !== null && <span className="ml-2 text-[13px] text-muted">RIR {serie.rir}</span>}
          {serie.estado === "erro" && (
            <span className="block text-xs text-bad">Não salvou. Toque para tentar de novo.</span>
          )}
        </span>
        {serie.kind === "aquecimento" && <Badge tone="muted">aquecimento</Badge>}
        {serie.estado === "erro" ? (
          <RotateCcw className="size-4 shrink-0 text-bad" aria-hidden />
        ) : serie.estado === "salvando" ? (
          <Check className="size-4 shrink-0 text-faint" aria-label="Salvando" />
        ) : null}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * Um exercício
 * ------------------------------------------------------------------ */

function CartaoExercicio({
  ex,
  series,
  onSalvar,
  onRemoverSerie,
  onAdicionar,
  onRemoverExercicio,
}: {
  ex: ExercicioHist;
  series: SerieHist[];
  onSalvar: (s: SerieHist) => void;
  onRemoverSerie: (s: SerieHist) => void;
  onAdicionar: (s: SerieHist) => void;
  onRemoverExercicio: () => void;
}) {
  const [nova, setNova] = useState<SetDraft | null>(null);
  const ultima = series.at(-1);

  return (
    <section className="rounded border border-line bg-surface">
      <header className="px-4 py-3">
        <p className="text-[15.5px] font-medium">{ex.name}</p>
        <p className="text-[13px] text-muted">{ex.prescricao ?? "Fora do plano"}</p>
      </header>

      {series.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {series.map((s, i) => (
            <LinhaSerie
              key={s.id}
              ex={ex}
              serie={s}
              indice={i + 1}
              onSalvar={onSalvar}
              onRemover={() => onRemoverSerie(s)}
            />
          ))}
        </ul>
      ) : (
        <p className="border-t border-line px-4 py-3 text-sm text-faint">Nenhuma série registrada.</p>
      )}

      <div className="space-y-3 border-t border-line p-3">
        {nova ? (
          <>
            <p className="text-sm font-medium">Nova série</p>
            <SetFields isBodyweight={ex.isBodyweight} loadStepKg={ex.loadStepKg} valor={nova} onChange={setNova} />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  onAdicionar({
                    id: newId(),
                    setNumber: series.length + 1,
                    kind: nova.aquecimento ? "aquecimento" : "trabalho",
                    weightKg: draftWeight(ex.isBodyweight, nova),
                    reps: nova.reps,
                    rir: nova.usaRir ? nova.rir : null,
                    estado: "salvando",
                  });
                  setNova(null);
                }}
              >
                Salvar série
              </Button>
              <Button type="button" variant="ghost" onClick={() => setNova(null)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setNova(
                  ultima
                    ? { ...paraRascunho(ultima), aquecimento: false }
                    : { peso: 0, reps: 10, rir: 2, usaRir: false, aquecimento: false },
                )
              }
            >
              <Plus className="size-4" aria-hidden />
              Adicionar série
            </Button>
            <Confirmar
              rotulo="Remover exercício"
              aviso={
                series.length > 0
                  ? `Apaga ${ex.name} e as ${series.length} séries dele deste treino.`
                  : `Tira ${ex.name} deste treino.`
              }
              onConfirmar={onRemoverExercicio}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

export function EditorHistorico({
  sessionId,
  finishedAt,
  meta,
  exercicios,
  catalogo,
}: {
  sessionId: string;
  /** ISO. Série acrescentada aqui leva a data do treino, não a de hoje. */
  finishedAt: string;
  meta: Meta;
  exercicios: ExercicioHist[];
  catalogo: PickableExercise[];
}) {
  const router = useRouter();
  // As séries vivem aqui depois da primeira carga, como na execução. Os
  // exercícios vêm das props: acrescentar ou remover um revalida a página.
  const [series, setSeries] = useState<Record<string, SerieHist[]>>(() =>
    Object.fromEntries(exercicios.map((e) => [e.id, e.series])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [, startTransition] = useTransition();
  const [estadoExclusao, excluir] = useActionState<SessionActionState, FormData>(deleteSession, {});

  function mudar(exId: string, id: string, mudanca: Partial<SerieHist> | null) {
    setSeries((prev) => {
      const lista = prev[exId] ?? [];
      const nova =
        mudanca === null
          ? lista.filter((s) => s.id !== id).map((s, i) => ({ ...s, setNumber: i + 1 }))
          : lista.map((s) => (s.id === id ? { ...s, ...mudanca } : s));
      return { ...prev, [exId]: nova };
    });
  }

  async function enviar(exId: string, s: SerieHist, nova: boolean) {
    const r = await saveSet(
      paraFormData({
        id: s.id,
        sessionExerciseId: exId,
        setNumber: String(s.setNumber),
        kind: s.kind,
        weightKg: s.weightKg === null ? "" : String(s.weightKg),
        reps: String(s.reps),
        rir: s.rir === null ? "" : String(s.rir),
        ...(nova ? { completedAt: finishedAt } : {}),
      }),
    );
    mudar(exId, s.id, { estado: r.error ? "erro" : undefined });
    // Os recordes do topo da página são do servidor e acabaram de mudar.
    if (!r.error) router.refresh();
  }

  function salvar(exId: string, s: SerieHist) {
    const pendente = { ...s, estado: "salvando" as const };
    mudar(exId, s.id, pendente);
    void enviar(exId, pendente, false);
  }

  function adicionar(exId: string, s: SerieHist) {
    setSeries((prev) => ({ ...prev, [exId]: [...(prev[exId] ?? []), s] }));
    void enviar(exId, s, true);
  }

  async function removerSerie(exId: string, s: SerieHist) {
    if (s.estado === "salvando") {
      setErro("Aguarde a série terminar de salvar para removê-la.");
      return;
    }
    const antes = series[exId] ?? [];
    mudar(exId, s.id, null);
    if (s.estado === "erro") return;
    const r = await deleteSet(paraFormData({ id: s.id }));
    if (r.error) {
      setSeries((prev) => ({ ...prev, [exId]: antes }));
      setErro(r.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />

      <section className="space-y-3">
        <div>
          <CardTitle>Exercícios</CardTitle>
          <p className="text-[13px] text-faint">
            Toque numa série para corrigir. Cada alteração é salva na hora e recalcula os recordes.
          </p>
        </div>

        {exercicios.map((ex) => (
          <CartaoExercicio
            key={ex.id}
            ex={ex}
            series={series[ex.id] ?? []}
            onSalvar={(s) => salvar(ex.id, s)}
            onRemoverSerie={(s) => void removerSerie(ex.id, s)}
            onAdicionar={(s) => adicionar(ex.id, s)}
            onRemoverExercicio={() =>
              startTransition(async () => {
                const r = await removeHistoryExercise(paraFormData({ id: ex.id }));
                if (r.error) setErro(r.error);
              })
            }
          />
        ))}

        <button
          type="button"
          onClick={() => setSeletorAberto(true)}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded border border-dashed border-line text-sm text-brand hover:bg-surface"
        >
          <Plus className="size-4" aria-hidden />
          Adicionar exercício
        </button>
      </section>

      <DadosDoTreino sessionId={sessionId} meta={meta} />

      <Card className="space-y-2">
        <CardTitle>Excluir treino</CardTitle>
        <p className="text-[13px] text-muted">
          Para treino registrado por engano. Os recordes, a sequência e o volume são recalculados sem ele.
        </p>
        <AvisoErro mensagem={estadoExclusao.error ?? null} />
        <Confirmar
          rotulo="Excluir treino"
          aviso="Apaga o treino e todas as séries. Não dá para desfazer."
          onConfirmar={() => startTransition(() => excluir(paraFormData({ id: sessionId })))}
        />
      </Card>

      {seletorAberto && (
        <ExercisePicker
          exercises={catalogo}
          disabledIds={exercicios.map((e) => e.exerciseId)}
          title="Adicionar ao treino"
          onClose={() => setSeletorAberto(false)}
          onPick={(e) => {
            setSeletorAberto(false);
            startTransition(async () => {
              const r = await addSessionExercise(paraFormData({ sessionId, exerciseId: e.id }));
              if (r.error) setErro(r.error);
            });
          }}
        />
      )}
    </div>
  );
}
