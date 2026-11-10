const RESULTS: Record<string, { text: string; ok: boolean }> = {
  suspenso: {
    text: "Organizador suspenso. As viagens dele saíram do ar e as inscrições fecharam.",
    ok: true,
  },
  reativado: {
    text: "Organizador reativado. As viagens voltaram ao ar.",
    ok: true,
  },
  "fora-do-ar": {
    text: "Viagem tirada do ar. A página pública e as inscrições fecharam.",
    ok: true,
  },
  "no-ar": { text: "Viagem de volta no ar.", ok: true },
  excluida: {
    text: "Viagem excluída e na lixeira. O organizador vê o aviso com o motivo e não consegue restaurar.",
    ok: true,
  },
  restaurada: { text: "Viagem restaurada da lixeira.", ok: true },
  "sem-motivo": { text: "Escreva o motivo (pelo menos 3 letras).", ok: false },
  "voce-mesmo": { text: "Você não pode suspender a própria conta.", ok: false },
  erro: { text: "Não deu para salvar. Tente de novo.", ok: false },
};

/** Aviso do resultado de uma ação de moderação (vem na URL: ?resultado=...). */
export function ResultMessage({ code }: { code: unknown }) {
  const message = typeof code === "string" ? RESULTS[code] : undefined;
  if (!message) return null;
  return (
    <p
      className={`rounded-xl px-4 py-3 font-medium ${message.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
      role="status"
    >
      {message.text}
    </p>
  );
}
