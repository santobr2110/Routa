"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { PaymentStatus } from "@/types/database";
import { setPaymentStatus } from "./actions";

/** Botão grande Pago / Pendente. Troca na hora e confirma no servidor. */
export function PaymentToggle({
  tripId,
  registrationId,
  status,
}: {
  tripId: string;
  registrationId: string;
  status: PaymentStatus;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paid = optimistic === "paid";

  function toggle() {
    const next: PaymentStatus = paid ? "pending" : "paid";
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setPaymentStatus(tripId, registrationId, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paid}
        aria-busy={isPending}
        className={`inline-flex min-h-11 sm:min-h-9 w-full items-center justify-center gap-2 rounded-xl border px-4 font-semibold ${
          paid
            ? "border-success/40 bg-success-soft text-success"
            : "border-line-strong bg-surface text-ink"
        }`}
      >
        {paid ? "✅ Pago" : "⏳ Pendente · marcar pago"}
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
