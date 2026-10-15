// Generated from the Supabase schema (supabase gen types) — regenerate after migrations.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      activity_log: {
        Row: { actor_id: string | null; created_at: string; description: string; id: number; rel_id: number | null; rel_type: string | null };
        Insert: { actor_id?: string | null; created_at?: string; description: string; id?: never; rel_id?: number | null; rel_type?: string | null };
        Update: { actor_id?: string | null; created_at?: string; description?: string; id?: never; rel_id?: number | null; rel_type?: string | null };
        Relationships: [
          { foreignKeyName: "activity_log_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      company_settings: {
        Row: { company_name: string; currency: string; date_format: string; id: boolean; updated_at: string };
        Insert: { company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string };
        Update: { company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string };
        Relationships: [];
      };
      contacts: {
        Row: { created_at: string; customer_id: number; email: string | null; first_name: string; id: number; is_primary: boolean; last_name: string | null; phone: string | null; title: string | null };
        Insert: { created_at?: string; customer_id: number; email?: string | null; first_name: string; id?: never; is_primary?: boolean; last_name?: string | null; phone?: string | null; title?: string | null };
        Update: { created_at?: string; customer_id?: number; email?: string | null; first_name?: string; id?: never; is_primary?: boolean; last_name?: string | null; phone?: string | null; title?: string | null };
        Relationships: [
          { foreignKeyName: "contacts_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
        ];
      };
      customer_groups: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      customers: {
        Row: {
          address: string | null; city: string | null; company: string; country: string | null; created_at: string; created_by: string | null;
          currency: string | null; group_id: number | null; id: number; is_active: boolean; phone: string | null; state: string | null;
          vat: string | null; website: string | null; zip: string | null;
        };
        Insert: {
          address?: string | null; city?: string | null; company: string; country?: string | null; created_at?: string; created_by?: string | null;
          currency?: string | null; group_id?: number | null; id?: never; is_active?: boolean; phone?: string | null; state?: string | null;
          vat?: string | null; website?: string | null; zip?: string | null;
        };
        Update: {
          address?: string | null; city?: string | null; company?: string; country?: string | null; created_at?: string; created_by?: string | null;
          currency?: string | null; group_id?: number | null; id?: never; is_active?: boolean; phone?: string | null; state?: string | null;
          vat?: string | null; website?: string | null; zip?: string | null;
        };
        Relationships: [
          { foreignKeyName: "customers_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "customers_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "customer_groups"; referencedColumns: ["id"] },
        ];
      };
      lead_sources: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      lead_statuses: {
        Row: { color: string; id: number; is_won: boolean; name: string; sort_order: number };
        Insert: { color?: string; id?: never; is_won?: boolean; name: string; sort_order?: number };
        Update: { color?: string; id?: never; is_won?: boolean; name?: string; sort_order?: number };
        Relationships: [];
      };
      leads: {
        Row: {
          address: string | null; assigned_to: string | null; city: string | null; company: string | null; converted_at: string | null;
          converted_customer_id: number | null; country: string | null; created_at: string; created_by: string | null; description: string | null;
          email: string | null; id: number; is_junk: boolean; is_lost: boolean; last_contact_at: string | null; name: string; phone: string | null;
          position: number; source_id: number | null; status_id: number | null; title: string | null; value: number | null; website: string | null;
        };
        Insert: {
          address?: string | null; assigned_to?: string | null; city?: string | null; company?: string | null; converted_at?: string | null;
          converted_customer_id?: number | null; country?: string | null; created_at?: string; created_by?: string | null; description?: string | null;
          email?: string | null; id?: never; is_junk?: boolean; is_lost?: boolean; last_contact_at?: string | null; name: string; phone?: string | null;
          position?: number; source_id?: number | null; status_id?: number | null; title?: string | null; value?: number | null; website?: string | null;
        };
        Update: {
          address?: string | null; assigned_to?: string | null; city?: string | null; company?: string | null; converted_at?: string | null;
          converted_customer_id?: number | null; country?: string | null; created_at?: string; created_by?: string | null; description?: string | null;
          email?: string | null; id?: never; is_junk?: boolean; is_lost?: boolean; last_contact_at?: string | null; name?: string; phone?: string | null;
          position?: number; source_id?: number | null; status_id?: number | null; title?: string | null; value?: number | null; website?: string | null;
        };
        Relationships: [
          { foreignKeyName: "leads_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_converted_customer_id_fkey"; columns: ["converted_customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_source_id_fkey"; columns: ["source_id"]; isOneToOne: false; referencedRelation: "lead_sources"; referencedColumns: ["id"] },
          { foreignKeyName: "leads_status_id_fkey"; columns: ["status_id"]; isOneToOne: false; referencedRelation: "lead_statuses"; referencedColumns: ["id"] },
        ];
      };
      notes: {
        Row: { body: string; created_at: string; created_by: string | null; id: number; rel_id: number; rel_type: string };
        Insert: { body: string; created_at?: string; created_by?: string | null; id?: never; rel_id: number; rel_type: string };
        Update: { body?: string; created_at?: string; created_by?: string | null; id?: never; rel_id?: number; rel_type?: string };
        Relationships: [
          { foreignKeyName: "notes_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: { created_at: string; email: string; full_name: string; id: string; is_active: boolean; is_admin: boolean; job_title: string | null; phone: string | null; role_id: number | null };
        Insert: { created_at?: string; email: string; full_name?: string; id: string; is_active?: boolean; is_admin?: boolean; job_title?: string | null; phone?: string | null; role_id?: number | null };
        Update: { created_at?: string; email?: string; full_name?: string; id?: string; is_active?: boolean; is_admin?: boolean; job_title?: string | null; phone?: string | null; role_id?: number | null };
        Relationships: [
          { foreignKeyName: "profiles_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
        ];
      };
      roles: {
        Row: { created_at: string; id: number; name: string; permissions: Json };
        Insert: { created_at?: string; id?: never; name: string; permissions?: Json };
        Update: { created_at?: string; id?: never; name?: string; permissions?: Json };
        Relationships: [];
      };
      task_assignees: {
        Row: { staff_id: string; task_id: number };
        Insert: { staff_id: string; task_id: number };
        Update: { staff_id?: string; task_id?: number };
        Relationships: [
          { foreignKeyName: "task_assignees_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "task_assignees_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] },
        ];
      };
      tasks: {
        Row: {
          completed_at: string | null; created_at: string; created_by: string | null; description: string | null; due_date: string | null; id: number;
          name: string; priority: Database["public"]["Enums"]["task_priority"]; rel_id: number | null; rel_type: string | null; start_date: string | null;
          status: Database["public"]["Enums"]["task_status"];
        };
        Insert: {
          completed_at?: string | null; created_at?: string; created_by?: string | null; description?: string | null; due_date?: string | null; id?: never;
          name: string; priority?: Database["public"]["Enums"]["task_priority"]; rel_id?: number | null; rel_type?: string | null; start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
        };
        Update: {
          completed_at?: string | null; created_at?: string; created_by?: string | null; description?: string | null; due_date?: string | null; id?: never;
          name?: string; priority?: Database["public"]["Enums"]["task_priority"]; rel_id?: number | null; rel_type?: string | null; start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
        };
        Relationships: [
          { foreignKeyName: "tasks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      convert_lead: { Args: { p_lead_id: number }; Returns: number };
      reset_demo_data: { Args: Record<PropertyKey, never>; Returns: undefined };
    };
    Enums: {
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "not_started" | "in_progress" | "testing" | "awaiting_feedback" | "complete";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
