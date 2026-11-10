"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth";
import { CADASTUR_BUCKET, normalizeCertificateNumber, todayBR } from "@/lib/cadastur";
import { lookupCnpj, normalizeCnpj } from "@/lib/cnpj";
import { createClient } from "@/lib/supabase/server";

export type CadasturField = "cnpj" | "certificate_number" | "valid_until" | "file";
export type CadasturValues = Record<Exclude<CadasturField, "file">, string>;
export type CadasturCheck = {
  errors?: Partial<Record<CadasturField | "form", string>>;
  /** Dados prontos para gravar, se tudo certo. */
  data?: { cnpj: string; certificate_number: string; valid_until: string };
  /** Nome da empresa na Receita, para a pessoa conferir. */
  legalName?: string;
};

/** Data máxima de validade aceita: hoje + 5 anos (o certificado vale 2). */
function maxValidUntil(): string {
  const [y, m, d] = todayBR().split("-");
  return `${Number(y) + 5}-${m}-${d}`;
}

/** Confere os campos e o CNPJ na Receita (BrasilAPI). Não grava nada. */
export async function checkCadasturRequest(values: CadasturValues): Promise<CadasturCheck> {
  await requireOrganizer();
  const errors: CadasturCheck["errors"] = {};

  const cnpj = normalizeCnpj(values.cnpj);
  if (!cnpj) errors.cnpj = "CNPJ inválido. Confere os números, ex.: 11.222.333/0001-81.";
  const certificate = normalizeCertificateNumber(values.certificate_number);
  if (!certificate) errors.certificate_number = "Coloca o número do certificado Cadastur como aparece nele.";
  const validUntil = /^\d{4}-\d{2}-\d{2}$/.test(values.valid_until) ? values.valid_until : null;
  if (!validUntil) errors.valid_until = "Escolhe a data de validade do certificado.";
  else if (validUntil <= todayBR()) errors.valid_until = "Esse certificado já venceu. Renove no Cadastur e envie o novo.";
  else if (validUntil > maxValidUntil()) errors.valid_until = "Confere a data: a validade parece longa demais.";

  if (Object.keys(errors).length > 0) return { errors };

  // A BrasilAPI ajuda, mas não decide sozinha: fora do ar, segue para a revisão humana.
  const lookup = await lookupCnpj(cnpj!);
  if (lookup.status === "not_found") {
    return { errors: { cnpj: "Não achamos esse CNPJ na Receita Federal. Confere os números." } };
  }
  if (lookup.status === "found" && !lookup.active) {
    return {
      errors: {
        cnpj: `Na Receita, esse CNPJ está com situação "${lookup.situation}". O selo é só para empresas ativas.`,
      },
    };
  }

  return {
    data: { cnpj: cnpj!, certificate_number: certificate!, valid_until: validUntil! },
    legalName: lookup.status === "found" ? lookup.legalName : undefined,
  };
}

/** Grava o pedido depois que o arquivo do certificado já subiu para o Storage. */
export async function submitCadasturRequest(
  values: CadasturValues,
  certificatePath: string,
): Promise<{ error?: string }> {
  const { user } = await requireOrganizer();
  const check = await checkCadasturRequest(values);
  if (!check.data) return { error: Object.values(check.errors ?? {})[0] ?? "Confere os dados." };
  if (!certificatePath.startsWith(`${user.id}/`)) return { error: "Arquivo inválido. Envia de novo." };

  const supabase = await createClient();
  const { error } = await supabase.from("cadastur_verifications").insert({
    organizer_id: user.id,
    ...check.data,
    certificate_path: certificatePath,
  });

  if (error) {
    if (error.code === "23505") return { error: "Você já tem um pedido em análise. É só aguardar." };
    console.error("cadastur_verifications insert", error);
    return { error: "Não deu para enviar agora. Tenta de novo." };
  }

  revalidatePath("/painel/perfil");
  revalidatePath("/painel");
  return {};
}

/** Remove um arquivo enviado quando o pedido não chegou a ser gravado. */
export async function discardCertificateFile(certificatePath: string): Promise<void> {
  const { user } = await requireOrganizer();
  if (!certificatePath.startsWith(`${user.id}/`)) return;
  const supabase = await createClient();
  await supabase.storage.from(CADASTUR_BUCKET).remove([certificatePath]);
}
