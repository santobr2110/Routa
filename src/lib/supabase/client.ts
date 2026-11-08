import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseKey, supabaseUrl } from "./env";

/** Cliente do Supabase para Client Components (ex.: upload de fotos). */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
