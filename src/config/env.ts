import { z } from "zod";

const publicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL ausente ou inválida"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente"),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

type PublicEnv = z.infer<typeof publicEnv>;

let cache: PublicEnv | null = null;

/**
 * Valida na primeira leitura, não no import.
 *
 * Validar no escopo do módulo quebrava `next build` sem credenciais, e
 * build não deve exigir segredo. A falha continua existindo — só migrou
 * para o runtime, que é onde ela é útil: quem tenta falar com o Supabase
 * sem configuração recebe um erro nomeando a variável que falta.
 *
 * As referências a `process.env.NEXT_PUBLIC_*` ficam literais de propósito:
 * é assim que o bundler do Next as substitui em tempo de build.
 */
function read(): PublicEnv {
  if (cache) return cache;

  const parsed = publicEnv.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) {
    const motivos = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Configuração de ambiente inválida: ${motivos}`);
  }

  cache = parsed.data;
  return cache;
}

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return read().NEXT_PUBLIC_SUPABASE_URL;
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return read().NEXT_PUBLIC_SUPABASE_ANON_KEY;
  },
  get NEXT_PUBLIC_SITE_URL() {
    return read().NEXT_PUBLIC_SITE_URL;
  },
};

/** Função, não constante: constante voltaria a validar no import. */
export function siteUrl(): string {
  return read().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
