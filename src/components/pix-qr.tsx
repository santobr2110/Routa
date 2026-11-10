"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR Code do Pix copia e cola. Fundo sempre branco (o app do banco precisa do contraste). */
export function PixQr({ code, size = 208 }: { code: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(code, { type: "svg", margin: 2, errorCorrectionLevel: "M" })
      .then((out) => !cancelled && setSvg(out))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      role="img"
      aria-label="QR Code do Pix. Abra o app do banco, escolha pagar com Pix e aponte a câmera."
      className="shrink-0 overflow-hidden rounded-lg bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      // SVG gerado localmente pela biblioteca qrcode a partir do código Pix (sem HTML externo).
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

/** Botão que copia um texto e avisa "copiado". */
export function CopyButton({
  text,
  label,
  copiedLabel = "Copiado! ✅",
  className = "btn-secondary",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copie o texto:", text);
    }
  }
  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}
