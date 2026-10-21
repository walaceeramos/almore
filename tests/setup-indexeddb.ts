/**
 * Dá um IndexedDB ao Node, para os testes de `tests/data` exercitarem
 * `core/data` e `features/*\/actions.ts` sem navegador.
 *
 * O import tem efeito colateral: define `indexedDB` e `IDBKeyRange` no
 * global. Precisa acontecer antes de qualquer módulo que abra o Dexie, por
 * isso é `setupFiles` e não um import dentro do teste.
 *
 * Os testes de `tests/unit` não dependem disto: `core/domain` é puro.
 */
import "fake-indexeddb/auto";
