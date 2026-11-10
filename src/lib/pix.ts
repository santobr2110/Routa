/**
 * Pix "copia e cola" (BR Code estático) com valor e identificador, sem gateway e sem taxa.
 *
 * Segue o Manual de Padrões para Iniciação do Pix (Banco Central): campos EMV no formato
 * ID (2 dígitos) + tamanho (2 dígitos) + valor, terminando com o CRC16-CCITT (campo 63).
 * O dinheiro vai direto da conta de quem paga para a chave do organizador; a Routa só
 * monta o código. O pagamento continua sendo marcado à mão pelo organizador.
 */

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";
export type PixKey = { type: PixKeyType; value: string };

export const PIX_KEY_LABELS: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Celular",
  email: "E-mail",
  random: "Chave aleatória",
};

function validCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(d[len])) return false;
  }
  return true;
}

function validCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/**
 * Entende a chave como o organizador digitou e devolve no formato que o Pix exige
 * (celular com +55, CPF/CNPJ só com números, e-mail minúsculo). Null se não reconhecer.
 *
 * Ambiguidade: 11 números podem ser CPF ou celular. Se for um CPF válido, vale CPF;
 * para forçar celular, o organizador escreve com +55 (a tela mostra como entendemos).
 */
export function parsePixKey(input: string): PixKey | null {
  const raw = input.trim();
  if (!raw) return null;

  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 77
      ? { type: "email", value: email }
      : null;
  }

  if (/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(raw)) {
    const hex = raw.replace(/-/g, "").toLowerCase();
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return { type: "random", value: uuid };
  }

  // Só números e pontuação comum de documento/telefone.
  if (!/^\+?[\d\s().\-/]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) {
    return /^55\d{10,11}$/.test(digits) ? { type: "phone", value: `+${digits}` } : null;
  }
  if (digits.length === 14) return validCnpj(digits) ? { type: "cnpj", value: digits } : null;
  if (digits.length === 11 && validCpf(digits)) return { type: "cpf", value: digits };
  if (/^\d{2}9\d{8}$/.test(digits)) return { type: "phone", value: `+55${digits}` };
  if (/^55\d{2}9\d{8}$/.test(digits)) return { type: "phone", value: `+${digits}` };
  return null;
}

/** Chave como mostrar na tela (com pontuação). */
export function formatPixKey(key: PixKey): string {
  const v = key.value;
  switch (key.type) {
    case "cpf":
      return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
    case "cnpj":
      return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
    case "phone": {
      const n = v.slice(3);
      return `+55 (${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`;
    }
    default:
      return v;
  }
}

/** Texto em maiúsculas, sem acento e só com caracteres aceitos pelos bancos. */
function plain(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Identificador do pagamento a partir do id da inscrição: "ROUTA" + 20 letras/números. */
export function pixTxid(registrationId: string): string {
  return `ROUTA${registrationId.replace(/[^0-9a-f]/gi, "").slice(0, 20).toUpperCase()}`;
}

/**
 * Monta o Pix copia e cola. Null se a chave não for reconhecida (aí a tela mostra só a chave).
 * amountCents null = sem valor (quem paga digita, usado no rateio).
 */
export function pixPayload({
  key,
  name,
  amountCents,
  txid,
  city = "BRASIL",
}: {
  key: string;
  name: string;
  amountCents: number | null;
  txid?: string;
  city?: string;
}): string | null {
  const parsed = parsePixKey(key);
  if (!parsed) return null;
  const merchantName = plain(name, 25) || "ORGANIZADOR";
  const merchantCity = plain(city, 15) || "BRASIL";
  const id = txid ? txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***" : "***";

  const body =
    field("00", "01") +
    field("26", field("00", "br.gov.bcb.pix") + field("01", parsed.value)) +
    field("52", "0000") +
    field("53", "986") +
    (amountCents !== null && amountCents > 0 ? field("54", (amountCents / 100).toFixed(2)) : "") +
    field("58", "BR") +
    field("59", merchantName) +
    field("60", merchantCity) +
    field("62", field("05", id)) +
    "6304";
  return body + crc16(body);
}
