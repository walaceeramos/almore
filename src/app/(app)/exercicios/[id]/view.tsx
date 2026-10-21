"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { getExercise } from "@/features/exercises/queries";
import { archiveCustomExercise } from "@/features/exercises/actions";
import { PATTERN_LABEL, EQUIPMENT_LABEL, restLabel } from "@/features/exercises/labels";
import { listRecords } from "@/features/sessions/queries";
import { RECORD_LABEL, RECORD_ORDER, recordValue } from "@/features/sessions/labels";
import { useProfile } from "@/components/profile-gate";
import { kg } from "@/core/utils/format";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";

export function ExercicioView({ id }: { id: string }) {
  const router = useRouter();
  const perfil = useProfile();
  const dados = useLiveQuery(async () => {
    const [exercicio, recordes] = await Promise.all([getExercise(id), listRecords([id])]);
    return { exercicio, recordes };
  }, [id]);

  if (dados === undefined) return <Loading />;
  const e = dados.exercicio;
  if (!e) {
    return (
      <EmptyState
        title="Exercício não encontrado"
        description="Ele não existe neste aparelho."
        action={<Link href="/exercicios" className="text-brand hover:underline">Ver exercícios</Link>}
      />
    );
  }

  const primarios = e.muscles.filter((m) => m.role === "primario");
  const secundarios = e.muscles.filter((m) => m.role === "secundario");
  const recordes = RECORD_ORDER.flatMap((k) => dados.recordes.filter((r) => r.kind === k));
  // No fuso do usuário: um treino às 22h não pode virar o dia seguinte.
  const data = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: perfil.timezone,
  });

  const ficha: [string, string][] = [
    ["Padrão de movimento", PATTERN_LABEL[e.pattern] ?? e.pattern],
    ["Equipamento", EQUIPMENT_LABEL[e.equipment] ?? e.equipment],
    ["Execução", e.isUnilateral ? "Unilateral, um lado por vez" : "Bilateral"],
    ["Descanso sugerido", restLabel(e.defaultRestSeconds)],
    ["Incremento de carga", `${kg(e.loadStepKg.toFixed(2))} kg`],
  ];

  return (
    <div className="space-y-5">
      <title>{`${e.name} · SériePro`}</title>
      <Link href="/exercicios" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body">
        <ArrowLeft className="size-4" aria-hidden />
        Exercícios
      </Link>

      <div>
        <div className="flex items-start gap-2">
          <h1 className="font-condensed text-3xl font-bold leading-tight">{e.name}</h1>
          {e.isCustom && <Badge tone="brand" className="mt-2">meu</Badge>}
          {e.archivedAt && <Badge className="mt-2">arquivado</Badge>}
        </div>
        <p className="mt-1 flex flex-wrap gap-1.5">
          {primarios.map((m) => (
            <Badge key={m.id} tone="brand">{m.name}</Badge>
          ))}
          {secundarios.map((m) => (
            <Badge key={m.id}>{m.name}</Badge>
          ))}
        </p>
      </div>

      {e.cue && (
        <Card className="border-l-2 border-l-brand">
          <p className="text-sm text-muted">{e.cue}</p>
        </Card>
      )}

      <Card className="divide-y divide-line p-0">
        {ficha.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{rotulo}</span>
            <span>{valor}</span>
          </div>
        ))}
      </Card>

      <section className="space-y-3">
        <CardTitle>Seus recordes</CardTitle>
        {recordes.length === 0 ? (
          <EmptyState
            title="Nenhum recorde ainda"
            description="Os recordes aparecem aqui depois do primeiro treino concluído com este exercício. Gráficos de evolução chegam na fase 7."
          />
        ) : (
          <Card className="divide-y divide-line p-0">
            {recordes.map((r) => (
              <div key={r.kind} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-muted">{RECORD_LABEL[r.kind]}</span>
                <span className="text-right">
                  <span className="block font-condensed text-base tabular-nums">{recordValue(r)}</span>
                  <span className="text-xs text-faint">{data.format(r.achievedAt)}</span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {e.isCustom && !e.archivedAt && (
        <div>
          <button
            type="button"
            onClick={async () => {
              await archiveCustomExercise(e.id);
              router.push("/exercicios");
            }}
            className="min-h-11 rounded border border-bad/40 px-4 text-sm text-bad hover:bg-bad/10"
          >
            Arquivar exercício
          </button>
          <p className="mt-2 text-xs text-faint">
            Arquivar esconde o exercício da lista sem apagar nada. O histórico que apontar para ele continua válido.
          </p>
        </div>
      )}
    </div>
  );
}
