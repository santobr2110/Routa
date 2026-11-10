// Raio-X do comboio (migration 0016): perguntas, validação e análise do grupo.
import { bikeSpec, ccBand, type BikeStyle, type CcBand } from "@/lib/bike-specs";
import type { TripLevel, TripTerrain } from "@/types/database";

export type QuestionMode = "off" | "optional" | "required";
export type Experience = "first" | "some" | "experienced" | "veteran";
export type Offroad = "never" | "some" | "lots";
export type Skill = "mechanic" | "first_aid" | "toolkit";

export type ConvoySettings = {
  range: QuestionMode;
  experience: QuestionMode;
  skills: QuestionMode;
  longest_stretch_km: number | null;
};

export type ConvoyProfile = {
  range_km: number | null;
  range_unknown: boolean;
  experience: Experience | null;
  offroad: Offroad | null;
  skills: Skill[];
  cc: number | null;
  cc_band: CcBand | null;
  style?: BikeStyle | null;
};

/** Resumo anônimo do grupo (private.convoy_summary): só contagens dos confirmados. */
export type ConvoySummary = {
  bikes: number;
  answered: number;
  cc_bands: Record<CcBand, number>;
  experience: Record<Experience, number>;
  skills: Record<Skill, number>;
  min_range_km: number | null;
};

/** Margem da autonomia sobre o maior trecho sem posto (decisão do Bruno: 20%). */
export const RANGE_MARGIN = 1.2;

export const QUESTION_MODES: Record<QuestionMode, string> = {
  off: "Não perguntar",
  optional: "Opcional",
  required: "Obrigatória",
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  first: "Primeira viagem",
  some: "Já fiz algumas (até 5)",
  experienced: "Experiente (mais de 5)",
  veteran: "Muito experiente (viagens longas ou fora do país)",
};
export const EXPERIENCE_SHORT: Record<Experience, string> = {
  first: "Primeira viagem",
  some: "Algumas viagens",
  experienced: "Experiente",
  veteran: "Muito experiente",
};

export const OFFROAD_LABELS: Record<Offroad, string> = {
  never: "Nunca andei na terra",
  some: "Já andei um pouco",
  lots: "Ando bastante na terra",
};
export const OFFROAD_SHORT: Record<Offroad, string> = {
  never: "Nunca na terra",
  some: "Pouco na terra",
  lots: "Bastante na terra",
};

export const SKILL_LABELS: Record<Skill, string> = {
  mechanic: "Sei mecânica básica (pneu, corrente, ajustes)",
  first_aid: "Sei primeiros socorros",
  toolkit: "Levo kit de ferramentas / reparo de pneu",
};
export const SKILL_SHORT: Record<Skill, string> = {
  mechanic: "Mecânica básica",
  first_aid: "Primeiros socorros",
  toolkit: "Kit de ferramentas",
};

const EXPERIENCES = Object.keys(EXPERIENCE_LABELS) as Experience[];
const OFFROADS = Object.keys(OFFROAD_LABELS) as Offroad[];
const SKILLS = Object.keys(SKILL_LABELS) as Skill[];
const CC_BANDS: CcBand[] = ["up_to_300", "300_700", "700_1000", "over_1000"];

/** O Raio-X está ligado nesta viagem (pelo menos uma pergunta)? */
export function convoyOn(s: ConvoySettings | null | undefined): s is ConvoySettings {
  return !!s && (s.range !== "off" || s.experience !== "off" || s.skills !== "off");
}

export type ConvoyField = "convoy_range" | "convoy_experience" | "convoy_cc_band";

/**
 * Lê as respostas do formulário (inscrição ou página do inscrito).
 * Campos: convoy_range_km, convoy_range_unknown, convoy_experience, convoy_offroad,
 * convoy_skills (vários), convoy_cc_band (só quando o modelo não está na tabela).
 */
export function parseConvoyForm(
  formData: FormData,
  settings: ConvoySettings,
  bike: { brand: string; model: string },
): { profile: ConvoyProfile; errors: Partial<Record<ConvoyField, string>> } {
  const errors: Partial<Record<ConvoyField, string>> = {};
  const text = (k: string) => String(formData.get(k) ?? "").trim();

  let rangeKm: number | null = null;
  let rangeUnknown = false;
  if (settings.range !== "off") {
    rangeUnknown = text("convoy_range_unknown") === "on";
    const raw = text("convoy_range_km").replace(/\D/g, "");
    if (!rangeUnknown && raw) {
      const n = Number(raw);
      if (n >= 30 && n <= 2000) rangeKm = n;
      else errors.convoy_range = "Coloca a autonomia em km, entre 30 e 2000. Ou marca \"não sei\".";
    } else if (!rangeUnknown && settings.range === "required") {
      errors.convoy_range = "Quantos km a moto faz com o tanque cheio? Se não souber, marca \"não sei\".";
    }
  }

  let experience: Experience | null = null;
  let offroad: Offroad | null = null;
  if (settings.experience !== "off") {
    const e = text("convoy_experience") as Experience;
    const o = text("convoy_offroad") as Offroad;
    experience = EXPERIENCES.includes(e) ? e : null;
    offroad = OFFROADS.includes(o) ? o : null;
    if (settings.experience === "required" && (!experience || !offroad)) {
      errors.convoy_experience = "Conta sua experiência na estrada e na terra.";
    }
  }

  const skills =
    settings.skills !== "off"
      ? SKILLS.filter((s) => formData.getAll("convoy_skills").map(String).includes(s))
      : [];

  const spec = bikeSpec(bike.brand, bike.model);
  const bandRaw = text("convoy_cc_band") as CcBand;
  const band = spec ? ccBand(spec.cc) : CC_BANDS.includes(bandRaw) ? bandRaw : null;

  return {
    profile: {
      range_km: rangeKm,
      range_unknown: rangeUnknown,
      experience,
      offroad,
      skills,
      cc: spec?.cc ?? null,
      cc_band: band,
      style: spec?.style ?? null,
    },
    errors,
  };
}

/** Argumentos de save_convoy_profile. */
export function profileRpcArgs(token: string, p: ConvoyProfile) {
  return {
    p_token: token,
    p_range_km: p.range_km,
    p_range_unknown: p.range_unknown,
    p_experience: p.experience,
    p_offroad: p.offroad,
    p_skills: p.skills,
    p_cc: p.cc,
    p_cc_band: p.cc_band,
    p_style: p.style ?? null,
  };
}

// ---------------------------------------------------------------------------
// Análise para o organizador
// ---------------------------------------------------------------------------

export type ConvoyRider = {
  id: string;
  name: string;
  bike: string;
  has_pillion: boolean;
  profile: (ConvoyProfile & { style: BikeStyle | null }) | null;
  /** Da tabela de modelos: vale mesmo para quem ainda não respondeu. */
  spec: { cc: number; style: BikeStyle } | null;
};

const riderCc = (r: ConvoyRider) => r.profile?.cc ?? r.spec?.cc ?? null;
const riderBand = (r: ConvoyRider) =>
  r.profile?.cc_band ?? (r.spec ? ccBand(r.spec.cc) : null);
const riderStyle = (r: ConvoyRider) => r.profile?.style ?? r.spec?.style ?? null;

export type ConvoyAlert = {
  tone: "danger" | "warn" | "info";
  title: string;
  detail?: string;
  people?: string[];
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Alertas e números do comboio (só confirmados). */
export function analyzeConvoy(
  trip: { level: TripLevel; terrain: TripTerrain; settings: ConvoySettings },
  riders: ConvoyRider[],
) {
  const s = trip.settings;
  const answered = riders.filter((r) => r.profile);
  const alerts: ConvoyAlert[] = [];

  // Autonomia x maior trecho sem posto.
  if (s.range !== "off" && s.longest_stretch_km) {
    const need = Math.ceil(s.longest_stretch_km * RANGE_MARGIN);
    const short = answered.filter((r) => r.profile!.range_km !== null && r.profile!.range_km < need);
    if (short.length > 0) {
      alerts.push({
        tone: "danger",
        title: `${short.length} moto${short.length === 1 ? "" : "s"} com autonomia curta`,
        detail: `O maior trecho sem posto tem ${s.longest_stretch_km} km. Com margem de 20%, o ideal é fazer pelo menos ${need} km com um tanque. Combine um galão extra ou uma parada a mais.`,
        people: short.map((r) => `${firstName(r.name)} · ${r.profile!.range_km} km`),
      });
    }
    const unknown = answered.filter((r) => r.profile!.range_unknown);
    if (unknown.length > 0) {
      alerts.push({
        tone: "warn",
        title: `${unknown.length} não ${unknown.length === 1 ? "sabe" : "sabem"} a autonomia da moto`,
        detail: `Vale perguntar antes: o maior trecho sem posto tem ${s.longest_stretch_km} km.`,
        people: unknown.map((r) => `${firstName(r.name)} · ${r.bike}`),
      });
    }
  }

  // Experiência x nível da viagem.
  if (s.experience !== "off") {
    if (trip.level === "experienced") {
      const first = answered.filter((r) => r.profile!.experience === "first");
      if (first.length > 0) {
        alerts.push({
          tone: "danger",
          title: `Primeira viagem numa viagem para estradeiro experiente`,
          detail: "Vale uma conversa antes e colocar a pessoa perto do ponteiro ou do fecha-fila.",
          people: first.map((r) => firstName(r.name)),
        });
      }
    }
    if (trip.terrain !== "asphalt") {
      const never = answered.filter((r) => r.profile!.offroad === "never");
      if (never.length > 0) {
        alerts.push({
          tone: trip.terrain === "offroad" ? "danger" : "warn",
          title: `${never.length} nunca ${never.length === 1 ? "andou" : "andaram"} na terra`,
          detail:
            trip.terrain === "offroad"
              ? "A viagem é off-road. Confirme se a moto e o piloto estão preparados."
              : "A viagem tem trechos de terra. Explique como são e combine o ritmo.",
          people: never.map((r) => `${firstName(r.name)} · ${r.bike}`),
        });
      }
    }
  }

  // Mistura de cilindradas.
  const ccs = riders.map(riderCc).filter((c): c is number => !!c);
  const bands = new Set(riders.map(riderBand).filter(Boolean));
  const minCc = ccs.length ? Math.min(...ccs) : null;
  const maxCc = ccs.length ? Math.max(...ccs) : null;
  if (
    (minCc && maxCc && maxCc / minCc >= 3) ||
    (bands.has("up_to_300") && bands.has("over_1000"))
  ) {
    alerts.push({
      tone: "warn",
      title: "Cilindradas bem diferentes no mesmo grupo",
      detail: `${minCc && maxCc ? `De ${minCc}cc a ${maxCc}cc. ` : ""}As motos menores definem o ritmo: combine velocidade de cruzeiro e pontos de reagrupamento.`,
    });
  }

  // Habilidades que faltam.
  if (s.skills !== "off" && answered.length > 0) {
    for (const skill of ["first_aid", "mechanic", "toolkit"] as Skill[]) {
      if (!answered.some((r) => r.profile!.skills.includes(skill))) {
        alerts.push({
          tone: "info",
          title:
            skill === "first_aid"
              ? "Ninguém marcou primeiros socorros"
              : skill === "mechanic"
                ? "Ninguém marcou mecânica básica"
                : "Ninguém disse que leva kit de ferramentas",
          detail:
            skill === "toolkit"
              ? "Vale levar você mesmo um kit de reparo de pneu e as ferramentas básicas."
              : "Vale levar um kit e combinar o que fazer num imprevisto.",
        });
      }
    }
  }

  const missing = riders.filter((r) => !r.profile);
  if (missing.length > 0 && convoyOn(s)) {
    alerts.push({
      tone: "info",
      title: `${missing.length} ainda não ${missing.length === 1 ? "respondeu" : "responderam"} o Raio-X`,
      detail: "Mande o pedido pela aba Cobrança e avisos: cada um responde pelo link pessoal.",
      people: missing.map((r) => firstName(r.name)),
    });
  }

  const order = { danger: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => order[a.tone] - order[b.tone]);

  const count = <K extends string>(
    keys: readonly K[],
    pick: (r: ConvoyRider) => K | K[] | null | undefined,
    from: ConvoyRider[] = answered,
  ) =>
    keys.map((k) => ({
      key: k,
      names: from
        .filter((r) => {
          const v = pick(r);
          return Array.isArray(v) ? v.includes(k) : v === k;
        })
        .map((r) => firstName(r.name)),
    }));

  const ranges = answered.map((r) => r.profile!.range_km).filter((v): v is number => v !== null);
  return {
    riders: riders.length,
    answered: answered.length,
    alerts,
    minCc,
    maxCc,
    minRange: ranges.length ? Math.min(...ranges) : null,
    pillions: riders.filter((r) => r.has_pillion).length,
    ccBands: count(CC_BANDS, riderBand, riders),
    styles: count(["trail", "street", "touring", "custom", "sport", "scooter"] as BikeStyle[], riderStyle, riders),
    experience: count(EXPERIENCES, (r) => r.profile?.experience),
    offroad: count(OFFROADS, (r) => r.profile?.offroad),
    skills: count(SKILLS, (r) => r.profile?.skills),
  };
}
