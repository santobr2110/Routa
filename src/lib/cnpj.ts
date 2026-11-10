// CNPJ: validação dos dígitos e consulta pública dos dados da Receita Federal.
//
// Consultamos até 3 serviços gratuitos, em ordem, porque eles às vezes ficam lentos, fora do
// ar ou limitam pedidos vindos de servidores na nuvem (como a Vercel):
// 1. BrasilAPI  2. Minha Receita  3. CNPJ.ws (pública: 3 consultas por minuto)
// Os dados são os mesmos (base pública da Receita); só o formato da resposta muda.

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
      /** Qual serviço respondeu (aparece para o admin). */
      source: string;
    }
  | { status: "not_found" }
  | { status: "unavailable" };

/** Dados no formato comum, antes de virar CnpjLookup. */
type Company = {
  situation: string;
  legalName: string;
  tradeName: string | null;
  mainCode: string;
  mainActivity: string;
  secondaryCodes: string[];
};

type Provider = {
  name: string;
  url: (cnpj: string) => string;
  parse: (data: unknown) => Company | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const digits = (v: unknown): string => str(v).replace(/\D/g, "");

/** BrasilAPI e Minha Receita usam o mesmo formato (campos da base da Receita). */
function parseReceitaFormat(data: unknown): Company | null {
  const d = obj(data);
  if (!d.razao_social) return null;
  return {
    situation: str(d.descricao_situacao_cadastral),
    legalName: str(d.razao_social),
    tradeName: str(d.nome_fantasia) || null,
    mainCode: digits(d.cnae_fiscal),
    mainActivity: str(d.cnae_fiscal_descricao),
    secondaryCodes: (Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios : []).map((c) =>
      digits(obj(c).codigo),
    ),
  };
}

/** CNPJ.ws: os dados da empresa ficam dentro de "estabelecimento". */
function parseCnpjWs(data: unknown): Company | null {
  const d = obj(data);
  const e = obj(d.estabelecimento);
  if (!d.razao_social) return null;
  const main = obj(e.atividade_principal);
  return {
    situation: str(e.situacao_cadastral),
    legalName: str(d.razao_social),
    tradeName: str(e.nome_fantasia) || null,
    mainCode: digits(main.id ?? main.subclasse),
    mainActivity: str(main.descricao),
    secondaryCodes: (Array.isArray(e.atividades_secundarias) ? e.atividades_secundarias : []).map(
      (a) => digits(obj(a).id ?? obj(a).subclasse),
    ),
  };
}

export const CNPJ_PROVIDERS: Provider[] = [
  { name: "BrasilAPI", url: (c) => `https://brasilapi.com.br/api/cnpj/v1/${c}`, parse: parseReceitaFormat },
  { name: "Minha Receita", url: (c) => `https://minhareceita.org/${c}`, parse: parseReceitaFormat },
  { name: "CNPJ.ws", url: (c) => `https://publica.cnpj.ws/cnpj/${c}`, parse: parseCnpjWs },
];

function toLookup(company: Company, source: string): CnpjLookup {
  const codes = [company.mainCode, ...company.secondaryCodes];
  const tourismActivities = codes.filter((c) => c in TOURISM_CNAES).map((c) => TOURISM_CNAES[c]!);
  const situation = company.situation.trim().toUpperCase();
  return {
    status: "found",
    active: situation === "ATIVA",
    situation: situation || "DESCONHECIDA",
    legalName: company.legalName,
    tradeName: company.tradeName,
    tourismActivities: [...new Set(tourismActivities)],
    mainActivity: company.mainActivity,
    source,
  };
}

/**
 * Consulta o CNPJ nos serviços, em ordem, até um responder. Nunca lança erro.
 * "not_found" só quando um serviço diz claramente que o CNPJ não existe (404).
 * Se nenhum responder, devolve "unavailable" (e a revisão humana confere à mão).
 */
export async function lookupCnpj(
  cnpj: string,
  providers: Provider[] = CNPJ_PROVIDERS,
  fetcher: typeof fetch = fetch,
): Promise<CnpjLookup> {
  for (const provider of providers) {
    try {
      const res = await fetcher(provider.url(cnpj), {
        headers: { Accept: "application/json", "User-Agent": "Routa/1.0 (verificacao de selo)" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.status === 404) return { status: "not_found" };
      if (!res.ok) {
        console.warn(`cnpj: ${provider.name} respondeu ${res.status}`);
        continue;
      }
      const company = provider.parse(await res.json());
      if (company) return toLookup(company, provider.name);
      console.warn(`cnpj: ${provider.name} devolveu um formato inesperado`);
    } catch (error) {
      console.warn(`cnpj: ${provider.name} falhou`, error instanceof Error ? error.message : error);
    }
  }
  return { status: "unavailable" };
}
