"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  Plus,
  RotateCcw,
  Sun,
  TrendingDown,
  Trophy,
  SunDim,
  Trash2,
  X,
} from "lucide-react";
import {
  addSessionExercise,
  deleteSet,
  discardSession,
  removeSessionExercise,
  saveSet,
} from "@/features/sessions/actions";
import type { ProgressionVerdict } from "@/core/domain/progression";
import { sessionRecordMarks, type SetRecordKind } from "@/core/domain/records";
import { newId } from "@/core/utils/uuid";
import { kg } from "@/core/utils/format";
import { clockLabel } from "@/core/utils/date";
import { cn } from "@/core/utils/cn";
import { ExercisePicker, type PickableExercise } from "@/components/exercise-picker";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgora, useAlarme, useRestTimer, useWakeLock, type Descanso } from "./hooks";

/* ------------------------------------------------------------------ *
 * Formas recebidas da página
 * ------------------------------------------------------------------ */

type Tipo = "aquecimento" | "trabalho";

export type ExercicioExec = {
  /** Id de session_exercises. */
  id: string;
  exerciseId: string;
  name: string;
  isBodyweight: boolean;
  equipmentLabel: string;
  targetSets: number | null;
  repMin: number | null;
  targetRir: number | null;
  restSeconds: number;
  loadStepKg: number;
  notes: string | null;
  /** "3 × 8 a 12", ou nulo quando acrescentado na hora. */
  prescricao: string | null;
  rir: string | null;
  descanso: string;
  anterior: { data: string; series: { kind: Tipo; weightKg: number | null; reps: number }[] } | null;
  /** Calculado no servidor sobre o histórico, sem a sessão atual. */
  veredito: ProgressionVerdict;
  estagnado: boolean;
  /** Recordes de série anteriores a esta sessão. Vazio na primeira vez. */
  recordes: Partial<Record<SetRecordKind, number>>;
};

export type SerieExec = {
  id: string;
  setNumber: number;
  kind: Tipo;
  /** Nulo = só o peso do corpo. */
  weightKg: number | null;
  reps: number;
  rir: number | null;
  /** Só no cliente: o que ainda não foi confirmado pelo servidor. */
  estado?: "salvando" | "erro";
};

/* ------------------------------------------------------------------ *
 * Regras locais da tela
 * ------------------------------------------------------------------ */

type Rascunho = {
  /** 0 em exercício de peso corporal significa sem carga adicional. */
  peso: number;
  reps: number;
  rir: number;
  usaRir: boolean;
  aquecimento: boolean;
};

function trabalhoFeitas(series: SerieExec[]): number {
  return series.filter((s) => s.kind === "trabalho").length;
}

function completo(ex: ExercicioExec, series: SerieExec[]): boolean {
  return ex.targetSets === null ? series.length > 0 : trabalhoFeitas(series) >= ex.targetSets;
}

/**
 * Valores pré-preenchidos da próxima série:
 *
 * 1. a última série de trabalho desta sessão, se já houver — a carga do
 *    dia já foi escolhida;
 * 2. senão, a sugestão de progressão (carga e repetições do veredito);
 * 3. senão, primeira vez: fundo da faixa e carga em branco.
 */
function sugestao(ex: ExercicioExec, series: SerieExec[]): Rascunho {
  const rir = ex.targetRir ?? 2;
  const usaRir = ex.targetRir !== null;

  const ultimaDaSessao = series.filter((s) => s.kind === "trabalho").at(-1);
  if (ultimaDaSessao) {
    return {
      peso: ultimaDaSessao.weightKg ?? 0,
      reps: ultimaDaSessao.reps,
      rir: ultimaDaSessao.rir ?? rir,
      usaRir: ultimaDaSessao.rir !== null || usaRir,
      aquecimento: false,
    };
  }

  return { peso: ex.veredito.weightKg ?? 0, reps: ex.veredito.reps, rir, usaRir, aquecimento: false };
}

const RECORDE_LABEL: Record<SetRecordKind, string> = {
  carga_maxima: "carga",
  melhor_serie: "1RM",
  volume_serie: "volume",
};

const VEREDITO: Record<ProgressionVerdict["action"], { rotulo: string; classe: string }> = {
  subir: { rotulo: "Subir carga", classe: "border-good/40 bg-good/10 text-good" },
  manter: { rotulo: "Manter carga", classe: "border-brand/40 bg-brand/10 text-brand" },
  reduzir: { rotulo: "Reduzir carga", classe: "border-bad/40 bg-bad/10 text-bad" },
  primeira_vez: { rotulo: "Primeira vez", classe: "border-line bg-raised text-muted" },
};

/** O veredito de progressão antes da primeira série do exercício. */
function SeloVeredito({ ex }: { ex: ExercicioExec }) {
  const v = ex.veredito;
  const visual = VEREDITO[v.action];
  const alvo =
    v.action === "primeira_vez"
      ? null
      : `${v.weightKg === null ? "Peso corporal" : pesoLabel(ex, v.weightKg)} × ${v.reps}`;

  return (
    <div className={cn("rounded border px-3 py-2", visual.classe)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {visual.rotulo}
        {alvo && <span className="font-condensed text-base tabular-nums">{alvo}</span>}
      </p>
      <p className="mt-0.5 text-[13px] text-body/80">{v.reason}</p>
    </div>
  );
}

function pesoLabel(ex: ExercicioExec, peso: number | null): string {
  if (peso === null || (ex.isBodyweight && peso === 0)) return "Peso corporal";
  // `kg` espera o formato do numeric ("80.00"); com o número 80 ele
  // cortaria o zero da dezena. Por isso o toFixed.
  const texto = kg(peso.toFixed(2));
  return ex.isBodyweight ? `+${texto} kg` : `${texto} kg`;
}

function paraFormData(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(campos)) fd.set(chave, valor);
  return fd;
}

function camposDaSerie(exId: string, s: SerieExec): Record<string, string> {
  return {
    id: s.id,
    sessionExerciseId: exId,
    setNumber: String(s.setNumber),
    kind: s.kind,
    weightKg: s.weightKg === null ? "" : String(s.weightKg),
    reps: String(s.reps),
    rir: s.rir === null ? "" : String(s.rir),
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

/* ------------------------------------------------------------------ *
 * Campos da série: usados no rascunho e na correção
 * ------------------------------------------------------------------ */

function CamposSerie({
  ex,
  valor,
  onChange,
}: {
  ex: ExercicioExec;
  valor: Rascunho;
  onChange: (v: Rascunho) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberStepper
          label={ex.isBodyweight ? "Carga adicional" : "Carga"}
          name="weightKg"
          value={valor.peso}
          onChange={(peso) => onChange({ ...valor, peso })}
          min={0}
          max={999.99}
          step={ex.loadStepKg}
          unit="kg"
          hint={ex.isBodyweight && valor.peso === 0 ? "Só o corpo" : undefined}
        />
        <NumberStepper
          label="Repetições"
          name="reps"
          value={valor.reps}
          onChange={(reps) => onChange({ ...valor, reps })}
          min={0}
          max={100}
        />
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        {valor.usaRir ? (
          <NumberStepper
            label="RIR"
            name="rir"
            value={valor.rir}
            onChange={(rir) => onChange({ ...valor, rir })}
            min={0}
            max={10}
          />
        ) : (
          <button
            type="button"
            onClick={() => onChange({ ...valor, usaRir: true })}
            className="min-h-11 rounded border border-dashed border-line px-3 text-sm text-muted hover:bg-raised"
          >
            Anotar RIR
          </button>
        )}

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded border border-line bg-surface px-3 text-sm">
          <input
            type="checkbox"
            checked={valor.aquecimento}
            onChange={(e) => onChange({ ...valor, aquecimento: e.target.checked })}
            className="size-4 accent-[var(--color-brand)]"
          />
          Aquecimento
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Uma série já registrada
 * ------------------------------------------------------------------ */

function LinhaSerie({
  ex,
  serie,
  indice,
  recordes,
  onSalvar,
  onRemover,
  onTentarDeNovo,
}: {
  ex: ExercicioExec;
  serie: SerieExec;
  indice: number;
  /** Recordes que esta série bateu, na hora em que foi feita. */
  recordes: SetRecordKind[];
  onSalvar: (s: SerieExec) => void;
  onRemover: () => void;
  onTentarDeNovo: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<Rascunho>({
    peso: serie.weightKg ?? 0,
    reps: serie.reps,
    rir: serie.rir ?? 2,
    usaRir: serie.rir !== null,
    aquecimento: serie.kind === "aquecimento",
  });

  if (editando) {
    return (
      <li className="space-y-3 bg-ink px-3 py-3">
        <p className="text-sm font-medium">Corrigir série {indice}</p>
        <CamposSerie ex={ex} valor={valor} onChange={setValor} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              onSalvar({
                ...serie,
                kind: valor.aquecimento ? "aquecimento" : "trabalho",
                weightKg: ex.isBodyweight && valor.peso === 0 ? null : valor.peso,
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
        onClick={serie.estado === "erro" ? onTentarDeNovo : () => setEditando(true)}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised"
      >
        <span className="w-6 shrink-0 text-center font-condensed text-lg font-semibold tabular-nums text-muted">
          {indice}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-condensed text-lg tabular-nums">
            {pesoLabel(ex, serie.weightKg)} × {serie.reps}
          </span>
          {serie.rir !== null && <span className="ml-2 text-[13px] text-muted">RIR {serie.rir}</span>}
          {serie.estado === "erro" && (
            <span className="block text-xs text-bad">Não salvou. Toque para tentar de novo.</span>
          )}
        </span>
        {serie.kind === "aquecimento" && <Badge tone="muted">aquecimento</Badge>}
        {recordes.length > 0 && (
          <Badge tone="brand" className="shrink-0">
            <Trophy className="mr-1 size-3" aria-hidden />
            Recorde: {recordes.map((k) => RECORDE_LABEL[k]).join(", ")}
          </Badge>
        )}
        {serie.estado === "erro" ? (
          <RotateCcw className="size-4 shrink-0 text-bad" aria-hidden />
        ) : (
          <Check
            className={cn("size-4 shrink-0", serie.estado === "salvando" ? "text-faint" : "text-good")}
            aria-label={serie.estado === "salvando" ? "Salvando" : "Salva"}
          />
        )}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ *
 * O exercício da vez
 * ------------------------------------------------------------------ */

function PainelExercicio({
  ex,
  series,
  numero,
  total,
  onConcluir,
  onSalvar,
  onRemover,
}: {
  ex: ExercicioExec;
  series: SerieExec[];
  numero: number;
  total: number;
  onConcluir: (s: SerieExec) => void;
  onSalvar: (s: SerieExec) => void;
  onRemover: (s: SerieExec) => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => sugestao(ex, series));
  const feitas = trabalhoFeitas(series);
  const terminou = completo(ex, series);
  // Recalculado a cada render: corrigir uma série muda as marcas das seguintes.
  const marcas = sessionRecordMarks(series, ex.recordes);

  function concluir() {
    onConcluir({
      id: newId(),
      setNumber: series.length + 1,
      kind: rascunho.aquecimento ? "aquecimento" : "trabalho",
      weightKg: ex.isBodyweight && rascunho.peso === 0 ? null : rascunho.peso,
      reps: rascunho.reps,
      rir: rascunho.usaRir ? rascunho.rir : null,
      estado: "salvando",
    });
    // A próxima já nasce com os valores da que acabou de ser feita.
    setRascunho((r) => ({ ...r, aquecimento: false }));
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs text-faint">
          Exercício {numero} de {total} · {ex.equipmentLabel}
        </p>
        <h1 className="font-condensed text-3xl font-bold leading-tight">{ex.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {ex.prescricao ?? "Sem prescrição"}
          {ex.rir && ` · ${ex.rir}`}
          {` · ${ex.descanso} de descanso`}
        </p>
        {ex.notes && <p className="mt-1 text-[13px] text-faint">{ex.notes}</p>}
        {ex.anterior && (
          <p className="mt-2 text-[13px] text-muted">
            <span className="text-faint">Última vez ({ex.anterior.data}): </span>
            {ex.anterior.series
              .filter((s) => s.kind === "trabalho")
              .map((s) => `${pesoLabel(ex, s.weightKg)} × ${s.reps}`)
              .join(", ") || "só aquecimento"}
          </p>
        )}
      </div>

      {/* O veredito vale para a primeira série de trabalho; depois dela, a
          carga do dia já foi escolhida e o selo só ocuparia espaço. */}
      {feitas === 0 && <SeloVeredito ex={ex} />}

      {ex.estagnado && (
        <div className="flex gap-2 rounded border border-line bg-surface px-3 py-2 text-[13px] text-muted">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
          <p>
            Três sessões sem subir carga nem repetições. Antes de trocar o exercício, vale olhar sono, alimentação e
            fadiga acumulada.
          </p>
        </div>
      )}

      {series.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded border border-line bg-surface">
          {series.map((s, i) => (
            <LinhaSerie
              key={s.id}
              ex={ex}
              serie={s}
              indice={i + 1}
              recordes={marcas[i] ?? []}
              onSalvar={onSalvar}
              onRemover={() => onRemover(s)}
              onTentarDeNovo={() => onSalvar(s)}
            />
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded border border-line bg-surface p-3">
        <p className="text-sm">
          {terminou ? (
            <span className="text-good">Séries prescritas concluídas. Pode fazer uma extra.</span>
          ) : ex.targetSets !== null ? (
            <>
              Série <span className="font-semibold">{feitas + 1}</span> de {ex.targetSets}
            </>
          ) : (
            <>Série {series.length + 1}</>
          )}
        </p>

        <CamposSerie ex={ex} valor={rascunho} onChange={setRascunho} />

        <Button type="button" full onClick={concluir} variant={terminou ? "secondary" : "primary"} className="min-h-14 text-base">
          <Check className="size-5" aria-hidden />
          {terminou ? "Registrar série extra" : "Concluir série"}
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Cronômetro de descanso
 * ------------------------------------------------------------------ */

function BarraDescanso({
  descanso,
  agora,
  onAjustar,
  onParar,
}: {
  descanso: Descanso;
  agora: number;
  onAjustar: (delta: number) => void;
  onParar: () => void;
}) {
  const restante = Math.max(0, Math.ceil((descanso.fim - agora) / 1000));
  const acabou = agora > 0 && restante === 0;
  const fracao = descanso.total > 0 ? Math.min(1, restante / descanso.total) : 0;

  return (
    <div
      role="timer"
      aria-live={acabou ? "assertive" : "off"}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t bg-surface pb-[env(safe-area-inset-bottom,0px)]",
        acabou ? "border-good" : "border-line",
      )}
    >
      <div className="h-1 bg-raised">
        <div className={cn("h-full", acabou ? "bg-good" : "bg-brand")} style={{ width: `${fracao * 100}%` }} />
      </div>
      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-faint">{acabou ? "Descanso concluído" : "Descanso"}</p>
          <p className={cn("font-condensed text-3xl font-bold tabular-nums", acabou && "text-good")}>
            {acabou ? "Hora da série" : agora === 0 ? "—" : clockLabel(restante)}
          </p>
        </div>
        {!acabou && (
          <>
            <button
              type="button"
              onClick={() => onAjustar(-15)}
              className="min-h-11 min-w-11 rounded border border-line px-2 text-sm tabular-nums text-muted hover:bg-raised"
            >
              −15
            </button>
            <button
              type="button"
              onClick={() => onAjustar(15)}
              className="min-h-11 min-w-11 rounded border border-line px-2 text-sm tabular-nums text-muted hover:bg-raised"
            >
              +15
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onParar}
          className="min-h-11 rounded px-3 text-sm text-brand hover:bg-raised"
        >
          {acabou ? "Fechar" : "Pular"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lista de exercícios da sessão
 * ------------------------------------------------------------------ */

function ListaExercicios({
  sessionId,
  exercicios,
  series,
  atual,
  onEscolher,
  onAdicionar,
  onRemover,
  onFechar,
  onDescartar,
}: {
  sessionId: string;
  exercicios: ExercicioExec[];
  series: Record<string, SerieExec[]>;
  atual: number;
  onEscolher: (i: number) => void;
  onAdicionar: () => void;
  onRemover: (ex: ExercicioExec) => void;
  onFechar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label="Exercícios do treino">
      <header className="flex items-center gap-2 border-b border-line px-3 pt-[env(safe-area-inset-top,0px)]">
        <h2 className="flex h-14 flex-1 items-center font-condensed text-lg font-semibold">Exercícios do treino</h2>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="flex size-11 items-center justify-center rounded text-muted hover:bg-raised"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-line">
          {exercicios.map((ex, i) => {
            const feitas = series[ex.id] ?? [];
            const ok = completo(ex, feitas);
            return (
              <li key={ex.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onEscolher(i)}
                  className={cn("flex min-h-14 flex-1 items-center gap-3 px-4 py-2 text-left hover:bg-surface", i === atual && "bg-surface")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-medium">{ex.name}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {ex.targetSets !== null
                        ? `${trabalhoFeitas(feitas)} de ${ex.targetSets} séries`
                        : `${feitas.length} ${feitas.length === 1 ? "série" : "séries"} · fora do plano`}
                    </span>
                  </span>
                  {ok && <Check className="size-5 shrink-0 text-good" aria-label="Concluído" />}
                </button>
                {feitas.length === 0 && ex.prescricao === null && (
                  <button
                    type="button"
                    onClick={() => onRemover(ex)}
                    aria-label={`Remover ${ex.name} do treino`}
                    className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised hover:text-bad"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="p-3">
          <button
            type="button"
            onClick={onAdicionar}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded border border-dashed border-line text-sm text-brand hover:bg-surface"
          >
            <Plus className="size-4" aria-hidden />
            Adicionar exercício
          </button>
        </div>
      </div>

      <footer className="space-y-2 border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <ButtonLink href={`/executar/${sessionId}/resumo`} full>
          Finalizar treino
        </ButtonLink>
        <DescartarTreino sessionId={sessionId} onDescartar={onDescartar} />
      </footer>
    </div>
  );
}

/** Descarte em dois toques: apaga a sessão inteira e não tem volta. */
function DescartarTreino({ sessionId, onDescartar }: { sessionId: string; onDescartar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button type="button" variant="ghost" full className="text-bad" onClick={() => setConfirmando(true)}>
        Descartar treino
      </Button>
    );
  }

  return (
    <form action={discardSession} onSubmit={onDescartar} className="space-y-2">
      <input type="hidden" name="id" value={sessionId} />
      <p className="text-center text-[13px] text-bad">
        Apaga o treino e todas as séries registradas. Não dá para desfazer.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" full onClick={() => setConfirmando(false)}>
          Manter
        </Button>
        <Button type="submit" variant="danger" full>
          Descartar
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Tela
 * ------------------------------------------------------------------ */

function indiceInicial(exercicios: ExercicioExec[], series: Record<string, SerieExec[]>): number {
  const i = exercicios.findIndex((ex) => !completo(ex, series[ex.id] ?? []));
  return i === -1 ? Math.max(0, exercicios.length - 1) : i;
}

export function Execucao({
  sessionId,
  title,
  startedAt,
  exercicios,
  seriesIniciais,
  catalogo,
}: {
  sessionId: string;
  title: string;
  startedAt: number;
  exercicios: ExercicioExec[];
  seriesIniciais: Record<string, SerieExec[]>;
  catalogo: PickableExercise[];
}) {
  // As séries vivem aqui depois da primeira carga: o servidor não redesenha
  // a tela a cada série. Os exercícios continuam vindo das props, porque
  // acrescentar um revalida a página.
  const [series, setSeries] = useState(seriesIniciais);
  const [atual, setAtual] = useState(() => indiceInicial(exercicios, seriesIniciais));
  const [listaAberta, setListaAberta] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const agora = useAgora(500);
  const { descanso, iniciar, ajustar, parar } = useRestTimer(sessionId);
  const wake = useWakeLock();
  const { preparar: prepararAlarme, tocar: tocarAlarme } = useAlarme();

  // Toca uma vez por descanso, no instante em que ele acaba.
  const avisado = useRef<number | null>(null);
  useEffect(() => {
    if (!descanso || agora === 0) return;
    if (agora >= descanso.fim && avisado.current !== descanso.fim) {
      avisado.current = descanso.fim;
      // Descanso que acabou com a página fechada não toca ao reabrir.
      if (agora - descanso.fim < 5_000) tocarAlarme();
    }
  }, [agora, descanso, tocarAlarme]);

  const indice = Math.min(atual, Math.max(0, exercicios.length - 1));
  const ex = exercicios[indice];

  function mudarSerie(exId: string, id: string, mudanca: Partial<SerieExec> | null) {
    setSeries((prev) => {
      const lista = prev[exId] ?? [];
      const nova =
        mudanca === null
          ? lista.filter((s) => s.id !== id).map((s, i) => ({ ...s, setNumber: i + 1 }))
          : lista.map((s) => (s.id === id ? { ...s, ...mudanca } : s));
      return { ...prev, [exId]: nova };
    });
  }

  async function enviar(exId: string, s: SerieExec) {
    const r = await saveSet(paraFormData(camposDaSerie(exId, s)));
    mudarSerie(exId, s.id, { estado: r.error ? "erro" : undefined });
  }

  function concluir(exAtual: ExercicioExec, s: SerieExec) {
    setSeries((prev) => ({ ...prev, [exAtual.id]: [...(prev[exAtual.id] ?? []), s] }));
    prepararAlarme();
    iniciar(exAtual.restSeconds);
    void enviar(exAtual.id, s);
  }

  function salvar(exAtual: ExercicioExec, s: SerieExec) {
    const pendente = { ...s, estado: "salvando" as const };
    mudarSerie(exAtual.id, s.id, pendente);
    void enviar(exAtual.id, pendente);
  }

  async function remover(exAtual: ExercicioExec, s: SerieExec) {
    // Apagar enquanto o registro ainda viaja deixaria o upsert recriar a série.
    if (s.estado === "salvando") {
      setErro("Aguarde a série terminar de salvar para removê-la.");
      return;
    }
    const antes = series[exAtual.id] ?? [];
    mudarSerie(exAtual.id, s.id, null);
    // Série que nunca chegou ao servidor não precisa ir até lá para sumir.
    if (s.estado === "erro") return;
    const r = await deleteSet(paraFormData({ id: s.id }));
    if (r.error) {
      setSeries((prev) => ({ ...prev, [exAtual.id]: antes }));
      setErro(r.error);
    }
  }

  if (!ex) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <header className="flex h-14 items-center">
          <Link href="/inicio" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
            <ArrowLeft className="size-4" aria-hidden />
            Início
          </Link>
        </header>
        <div className="space-y-4 py-10 text-center">
          <p className="font-condensed text-2xl font-semibold">{title}</p>
          <p className="text-sm text-muted">Este dia não tem exercícios. Adicione o primeiro para começar.</p>
          <Button type="button" onClick={() => setSeletorAberto(true)}>
            <Plus className="size-4" aria-hidden />
            Adicionar exercício
          </Button>
          <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />
        </div>
        <div className="mt-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <DescartarTreino sessionId={sessionId} onDescartar={parar} />
        </div>
        {seletorAberto && (
          <ExercisePicker
            exercises={catalogo}
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

  const ultimo = indice === exercicios.length - 1;

  return (
    <div className={cn("mx-auto max-w-lg px-4", descanso ? "pb-40" : "pb-10")}>
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-b border-line bg-ink px-2 pt-[env(safe-area-inset-top,0px)]">
        <Link
          href="/inicio"
          aria-label="Voltar ao início. O treino continua em andamento."
          className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1 py-2">
          <p className="truncate text-[13px] text-muted">{title}</p>
          <p className="font-condensed text-lg font-semibold tabular-nums">
            {agora === 0 ? "—" : clockLabel((agora - startedAt) / 1000)}
          </p>
        </div>
        {wake.suportado && (
          <button
            type="button"
            onClick={() => void wake.alternar()}
            aria-pressed={wake.ativo}
            aria-label={wake.ativo ? "Tela sempre ligada: ativado" : "Manter a tela ligada"}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded hover:bg-raised",
              wake.ativo ? "text-brand" : "text-muted",
            )}
          >
            {wake.ativo ? <Sun className="size-5" aria-hidden /> : <SunDim className="size-5" aria-hidden />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setListaAberta(true)}
          aria-label="Exercícios do treino"
          className="flex size-11 shrink-0 items-center justify-center rounded text-muted hover:bg-raised"
        >
          <ListOrdered className="size-5" aria-hidden />
        </button>
      </header>

      <div className="space-y-4 pt-5">
        <AvisoErro mensagem={erro} onFechar={() => setErro(null)} />

        <PainelExercicio
          key={ex.id}
          ex={ex}
          series={series[ex.id] ?? []}
          numero={indice + 1}
          total={exercicios.length}
          onConcluir={(s) => concluir(ex, s)}
          onSalvar={(s) => salvar(ex, s)}
          onRemover={(s) => void remover(ex, s)}
        />

        <nav className="flex gap-2" aria-label="Navegar entre exercícios">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAtual(indice - 1)}
            disabled={indice === 0}
            className="flex-1"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </Button>
          {ultimo ? (
            <ButtonLink href={`/executar/${sessionId}/resumo`} className="flex-1">
              Finalizar
            </ButtonLink>
          ) : (
            <Button
              type="button"
              variant={completo(ex, series[ex.id] ?? []) ? "primary" : "secondary"}
              onClick={() => setAtual(indice + 1)}
              className="flex-1"
            >
              Próximo
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          )}
        </nav>
      </div>

      {descanso && <BarraDescanso descanso={descanso} agora={agora} onAjustar={ajustar} onParar={parar} />}

      {listaAberta && (
        <ListaExercicios
          sessionId={sessionId}
          exercicios={exercicios}
          series={series}
          atual={indice}
          onEscolher={(i) => {
            setAtual(i);
            setListaAberta(false);
          }}
          onAdicionar={() => setSeletorAberto(true)}
          onRemover={(alvo) =>
            startTransition(async () => {
              const r = await removeSessionExercise(paraFormData({ id: alvo.id }));
              if (r.error) setErro(r.error);
            })
          }
          onFechar={() => setListaAberta(false)}
          onDescartar={parar}
        />
      )}

      {seletorAberto && (
        <ExercisePicker
          exercises={catalogo}
          disabledIds={exercicios.map((e) => e.exerciseId)}
          title="Adicionar ao treino"
          onClose={() => setSeletorAberto(false)}
          onPick={(e) => {
            setSeletorAberto(false);
            setListaAberta(false);
            startTransition(async () => {
              const r = await addSessionExercise(paraFormData({ sessionId, exerciseId: e.id }));
              if (r.error) setErro(r.error);
              // O novo entra no fim da lista; leva o usuário até ele.
              else setAtual(exercicios.length);
            });
          }}
        />
      )}
    </div>
  );
}
