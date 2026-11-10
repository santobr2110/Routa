// Tipos do banco, no mesmo formato que o Supabase gera.
// Escrito à mão a partir de supabase/migrations/ (até a 0007).
// Quando o schema mudar, regenere com (veja o README):
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PricingMode = "fixed" | "split";
export type TripLevel = "beginner" | "intermediate" | "experienced";
export type TripTerrain = "asphalt" | "mixed" | "offroad";
export type TripStatus = "draft" | "published" | "closed";
export type PaymentStatus = "pending" | "paid";
export type RegistrationStatus = "confirmed" | "waitlist" | "cancelled";
export type CadasturStatus = "pending" | "approved" | "rejected";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      organizers: {
        Row: {
          id: string;
          name: string;
          whatsapp: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          whatsapp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          whatsapp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          organizer_id: string;
          slug: string;
          title: string;
          destination: string;
          description: string;
          start_date: string;
          end_date: string;
          departure_point: string;
          departure_point_url: string | null;
          departure_time: string | null;
          return_point: string | null;
          return_point_url: string | null;
          return_time: string | null;
          pricing_mode: PricingMode;
          price_cents: number | null;
          accepts_pillion: boolean;
          pillion_price_cents: number | null;
          requires_plate: boolean;
          level: TripLevel;
          terrain: TripTerrain;
          terrain_percent: number;
          capacity: number;
          pix_key: string;
          terms_text: string;
          status: TripStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          slug: string;
          title: string;
          destination: string;
          description?: string;
          start_date: string;
          end_date: string;
          departure_point: string;
          departure_point_url?: string | null;
          departure_time?: string | null;
          return_point?: string | null;
          return_point_url?: string | null;
          return_time?: string | null;
          pricing_mode: PricingMode;
          price_cents?: number | null;
          accepts_pillion?: boolean;
          pillion_price_cents?: number | null;
          requires_plate?: boolean;
          level: TripLevel;
          terrain: TripTerrain;
          terrain_percent?: number;
          capacity: number;
          pix_key: string;
          terms_text: string;
          status?: TripStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "trips_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "organizers";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_photos: {
        Row: {
          id: string;
          trip_id: string;
          storage_path: string;
          position: number;
        };
        Insert: {
          id?: string;
          trip_id: string;
          storage_path: string;
          position: number;
        };
        Update: {
          id?: string;
          trip_id?: string;
          storage_path?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trip_photos_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      registrations: {
        Row: {
          id: string;
          trip_id: string;
          name: string;
          whatsapp: string;
          email: string;
          /** Marca + modelo em texto (inscrições antigas só têm este campo). */
          bike: string;
          bike_brand: string | null;
          bike_model: string | null;
          bike_year: number | null;
          bike_color: string | null;
          /** Só quando a viagem pede; apagada 90 dias depois da viagem (purge_old_plates). */
          bike_plate: string | null;
          has_pillion: boolean;
          pillion_name: string | null;
          emergency_name: string;
          emergency_phone: string;
          terms_accepted_at: string;
          /** Cópia do termo como estava no momento do aceite. */
          terms_text_accepted: string;
          payment_status: PaymentStatus;
          status: RegistrationStatus;
          cancelled_at: string | null;
          created_at: string;
        };
        // Inscrição só pela função register_for_trip.
        Insert: never;
        // O organizador só pode alterar o status de pagamento.
        Update: {
          payment_status?: PaymentStatus;
        };
        Relationships: [
          {
            foreignKeyName: "registrations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      cadastur_verifications: {
        Row: {
          id: string;
          organizer_id: string;
          cnpj: string;
          certificate_number: string;
          valid_until: string;
          certificate_path: string;
          status: CadasturStatus;
          reject_reason: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        // O organizador só cria pedidos pendentes (RLS); quem revisa é o admin (função).
        Insert: {
          id?: string;
          organizer_id: string;
          cnpj: string;
          certificate_number: string;
          valid_until: string;
          certificate_path: string;
          status?: "pending";
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "cadastur_verifications_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "organizers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_public_trip: {
        Args: { p_slug: string };
        Returns: Json;
      };
      register_for_trip: {
        Args: {
          p_slug: string;
          p_name: string;
          p_whatsapp: string;
          p_email: string;
          p_bike_brand: string;
          p_bike_model: string;
          p_bike_year: number | null;
          p_bike_color: string | null;
          p_bike_plate: string | null;
          p_has_pillion: boolean;
          p_pillion_name: string | null;
          p_emergency_name: string;
          p_emergency_phone: string;
          p_terms_accepted: boolean;
          /** Hash do IP (registration-guard.ts), para o limite de frequência. */
          p_ip_hash: string | null;
          /** Segundos desde 1970; a prova vale 5 minutos. */
          p_issued_at: number;
          /** HMAC-SHA256 de "slug|whatsapp|ip_hash|issued_at" com o segredo. */
          p_proof: string;
        };
        Returns: Json;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      organizer_cadastur_seal: {
        Args: { p_organizer_id: string };
        Returns: Json;
      };
      has_valid_cadastur: {
        Args: { p_organizer_id: string };
        Returns: boolean;
      };
      admin_list_cadastur: {
        Args: { p_status?: CadasturStatus };
        Returns: Json;
      };
      admin_review_cadastur: {
        Args: { p_id: string; p_approve: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      purge_old_plates: {
        Args: Record<string, never>;
        Returns: number;
      };
      cancel_registration: {
        Args: { p_registration_id: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
