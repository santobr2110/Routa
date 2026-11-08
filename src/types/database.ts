// Tipos do banco, no mesmo formato que o Supabase gera.
// Escrito à mão a partir de supabase/migrations/0001_init.sql.
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
          meeting_point: string;
          meeting_point_url: string | null;
          pricing_mode: PricingMode;
          price_cents: number | null;
          level: TripLevel;
          terrain: TripTerrain;
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
          meeting_point: string;
          meeting_point_url?: string | null;
          pricing_mode: PricingMode;
          price_cents?: number | null;
          level: TripLevel;
          terrain: TripTerrain;
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
          bike: string;
          has_pillion: boolean;
          pillion_name: string | null;
          emergency_name: string;
          emergency_phone: string;
          terms_accepted_at: string;
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
          p_bike: string;
          p_has_pillion: boolean;
          p_pillion_name: string | null;
          p_emergency_name: string;
          p_emergency_phone: string;
          p_terms_accepted: boolean;
        };
        Returns: Json;
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
