import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Só aceita caminhos internos (evita redirecionar para outro site). */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

/**
 * Destino dos links dos e-mails (confirmar cadastro, nova senha). Aceita os dois formatos do Supabase:
 * - ?token_hash=...&type=email  (template de e-mail recomendado no README; funciona
 *   mesmo se o link for aberto em outro navegador, ex.: o app do Gmail no celular)
 * - ?code=...                   (template padrão do Supabase, fluxo PKCE)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNext(params.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  redirect(ok ? next : "/entrar?erro=link");
}
