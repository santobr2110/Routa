// Proteção da inscrição contra robôs e inscrições falsas em massa.
// Roda só no servidor (é usado pela server action da inscrição).
//
// Camadas:
// 1. Cloudflare Turnstile: o "não sou robô" invisível do formulário, conferido aqui.
// 2. Prova assinada (HMAC): o banco só aceita a inscrição com uma assinatura que só o
//    servidor sabe gerar. Sem ela, chamar register_for_trip direto com a chave pública falha.
// 3. Limite por IP: o banco aceita no máximo 5 inscrições por IP a cada 10 minutos.
//    Guardamos só um hash do IP (com o segredo), nunca o IP.

import { createHash, createHmac } from "node:crypto";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Chave pública do Turnstile (vai para o navegador). Sem ela, o widget não aparece. */
export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function signingSecret(): string {
  const secret = process.env.REGISTRATION_SIGNING_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "REGISTRATION_SIGNING_SECRET ausente ou curto (mínimo 32 caracteres). Veja o README.",
    );
  }
  return secret;
}

/** IP de quem está se inscrevendo (a Vercel manda no x-forwarded-for). */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || null;
  return headers.get("x-real-ip");
}

/** Hash do IP com o segredo: serve para contar tentativas sem guardar o IP. */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${signingSecret()}:${ip}`).digest("hex");
}

/**
 * Confere o token do Turnstile na Cloudflare.
 * Sem TURNSTILE_SECRET_KEY configurado, deixa passar (útil no computador) e avisa no log.
 */
export async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("TURNSTILE_SECRET_KEY não configurado: a inscrição está sem o anti-robô.");
    }
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("turnstile recusou", data["error-codes"]);
    return data.success === true;
  } catch (error) {
    // Se a Cloudflare estiver fora do ar, melhor recusar do que abrir a porta para robôs.
    console.error("turnstile indisponível", error);
    return false;
  }
}

/**
 * Prova que esta inscrição passou pelo servidor da Routa.
 * O banco (register_for_trip) refaz a mesma conta com o mesmo segredo e compara.
 * Mensagem: "slug|whatsapp|ip_hash|issued_at" (issued_at em segundos; vale 5 minutos).
 */
export function signRegistration(slug: string, whatsapp: string, ipHash: string | null) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const message = `${slug}|${whatsapp}|${ipHash ?? ""}|${issuedAt}`;
  const proof = createHmac("sha256", signingSecret()).update(message).digest("hex");
  return { issuedAt, proof };
}
