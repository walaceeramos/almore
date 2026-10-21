import { z } from "zod";
import { db, TABLES, type TableName } from "./db";

/**
 * Backup em arquivo. Com os dados só no aparelho, limpar o navegador ou
 * trocar de celular apagaria tudo; o arquivo é a cópia que sobrevive.
 *
 * O formato é o próprio conteúdo das tabelas. `version` acompanha a versão
 * do esquema do Dexie: um backup de versão mais nova que o app é recusado,
 * em vez de importado pela metade.
 */
export const BACKUP_VERSION = 1;

/** Identificador no arquivo. "almore" é o nome antigo do app. */
const APP_ID = "seriepro";
const APP_ID_ANTERIOR = "almore";

const backupSchema = z.object({
  // Aceita o nome antigo: backup exportado antes do rename continua válido.
  app: z.enum([APP_ID, APP_ID_ANTERIOR]),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  data: z.record(z.array(z.record(z.unknown()))),
});

export type BackupFile = z.infer<typeof backupSchema>;

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  await db.transaction("r", TABLES.map((t) => db[t]), async () => {
    for (const t of TABLES) data[t] = await db[t].toArray();
  });
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data } as BackupFile;
}

export type ImportResult = { ok: true; counts: Record<string, number> } | { ok: false; error: string };

/**
 * Substitui TUDO no aparelho pelo conteúdo do arquivo, numa transação só:
 * ou entra inteiro, ou nada muda.
 */
export async function importBackup(texto: string): Promise<ImportResult> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { ok: false, error: "O arquivo não é um backup do SériePro." };
  }

  const parsed = backupSchema.safeParse(bruto);
  if (!parsed.success) return { ok: false, error: "O arquivo não é um backup do SériePro." };
  if (parsed.data.version > BACKUP_VERSION) {
    return { ok: false, error: "Este backup é de uma versão mais nova do app. Atualize o app antes de importar." };
  }

  const counts: Record<string, number> = {};
  try {
    await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
      for (const t of TABLES) {
        const linhas = parsed.data.data[t] ?? [];
        await db[t as TableName].clear();
        // O conteúdo foi escrito por exportBackup; cada tabela aceita o próprio formato.
        await (db[t as TableName] as unknown as { bulkPut: (l: unknown[]) => Promise<unknown> }).bulkPut(linhas);
        counts[t] = linhas.length;
      }
    });
  } catch {
    return { ok: false, error: "Não foi possível importar. Nada foi alterado." };
  }
  return { ok: true, counts };
}
