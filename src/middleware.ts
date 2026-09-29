import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const AUTH_ROUTES = ["/entrar", "/cadastrar", "/recuperar-senha"];
const PUBLIC_PREFIXES = ["/auth", "/_next", "/favicon", "/manifest", "/icons"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Renova o token de acesso. Precisa vir antes de qualquer decisão de rota.
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return response;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    // Guarda o destino pretendido para voltar depois do login.
    if (pathname !== "/") url.searchParams.set("proximo", pathname + search);
    return NextResponse.redirect(url);
  }

  if (user && (isAuthRoute || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
