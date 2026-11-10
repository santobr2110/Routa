
/**
 * E-mail automático pelo Resend (https://resend.com), sem biblioteca: só a API HTTP.
 * Liga sozinho quando RESEND_API_KEY e EMAIL_FROM estão configurados; sem eles, não envia
 * nada (e nada quebra). O envio nunca bloqueia a inscrição: erro vira só um log.
 */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("sendEmail", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("sendEmail", error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** E-mail de inscrição recebida, com o link da página do inscrito. */
export function registrationEmail(input: {
  name: string;
  tripTitle: string;
  dates: string;
  organizerName: string;
  status: "confirmed" | "waitlist";
  link: string;
}): { subject: string; html: string; text: string } {
  const first = input.name.trim().split(/\s+/)[0] ?? input.name;
  const confirmed = input.status === "confirmed";
  const subject = confirmed
    ? `Vaga garantida: ${input.tripTitle}`
    : `Lista de espera: ${input.tripTitle}`;
  const lead = confirmed
    ? `Sua vaga no ${input.tripTitle} (${input.dates}) está garantida. Falta só o pagamento: na sua página da inscrição tem o Pix com o valor certo.`
    : `As vagas do ${input.tripTitle} (${input.dates}) lotaram, mas você entrou na lista de espera. Se abrir uma vaga, você sobe por ordem da fila e ${input.organizerName} te avisa.`;
  const after =
    "Na página você também vê as informações da viagem e os avisos do organizador. O link é só seu: guarde e não compartilhe no grupo.";

  const text = `Oi, ${first}!\n\n${lead}\n\nSua página da inscrição: ${input.link}\n\n${after}\n\nRouta · Bora de cara pro vento?`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#fafaf9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:18px;font-weight:600;margin:0 0 12px">Oi, ${escapeHtml(first)}!</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px">${escapeHtml(lead)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Abrir minha inscrição</a></p>
<p style="font-size:13px;line-height:1.6;color:#57534e;margin:0 0 8px">${escapeHtml(after)}</p>
<p style="font-size:12px;color:#a8a29e;margin:24px 0 0">Routa · Bora de cara pro vento?</p>
</div></body></html>`;
  return { subject, html, text };
}
