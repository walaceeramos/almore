import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/config/env";

/**
 * Cliente de servidor. Lê e grava a sessão nos cookies httpOnly.
 * Em Server Components a gravação é ignorada de propósito: quem renova
 * o token é o middleware.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component: sem acesso de escrita. O middleware cuida.
          }
        },
      },
    },
  );
}
