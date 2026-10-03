/**
 * Destino interno seguro para redirecionar depois do login ou de um link
 * de e-mail. `startsWith("/")` sozinho não basta: o navegador trata
 * `//host` como URL protocol-relative e `/\host` como equivalente, então
 * os dois saem do site. Querystring e fragmento são preservados.
 */
export function safeInternalPath(value: string | null | undefined, fallback = "/inicio"): string {
  if (!value) return fallback;
  if (value[0] !== "/") return fallback;
  if (value[1] === "/" || value[1] === "\\") return fallback;
  return value;
}
