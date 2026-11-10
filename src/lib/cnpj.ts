// CNPJ: validação dos dígitos e consulta pública na BrasilAPI (dados da Receita Federal).

/** Só os 14 dígitos, ou null se não for um CNPJ válido (dígitos verificadores conferidos). */
export function normalizeCnpj(raw: string): string | null {
  const cnpj = raw.replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return null;
  const digit = (base: string) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = [...base].reduce((total, d, i) => total + Number(d) * weights[i]!, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(cnpj.slice(0, 12));
  const second = digit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`) ? cnpj : null;
}

/** 11222333000181 → 11.222.333/0001-81 */
export function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Atividades (CNAE) de turismo aceitas sem alerta. Outras atividades não bloqueiam:
 * só aparecem como alerta para quem revisa o pedido.
 */
export const TOURISM_CNAES: Record<string, string> = {
  "7911200": "Agências de viagens",
  "7912100": "Operadores turísticos",
  "7990200": "Serviços de reservas e outros serviços de turismo",
  "4929904": "Organização de excursões em veículos rodoviários próprios",
};

export type CnpjLookup =
  | {
      status: "found";
      active: boolean;
      situation: string;
      legalName: string;
      tradeName: string | null;
      /** CNAEs de turismo encontrados (principal ou secundários). */
      tourismActivities: string[];
      mainActivity: string;
    }
  | { status: "not_found" }
  | { status: "unavailable" };

type BrasilApiCnpj = {
  descricao_situacao_cadastral?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: { codigo?: number | string; descricao?: string }[];
};

/** Consulta o CNPJ na BrasilAPI. Nunca lança erro: devolve "unavailable" se a API falhar. */
export async function lookupCnpj(cnpj: string): Promise<CnpjLookup> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (res.status === 404 || res.status === 400) return { status: "not_found" };
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as BrasilApiCnpj;

    const codes = [
      String(data.cnae_fiscal ?? ""),
      ...(data.cnaes_secundarios ?? []).map((c) => String(c.codigo ?? "")),
    ];
    const tourismActivities = codes
      .filter((code) => code in TOURISM_CNAES)
      .map((code) => TOURISM_CNAES[code]!);
    const situation = (data.descricao_situacao_cadastral ?? "").toUpperCase();

    return {
      status: "found",
      active: situation === "ATIVA",
      situation: situation || "DESCONHECIDA",
      legalName: data.razao_social ?? "",
      tradeName: data.nome_fantasia || null,
      tourismActivities: [...new Set(tourismActivities)],
      mainActivity: data.cnae_fiscal_descricao ?? "",
    };
  } catch {
    return { status: "unavailable" };
  }
}
