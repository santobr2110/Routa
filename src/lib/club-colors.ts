/**
 * Cor do clube com contraste garantido (WCAG AA, 4,5:1).
 *
 * O organizador escolhe qualquer cor; daqui saem as variáveis CSS usadas por .club-theme,
 * uma para cada modo (claro e escuro): fundo do botão (ajustado até aparecer na página,
 * 3:1), texto do botão (branco ou preto, o que contrastar mais), cor de links (escurecida
 * ou clareada até 4,5:1) e fundos suaves.
 */

export const CLUB_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#c2410c", label: "Laranja Routa" },
  { hex: "#b91c1c", label: "Vermelho" },
  { hex: "#be185d", label: "Pink" },
  { hex: "#6d28d9", label: "Roxo" },
  { hex: "#1d4ed8", label: "Azul" },
  { hex: "#0f766e", label: "Petróleo" },
  { hex: "#15803d", label: "Verde" },
  { hex: "#a16207", label: "Mostarda" },
  { hex: "#475569", label: "Grafite" },
  { hex: "#1c1917", label: "Preto" },
];

type Rgb = [number, number, number];

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * amount) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const ch = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string | Rgb, b: string | Rgb): number {
  const la = luminance(typeof a === "string" ? toRgb(a) : a);
  const lb = luminance(typeof b === "string" ? toRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mistura a cor com `toward` aos poucos até contrastar `ratio`:1 com `background`. */
function untilContrast(color: Rgb, background: string, toward: Rgb, ratio = 4.5): Rgb {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  return toward;
}

/** Botão: fundo visível na página (3:1) e texto branco ou preto, o que contrastar mais. */
function button(color: Rgb, page: string, toward: Rgb) {
  const bg = untilContrast(color, page, toward, 3);
  const whiteText = contrast(bg, WHITE) >= contrast(bg, BLACK);
  return {
    bg: toHex(bg),
    on: whiteText ? "#ffffff" : "#000000",
    // Hover: escurece com texto branco, clareia com texto preto (mantém o contraste).
    hover: toHex(mix(bg, whiteText ? BLACK : WHITE, 0.18)),
  };
}

// Fundos do tema (globals.css): página clara, página e cartão escuros.
const LIGHT_PAGE = "#fafaf9";
const DARK_PAGE = "#0b1120";
const DARK_SURFACE = "#111a2e";
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** Variáveis CSS do tema do clube, para usar em style={...} junto da classe club-theme. */
export function clubThemeStyle(hex: string | null | undefined): React.CSSProperties | undefined {
  if (!hex || !isHexColor(hex)) return undefined;
  const color = toRgb(hex.toLowerCase());
  const light = button(color, LIGHT_PAGE, BLACK);
  const dark = button(color, DARK_PAGE, WHITE);
  return {
    "--club-brand-light": light.bg,
    "--club-on-brand-light": light.on,
    "--club-brand-hover-light": light.hover,
    "--club-brand-dark-mode": dark.bg,
    "--club-on-brand-dark-mode": dark.on,
    "--club-brand-hover-dark-mode": dark.hover,
    "--club-accent-light": toHex(untilContrast(color, LIGHT_PAGE, BLACK)),
    "--club-accent-dark": toHex(untilContrast(color, DARK_SURFACE, WHITE)),
    "--club-soft-light": toHex(mix(color, WHITE, 0.9)),
    "--club-soft-dark": toHex(mix(toRgb(DARK_SURFACE), color, 0.16)),
  } as React.CSSProperties;
}

/** Cor padrão da Routa (laranja). Sem cor no Site Settings, o site usa a do globals.css. */
export const ROUTA_COLOR = "#c2410c";

/**
 * Cor do site inteiro (Site Settings): as mesmas variáveis do clube, mais os destaques que
 * ficam sobre a foto escura (comboio, contagem, login). Vai no <body> com a classe club-theme;
 * a página de um clube, por dentro, troca de novo pela cor do clube.
 */
export function siteThemeStyle(hex: string | null | undefined): React.CSSProperties | undefined {
  const base = clubThemeStyle(hex);
  if (!base || !hex) return undefined;
  const color = toRgb(hex.toLowerCase());
  const onPhoto = button(color, DARK_PAGE, WHITE);
  return {
    ...base,
    "--hero-brand": onPhoto.bg,
    "--hero-on-brand": onPhoto.on,
    "--hero-accent": toHex(untilContrast(mix(color, WHITE, 0.35), DARK_PAGE, WHITE)),
  } as React.CSSProperties;
}
