/**
 * UUID v4 gerado no cliente, para a série ter identidade antes de chegar ao
 * banco. É isso que torna o registro idempotente: a nova tentativa depois de
 * um timeout manda o mesmo id e cai no mesmo registro.
 *
 * `crypto.randomUUID` só existe em contexto seguro (HTTPS ou localhost).
 * Abrir o servidor de desenvolvimento pelo IP da rede local, no celular, não
 * é contexto seguro — daí a alternativa com `getRandomValues`, que existe em
 * qualquer contexto.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // versão 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
