/**
 * Hand-written Supabase schema contract for the cafe DB. Kept in sync with the
 * migrations under supabase/migrations. Cost columns exist in the type (the
 * service-role client reads them) but are revoked from anon/authenticated at the
 * database — the grant, not the type, is the security boundary.
 *
 * When the schema grows, regenerate with `supabase gen types` or extend by hand.
 */

export type OrderChannel = "qr" | "kiosk" | "cashier";
export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";
export type VariantKind = "size" | "flavor";

type Timestamped = { id: string; created_at: string };

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: Timestamped & { name_ar: string; name_en: string };
        Insert: { id?: string; name_ar: string; name_en: string; created_at?: string };
        Update: Partial<{ name_ar: string; name_en: string }>;
        Relationships: [];
      };
      employees: {
        Row: Timestamped & {
          name_ar: string; role_id: string | null; auth_user_id: string | null; is_active: boolean;
          wage_amount: number; wage_period: "daily" | "weekly" | "monthly" | null;
        };
        Insert: {
          id?: string; name_ar: string; role_id?: string | null; auth_user_id?: string | null; is_active?: boolean;
          wage_amount?: number; wage_period?: "daily" | "weekly" | "monthly" | null; created_at?: string;
        };
        Update: Partial<{
          name_ar: string; role_id: string | null; auth_user_id: string | null; is_active: boolean;
          wage_amount: number; wage_period: "daily" | "weekly" | "monthly" | null;
        }>;
        Relationships: [];
      };
      categories: {
        Row: Timestamped & { name_ar: string; image_url: string | null; sort: number; is_active: boolean };
        Insert: { id?: string; name_ar: string; image_url?: string | null; sort?: number; is_active?: boolean; created_at?: string };
        Update: Partial<{ name_ar: string; image_url: string | null; sort: number; is_active: boolean }>;
        Relationships: [];
      };
      menu_items: {
        Row: Timestamped & {
          category_id: string; name_ar: string; description_ar: string | null; image_url: string | null;
          price: number; cost: number; flavors: string[]; is_active: boolean; sort: number;
        };
        Insert: {
          id?: string; category_id: string; name_ar: string; description_ar?: string | null; image_url?: string | null;
          price?: number; cost?: number; flavors?: string[]; is_active?: boolean; sort?: number; created_at?: string;
        };
        Update: Partial<{
          category_id: string; name_ar: string; description_ar: string | null; image_url: string | null;
          price: number; cost: number; flavors: string[]; is_active: boolean; sort: number;
        }>;
        Relationships: [];
      };
      item_variants: {
        Row: Timestamped & {
          item_id: string; kind: VariantKind; name_ar: string;
          price_override: number | null; cost_override: number | null; is_active: boolean; sort: number;
        };
        Insert: {
          id?: string; item_id: string; kind?: VariantKind; name_ar: string;
          price_override?: number | null; cost_override?: number | null; is_active?: boolean; sort?: number; created_at?: string;
        };
        Update: Partial<{
          item_id: string; kind: VariantKind; name_ar: string;
          price_override: number | null; cost_override: number | null; is_active: boolean; sort: number;
        }>;
        Relationships: [];
      };
      customers: {
        Row: Timestamped & { card_serial: string; phone: string | null; name_ar: string | null; points: number };
        Insert: { id?: string; card_serial?: string; phone?: string | null; name_ar?: string | null; points?: number; created_at?: string };
        Update: Partial<{ phone: string | null; name_ar: string | null; points: number }>;
        Relationships: [];
      };
      register_closures: {
        Row: { business_day: string; remaining: number; note: string | null; closed_by: string | null; created_at: string; updated_at: string };
        Insert: { business_day: string; remaining: number; note?: string | null; closed_by?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<{ remaining: number; note: string | null; closed_by: string | null; updated_at: string }>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: Timestamped & { endpoint: string; p256dh: string; auth: string };
        Insert: { id?: string; endpoint: string; p256dh: string; auth: string; created_at?: string };
        Update: Partial<{ endpoint: string; p256dh: string; auth: string }>;
        Relationships: [];
      };
      order_counters: {
        Row: { business_day: string; last_seq: number };
        Insert: { business_day: string; last_seq?: number };
        Update: Partial<{ last_seq: number }>;
        Relationships: [];
      };
      orders: {
        Row: Timestamped & {
          business_day: string; order_seq: number; channel: OrderChannel; status: OrderStatus;
          subtotal: number; cost_total: number; discount: number; table_no: string | null; note: string | null;
          customer_id: string | null; cashier_id: string | null; paid_at: string | null;
        };
        Insert: {
          id?: string; business_day?: string; order_seq: number; channel: OrderChannel; status?: OrderStatus;
          subtotal?: number; cost_total?: number; discount?: number; table_no?: string | null; note?: string | null;
          customer_id?: string | null; cashier_id?: string | null; paid_at?: string | null; created_at?: string;
        };
        Update: Partial<{ status: OrderStatus; discount: number; customer_id: string | null; paid_at: string | null }>;
        Relationships: [];
      };
      order_items: {
        Row: Timestamped & {
          order_id: string; item_id: string | null; variant_id: string | null; name_ar: string; flavor_ar: string | null;
          qty: number; unit_price: number; unit_cost: number; line_total: number;
        };
        Insert: {
          id?: string; order_id: string; item_id?: string | null; variant_id?: string | null; name_ar: string; flavor_ar?: string | null;
          qty: number; unit_price: number; unit_cost?: number; created_at?: string;
        };
        Update: Partial<{ qty: number; unit_price: number }>;
        Relationships: [];
      };
      expenses: {
        Row: Timestamped & { business_day: string; amount: number; category: string | null; note: string | null; created_by: string | null };
        Insert: { id?: string; business_day?: string; amount: number; category?: string | null; note?: string | null; created_by?: string | null; created_at?: string };
        Update: Partial<{ business_day: string; amount: number; category: string | null; note: string | null }>;
        Relationships: [];
      };
      loyalty_events: {
        Row: Timestamped & {
          customer_id: string; delta: number; reason: string; order_id: string | null; idempotency_key: string | null; created_by: string | null;
        };
        Insert: {
          id?: string; customer_id: string; delta: number; reason: string; order_id?: string | null; idempotency_key?: string | null; created_by?: string | null; created_at?: string;
        };
        Update: Partial<{ delta: number; reason: string }>;
        Relationships: [];
      };
    };
    Views: {
      menu_public: {
        Row: {
          id: string; category_id: string; name_ar: string; description_ar: string | null; image_url: string | null;
          price: number; flavors: string[]; sort: number;
          category_name: string; category_image: string | null; category_sort: number;
        };
        Relationships: [];
      };
      variant_public: {
        Row: { id: string; item_id: string; kind: VariantKind; name_ar: string; price: number; sort: number };
        Relationships: [];
      };
    };
    Functions: {
      place_order: {
        Args: { p_channel: OrderChannel; p_lines: Json; p_customer?: string | null; p_table?: string | null };
        Returns: { order_id: string; order_seq: number }[];
      };
      mark_order_paid: {
        Args: { p_order: string; p_discount?: number; p_customer?: string | null; p_award_points?: number };
        Returns: number;
      };
      cancel_order: { Args: { p_order: string }; Returns: undefined };
      refund_order: { Args: { p_order: string }; Returns: undefined };
      get_card: { Args: { p_serial: string }; Returns: { id: string; name_ar: string | null; points: number }[] };
      create_card: { Args: { p_phone: string | null; p_name: string | null }; Returns: string };
      adjust_points: { Args: { p_customer: string; p_delta: number; p_reason: string; p_key?: string | null }; Returns: number };
      redeem_points: { Args: { p_customer: string; p_cost: number; p_key: string }; Returns: number };
      get_orders_public: { Args: { p_orders: string[] }; Returns: Json };
      range_summary: {
        Args: { p_from: string; p_to: string };
        Returns: { day: string; sales: number; orders_count: number; profit: number; expenses: number; net: number }[];
      };
    };
    Enums: {
      order_channel: OrderChannel;
      order_status: OrderStatus;
      variant_kind: VariantKind;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
