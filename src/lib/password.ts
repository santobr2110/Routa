import { z } from "zod";

/** Regra de senha nova: 8 a 72 caracteres (72 é o limite do Supabase). */
export const newPasswordSchema = z.string().min(8).max(72);

export const NEW_PASSWORD_ERROR = "A senha precisa ter pelo menos 8 caracteres.";
