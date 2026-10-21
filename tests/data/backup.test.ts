import { describe, expect, it } from "vitest";
import { db } from "@/core/data/db";
import { CATALOG } from "@/core/data/catalog";
import { BACKUP_VERSION, exportBackup, importBackup } from "@/core/data/backup";
import { addExercise } from "@/features/routines/actions";
import { startSession } from "@/features/sessions/actions";
import { bancoLimpo, criaPrograma, fd } from "./helpers";

/**
 * O aparelho é a única cópia dos dados. Um backup que não volta só aparece
 * quando já é tarde, então é o que mais merece teste.
 */

bancoLimpo();

const SUPINO = CATALOG[0]!.id;

async function dadosDeExemplo() {
  await db.profile.put({
    id: "eu",
    displayName: "Walace",
    heightCm: 180,
    startingWeightKg: 80,
    focus: "hipertrofia",
    level: "intermediario",
    weeklyTarget: 5,
    timezone: "America/Sao_Paulo",
    onboardedAt: new Date().toISOString(),
  } as Parameters<typeof db.profile.put>[0]);

  const { dias } = await criaPrograma("Programa de teste", 3);
  await addExercise({}, fd({ routineDayId: dias[0]!.id, exerciseId: SUPINO }));
  await startSession({}, fd({ routineDayId: dias[0]!.id }));
}

describe("exportBackup", () => {
  it("marca o app e a versão do formato", async () => {
    await dadosDeExemplo();

    const b = await exportBackup();

    expect(b.app).toBe("almore");
    expect(b.version).toBe(BACKUP_VERSION);
    expect(b.exportedAt).toBeTruthy();
  });

  it("leva o conteúdo das tabelas", async () => {
    await dadosDeExemplo();

    const b = await exportBackup();

    expect(b.data.routines).toHaveLength(1);
    expect(b.data.routineDays).toHaveLength(3);
    expect(b.data.routineExercises).toHaveLength(1);
    expect(b.data.sessions).toHaveLength(1);
  });
});

describe("importBackup", () => {
  it("devolve os dados num aparelho vazio", async () => {
    await dadosDeExemplo();
    const texto = JSON.stringify(await exportBackup());

    // Simula o aparelho novo.
    await db.delete();
    await db.open();
    expect(await db.routines.count()).toBe(0);

    const r = await importBackup(texto);

    expect(r.ok).toBe(true);
    expect(await db.routines.count()).toBe(1);
    expect(await db.routineDays.count()).toBe(3);
    expect(await db.routineExercises.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
    expect((await db.profile.get("eu"))?.displayName).toBe("Walace");
  });

  it("não duplica ao importar o mesmo arquivo duas vezes", async () => {
    await dadosDeExemplo();
    const texto = JSON.stringify(await exportBackup());

    await importBackup(texto);
    await importBackup(texto);

    expect(await db.routines.count()).toBe(1);
    expect(await db.routineDays.count()).toBe(3);
    expect(await db.sessions.count()).toBe(1);
  });

  it("ida e volta preserva o programa inteiro", async () => {
    await dadosDeExemplo();
    const antes = {
      rotinas: await db.routines.toArray(),
      dias: await db.routineDays.orderBy("id").toArray(),
      prescricoes: await db.routineExercises.orderBy("id").toArray(),
    };
    const texto = JSON.stringify(await exportBackup());

    await db.delete();
    await db.open();
    await importBackup(texto);

    expect(await db.routines.toArray()).toEqual(antes.rotinas);
    expect(await db.routineDays.orderBy("id").toArray()).toEqual(antes.dias);
    expect(await db.routineExercises.orderBy("id").toArray()).toEqual(antes.prescricoes);
  });

  it("recusa arquivo que não é backup do Almore", async () => {
    const r = await importBackup(JSON.stringify({ foo: "bar" }));
    expect(r.ok).toBe(false);
  });

  it("recusa JSON quebrado sem derrubar nada", async () => {
    await dadosDeExemplo();

    const r = await importBackup("{ isto não é json");

    expect(r.ok).toBe(false);
    expect(await db.routines.count()).toBe(1);
  });

  it("recusa backup de versão futura, que este app não sabe ler", async () => {
    await dadosDeExemplo();
    const b = await exportBackup();

    const r = await importBackup(JSON.stringify({ ...b, version: BACKUP_VERSION + 1 }));

    expect(r.ok).toBe(false);
  });
});
