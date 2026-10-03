import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/core/auth/server";
import { safeInternalPath } from "@/core/utils/safe-path";

/** Destino dos links de confirmação de e-mail e de redefinição de senha. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
}
