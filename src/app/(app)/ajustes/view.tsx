"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportBackup, importBackup } from "@/core/data/backup";
import { useProfile } from "@/components/profile-gate";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { kg } from "@/core/utils/format";

/** "seriepro-backup-2026-10-21.json" */
function nomeDoArquivo(): string {
  return `seriepro-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

function Backup() {
  const entrada = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState<File | null>(null);

  async function exportar() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeDoArquivo();
    a.click();
    URL.revokeObjectURL(url);
    const treinos = (backup.data.sessions ?? []).length;
    setMensagem({ tipo: "ok", texto: `Backup gerado com ${treinos} ${treinos === 1 ? "treino" : "treinos"}.` });
  }

  async function importar(arquivo: File) {
    setConfirmando(null);
    const r = await importBackup(await arquivo.text());
    if (r.ok) {
      const treinos = r.counts.sessions ?? 0;
      setMensagem({ tipo: "ok", texto: `Backup restaurado: ${treinos} ${treinos === 1 ? "treino" : "treinos"}.` });
    } else {
      setMensagem({ tipo: "erro", texto: r.error });
    }
  }

  return (
    <Card className="space-y-3">
      <CardTitle>Backup</CardTitle>
      <p className="text-sm text-muted">
        Seus dados ficam só neste aparelho. Limpar os dados do navegador ou trocar de celular apaga tudo. Gere um
        backup de vez em quando e guarde o arquivo fora do celular.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void exportar()}>
          <Download className="size-4" aria-hidden />
          Exportar backup
        </Button>
        <Button type="button" variant="secondary" onClick={() => entrada.current?.click()}>
          <Upload className="size-4" aria-hidden />
          Importar backup
        </Button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) setConfirmando(arquivo);
          }}
        />
      </div>

      {confirmando && (
        <div className="space-y-2 rounded border border-bad/40 bg-bad/10 p-3">
          <p className="text-[13px] text-bad">
            Importar substitui tudo o que está neste aparelho pelo conteúdo de “{confirmando.name}”. O que não estiver
            no arquivo será perdido.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmando(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={() => void importar(confirmando)}>
              Substituir tudo
            </Button>
          </div>
        </div>
      )}

      {mensagem && (
        <p role="status" className={mensagem.tipo === "ok" ? "text-[13px] text-good" : "text-[13px] text-bad"}>
          {mensagem.texto}
        </p>
      )}
    </Card>
  );
}

export function AjustesView() {
  const p = useProfile();

  const linhas: [string, string][] = [
    ["Nome", p.displayName],
    ["Altura", p.heightCm ? `${p.heightCm} cm` : "—"],
    ["Peso inicial", p.startingWeightKg ? `${kg(p.startingWeightKg.toFixed(2))} kg` : "—"],
    ["Meta semanal", `${p.weeklyTarget} treinos`],
    ["Fuso horário", p.timezone],
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-condensed text-3xl font-bold">Ajustes</h1>

      <Card className="divide-y divide-line p-0">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">{rotulo}</span>
            <span>{valor}</span>
          </div>
        ))}
      </Card>

      <Backup />

      <div className="space-y-2">
        <CardTitle>Em breve</CardTitle>
        <p className="text-sm text-muted">Edição de perfil e preferências entram nas fases seguintes.</p>
      </div>
    </div>
  );
}
