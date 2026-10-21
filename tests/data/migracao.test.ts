import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SerieProDb, migraDoBancoAnterior } from "@/core/data/db";
import type { Routine } from "@/core/data/types";

/**
 * O app se chamava Almore e o banco no aparelho tinha esse nome. IndexedDB
 * não renomeia banco: nome novo é banco novo e vazio. Sem esta cópia, quem
 * já usava o app abriria o SériePro sem nada — e o aparelho é a única
 * cópia dos dados. É o caminho mais arriscado do app.
 */

const ANTIGO = "almore";
const DESTINO = "seriepro-teste-migracao";

function rotina(id: string, name: string): Routine {
  return {
    id,
    name,
    description: null,
    isActive: false,
    archivedAt: null,
    createdAt: new Date().toISOString(),
  };
}

async function criaBancoAntigo(rotinas: Routine[]) {
  const antigo = new SerieProDb(ANTIGO);
  await antigo.open();
  await antigo.routines.bulkPut(rotinas);
  antigo.close();
}

let destino: SerieProDb;

beforeEach(async () => {
  await Dexie.delete(ANTIGO);
  await Dexie.delete(DESTINO);
  destino = new SerieProDb(DESTINO);
  await destino.open();
});

afterEach(async () => {
  destino.close();
  await Dexie.delete(ANTIGO);
  await Dexie.delete(DESTINO);
});

describe("migração do banco antigo", () => {
  it("traz os dados de quem já usava o app", async () => {
    await criaBancoAntigo([rotina("r1", "Push Pull Legs"), rotina("r2", "Full Body")]);

    await migraDoBancoAnterior(destino);

    const vieram = await destino.routines.orderBy("id").toArray();
    expect(vieram.map((r) => r.name)).toEqual(["Push Pull Legs", "Full Body"]);
  });

  it("não apaga o banco antigo, que fica como rede de segurança", async () => {
    await criaBancoAntigo([rotina("r1", "Programa")]);

    await migraDoBancoAnterior(destino);

    expect(await Dexie.exists(ANTIGO)).toBe(true);
  });

  it("não ressuscita dados apagados de propósito depois da migração", async () => {
    await criaBancoAntigo([rotina("r1", "Programa")]);
    await migraDoBancoAnterior(destino);

    // O usuário apaga tudo dentro do app.
    await destino.routines.clear();
    // Próxima abertura: a marca em meta impede repetir a cópia.
    await migraDoBancoAnterior(destino);

    expect(await destino.routines.count()).toBe(0);
  });

  it("não duplica quando roda duas vezes seguidas", async () => {
    await criaBancoAntigo([rotina("r1", "Programa")]);

    await migraDoBancoAnterior(destino);
    await migraDoBancoAnterior(destino);

    expect(await destino.routines.count()).toBe(1);
  });

  it("em aparelho novo não faz nada, e marca para não checar de novo", async () => {
    expect(await Dexie.exists(ANTIGO)).toBe(false);

    await migraDoBancoAnterior(destino);

    expect(await destino.routines.count()).toBe(0);
    expect(await destino.meta.count()).toBe(1);
  });

  it("não sobrescreve o que já existe no banco novo com o mesmo id", async () => {
    await criaBancoAntigo([rotina("r1", "Nome antigo")]);
    await destino.routines.put(rotina("r2", "Criado no app novo"));

    await migraDoBancoAnterior(destino);

    const nomes = (await destino.routines.orderBy("id").toArray()).map((r) => r.name);
    expect(nomes).toContain("Criado no app novo");
    expect(nomes).toContain("Nome antigo");
  });
});
