import type { Metadata } from "next";
import { getOrganizer, requireUser } from "@/lib/auth";
import { formatBrPhone } from "@/lib/format";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Seu perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  const organizer = await getOrganizer(user.id);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {organizer ? "Seu perfil" : "Bem-vindo à Routa!"}
        </h1>
        <p className="text-lg text-ink-soft">
          {organizer
            ? "Esses dados aparecem para quem se inscreve nas suas viagens."
            : "Antes de criar sua primeira viagem, conta pra gente quem é você. Quem se inscrever vai ver seu nome e falar com você pelo WhatsApp."}
        </p>
      </div>

      <ProfileForm
        initial={{
          name: organizer?.name ?? "",
          whatsapp: organizer ? formatBrPhone(organizer.whatsapp) : "",
        }}
        email={user.email}
        isNew={!organizer}
      />

      {organizer && <ChangePasswordForm />}
    </div>
  );
}
