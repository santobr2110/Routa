"use client";

import { useRef, useState } from "react";
import { CADASTUR_BUCKET, CADASTUR_FILE_TYPES, CADASTUR_MAX_BYTES } from "@/lib/cadastur";
import { createClient } from "@/lib/supabase/client";
import {
  checkCadasturRequest,
  discardCertificateFile,
  submitCadasturRequest,
  type CadasturField,
  type CadasturValues,
} from "./cadastur-actions";

type Errors = Partial<Record<CadasturField | "form", string>>;

/** Pedido do selo: confere os dados, sobe o certificado e grava o pedido. */
export function CadasturForm({ organizerId }: { organizerId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: CadasturValues = {
      cnpj: String(form.get("cnpj") ?? ""),
      certificate_number: String(form.get("certificate_number") ?? ""),
      valid_until: String(form.get("valid_until") ?? ""),
    };
    const file = fileRef.current?.files?.[0];

    const next: Errors = {};
    if (!file) next.file = "Anexa o certificado (PDF ou foto).";
    else if (!(file.type in CADASTUR_FILE_TYPES)) next.file = "Envia em PDF, JPG ou PNG.";
    else if (file.size > CADASTUR_MAX_BYTES) next.file = "O arquivo pode ter até 10 MB.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy("Conferindo o CNPJ na Receita…");
    try {
      const check = await checkCadasturRequest(values);
      if (check.errors) {
        setErrors(check.errors);
        return;
      }

      setBusy("Enviando o certificado…");
      const path = `${organizerId}/${crypto.randomUUID()}.${CADASTUR_FILE_TYPES[file!.type]}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(CADASTUR_BUCKET)
        .upload(path, file!, { contentType: file!.type });
      if (uploadError) {
        setErrors({ file: "Não deu para enviar o arquivo. Tenta de novo." });
        return;
      }

      setBusy("Enviando o pedido…");
      const result = await submitCadasturRequest(values, path);
      if (result.error) {
        await discardCertificateFile(path);
        setErrors({ form: result.error });
        return;
      }
      setSent(true);
    } catch {
      setErrors({ form: "Não deu para enviar agora. Tenta de novo." });
    } finally {
      setBusy(null);
    }
  }

  if (sent) {
    return (
      <p className="rounded-xl bg-success-soft px-4 py-3 font-medium text-success" role="status">
        Pedido enviado! A gente confere no Cadastur e te avisa por aqui, normalmente em até 2 dias
        úteis.
      </p>
    );
  }

  const error = (name: CadasturField) =>
    errors[name] && (
      <p id={`${name}-error`} className="field-error" role="alert">
        {errors[name]}
      </p>
    );
  const aria = (name: CadasturField) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="cnpj" className="field-label">
          CNPJ da agência
        </label>
        <input
          id="cnpj"
          name="cnpj"
          inputMode="numeric"
          placeholder="11.222.333/0001-81"
          required
          maxLength={18}
          className="field-input"
          {...aria("cnpj")}
        />
        {error("cnpj")}
      </div>
      <div>
        <label htmlFor="certificate_number" className="field-label">
          Número do certificado Cadastur
        </label>
        <input
          id="certificate_number"
          name="certificate_number"
          required
          maxLength={30}
          autoComplete="off"
          className="field-input"
          {...aria("certificate_number")}
        />
        {error("certificate_number")}
      </div>
      <div>
        <label htmlFor="valid_until" className="field-label">
          Válido até
        </label>
        <input
          id="valid_until"
          name="valid_until"
          type="date"
          required
          className="field-input"
          {...aria("valid_until")}
        />
        {error("valid_until")}
      </div>
      <div>
        <label htmlFor="file" className="field-label">
          Certificado (PDF ou foto)
        </label>
        <input
          ref={fileRef}
          id="file"
          name="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          className="block w-full text-base file:mr-3 file:min-h-11 sm:min-h-9 file:rounded-lg file:border-0 file:bg-surface-muted file:px-4 file:font-semibold"
          {...aria("file")}
        />
        <p className="mt-1 text-sm text-muted">
          Baixe no site do Cadastur. Só a equipe da Routa vê o arquivo.
        </p>
        {error("file")}
      </div>

      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" disabled={busy !== null} className="btn-primary disabled:opacity-60">
        {busy ?? "Pedir o selo"}
      </button>
    </form>
  );
}
