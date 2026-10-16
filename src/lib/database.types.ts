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
        Row: {
          company_name: string; currency: string; date_format: string; id: boolean; updated_at: string;
          address: string | null; gstin: string | null; email: string | null; phone: string | null; bank_details: string | null; default_terms: string | null; auto_overdue_reminders: boolean; overdue_reminder_days: number; demo_mode: boolean; theme: string; disabled_modules: string[]; menu_config: Json;
        };
        Insert: {
          company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string;
          address?: string | null; gstin?: string | null; email?: string | null; phone?: string | null; bank_details?: string | null; default_terms?: string | null; auto_overdue_reminders?: boolean; overdue_reminder_days?: number;
         theme?: string; disabled_modules?: string[]; menu_config?: Json; };
        Update: {
          company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string;
          address?: string | null; gstin?: string | null; email?: string | null; phone?: string | null; bank_details?: string | null; default_terms?: string | null; auto_overdue_reminders?: boolean; overdue_reminder_days?: number;
         theme?: string; disabled_modules?: string[]; menu_config?: Json; };
        Relationships: [];
      };
      contacts: {
        Row: { created_at: string; customer_id: number; email: string | null; first_name: string; id: number; is_primary: boolean; last_name: string | null; phone: string | null; title: string | null; marketing_consent: boolean; consent_updated_at: string | null };
        Insert: { created_at?: string; customer_id: number; email?: string | null; first_name: string; id?: never; is_primary?: boolean; last_name?: string | null; phone?: string | null; title?: string | null; marketing_consent?: boolean; consent_updated_at?: string | null };
        Update: { created_at?: string; customer_id?: number; email?: string | null; first_name?: string; id?: never; is_primary?: boolean; last_name?: string | null; phone?: string | null; title?: string | null; marketing_consent?: boolean; consent_updated_at?: string | null };
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
      lead_files: {
        Row: { id: number; lead_id: number; name: string; path: string; size: number; mime: string | null; uploaded_by: string | null; created_at: string };
        Insert: { id?: never; lead_id: number; name: string; path: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Update: { id?: never; lead_id?: number; name?: string; path?: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "lead_files_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] }, { foreignKeyName: "lead_files_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      leads: {
        Row: {
          address: string | null; assigned_to: string | null; city: string | null; company: string | null; converted_at: string | null;
          converted_customer_id: number | null; country: string | null; created_at: string; created_by: string | null; description: string | null;
          email: string | null; id: number; is_junk: boolean; is_lost: boolean; last_contact_at: string | null; name: string; phone: string | null;
          position: number; source_id: number | null; status_id: number | null; title: string | null; state: string | null; zip: string | null; value: number | null; website: string | null;
        };
        Insert: {
          address?: string | null; assigned_to?: string | null; city?: string | null; company?: string | null; converted_at?: string | null;
          converted_customer_id?: number | null; country?: string | null; created_at?: string; created_by?: string | null; description?: string | null;
          email?: string | null; id?: never; is_junk?: boolean; is_lost?: boolean; last_contact_at?: string | null; name: string; phone?: string | null;
          position?: number; source_id?: number | null; status_id?: number | null; title?: string | null; state?: string | null; zip?: string | null; value?: number | null; website?: string | null;
        };
        Update: {
          address?: string | null; assigned_to?: string | null; city?: string | null; company?: string | null; converted_at?: string | null;
          converted_customer_id?: number | null; country?: string | null; created_at?: string; created_by?: string | null; description?: string | null;
          email?: string | null; id?: never; is_junk?: boolean; is_lost?: boolean; last_contact_at?: string | null; name?: string; phone?: string | null;
          position?: number; source_id?: number | null; status_id?: number | null; title?: string | null; state?: string | null; zip?: string | null; value?: number | null; website?: string | null;
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
        Row: { created_at: string; dashboard_config: Json; email: string; full_name: string; id: string; is_active: boolean; is_admin: boolean; job_title: string | null; phone: string | null; role_id: number | null };
        Insert: { created_at?: string; dashboard_config?: Json; email: string; full_name?: string; id: string; is_active?: boolean; is_admin?: boolean; job_title?: string | null; phone?: string | null; role_id?: number | null };
        Update: { created_at?: string; dashboard_config?: Json; email?: string; full_name?: string; id?: string; is_active?: boolean; is_admin?: boolean; job_title?: string | null; phone?: string | null; role_id?: number | null };
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
      taxes: {
        Row: { id: number; name: string; rate: number };
        Insert: { id?: never; name: string; rate: number };
        Update: { id?: never; name?: string; rate?: number };
        Relationships: [];
      };
      items: {
        Row: { id: number; name: string; description: string | null; rate: number; unit: string | null; tax_id: number | null; created_at: string; hsn_sac: string | null };
        Insert: { id?: never; name: string; description?: string | null; rate?: number; unit?: string | null; tax_id?: number | null; created_at?: string; hsn_sac?: string | null };
        Update: { id?: never; name?: string; description?: string | null; rate?: number; unit?: string | null; tax_id?: number | null; created_at?: string; hsn_sac?: string | null };
        Relationships: [
          { foreignKeyName: "items_tax_id_fkey"; columns: ["tax_id"]; isOneToOne: false; referencedRelation: "taxes"; referencedColumns: ["id"] },
        ];
      };
      payment_modes: {
        Row: { id: number; name: string; is_active: boolean };
        Insert: { id?: never; name: string; is_active?: boolean };
        Update: { id?: never; name?: string; is_active?: boolean };
        Relationships: [];
      };
      expense_categories: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      estimate_request_statuses: {
        Row: { key: string; name: string; color: string; sort_order: number; is_open: boolean };
        Insert: { key: string; name: string; color?: string; sort_order?: number; is_open?: boolean };
        Update: { key?: string; name?: string; color?: string; sort_order?: number; is_open?: boolean };
        Relationships: [];
      };
      sales_docs: {
        Row: {
          id: number; kind: Database["public"]["Enums"]["doc_kind"]; number: number; customer_id: number | null; lead_id: number | null;
          subject: string | null; content: string | null; date: string; due_date: string | null; status: string; currency: string;
          exchange_rate: number; supply_type: string; place_of_supply: string | null;
          discount_percent: number; adjustment: number; subtotal: number; discount_total: number; tax_total: number; total: number;
          notes: string | null; terms: string | null; source_id: number | null; sent_at: string | null; created_by: string | null; created_at: string;
          project_id: number | null; recurring_every: number | null; recurring_unit: string; recurring_cycles: number | null; recurring_done: number;
          next_recurring_date: string | null; recurring_from: number | null; last_reminder_at: string | null; subscription_id: number | null;
        };
        Insert: {
          id?: never; kind: Database["public"]["Enums"]["doc_kind"]; number?: number; customer_id?: number | null; lead_id?: number | null;
          subject?: string | null; content?: string | null; date?: string; due_date?: string | null; status?: string; currency?: string;
          discount_percent?: number; adjustment?: number; subtotal?: number; discount_total?: number; tax_total?: number; total?: number;
          notes?: string | null; terms?: string | null; source_id?: number | null; sent_at?: string | null; created_by?: string | null; created_at?: string;
          project_id?: number | null; recurring_every?: number | null; recurring_unit?: string; recurring_cycles?: number | null; recurring_done?: number;
          next_recurring_date?: string | null; recurring_from?: number | null; last_reminder_at?: string | null; subscription_id?: number | null;
        };
        Update: {
          id?: never; kind?: Database["public"]["Enums"]["doc_kind"]; number?: number; customer_id?: number | null; lead_id?: number | null;
          subject?: string | null; content?: string | null; date?: string; due_date?: string | null; status?: string; currency?: string;
          discount_percent?: number; adjustment?: number; subtotal?: number; discount_total?: number; tax_total?: number; total?: number;
          notes?: string | null; terms?: string | null; source_id?: number | null; sent_at?: string | null; created_by?: string | null; created_at?: string;
          project_id?: number | null; recurring_every?: number | null; recurring_unit?: string; recurring_cycles?: number | null; recurring_done?: number;
          next_recurring_date?: string | null; recurring_from?: number | null; last_reminder_at?: string | null; subscription_id?: number | null;
        };
        Relationships: [
          { foreignKeyName: "sales_docs_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_source_id_fkey"; columns: ["source_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      sales_doc_items: {
        Row: { id: number; doc_id: number; expense_id: number | null; position: number; item_id: number | null; description: string; long_description: string | null; qty: number; unit: string | null; rate: number; tax_rate: number; hsn_sac: string | null };
        Insert: { id?: never; doc_id: number; expense_id?: number | null; position?: number; item_id?: number | null; description: string; long_description?: string | null; qty?: number; unit?: string | null; rate?: number; tax_rate?: number; hsn_sac?: string | null };
        Update: { id?: never; doc_id?: number; expense_id?: number | null; position?: number; item_id?: number | null; description?: string; long_description?: string | null; qty?: number; unit?: string | null; rate?: number; tax_rate?: number; hsn_sac?: string | null };
        Relationships: [
          { foreignKeyName: "sales_doc_items_doc_id_fkey"; columns: ["doc_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_doc_items_item_id_fkey"; columns: ["item_id"]; isOneToOne: false; referencedRelation: "items"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: { id: number; invoice_id: number; amount: number; date: string; mode_id: number | null; transaction_id: string | null; note: string | null; created_by: string | null; created_at: string };
        Insert: { id?: never; invoice_id: number; amount: number; date?: string; mode_id?: number | null; transaction_id?: string | null; note?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: never; invoice_id?: number; amount?: number; date?: string; mode_id?: number | null; transaction_id?: string | null; note?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "payments_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_mode_id_fkey"; columns: ["mode_id"]; isOneToOne: false; referencedRelation: "payment_modes"; referencedColumns: ["id"] },
          { foreignKeyName: "payments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      credit_applications: {
        Row: { id: number; credit_note_id: number; invoice_id: number; amount: number; date: string; created_by: string | null; created_at: string };
        Insert: { id?: never; credit_note_id: number; invoice_id: number; amount: number; date?: string; created_by?: string | null; created_at?: string };
        Update: { id?: never; credit_note_id?: number; invoice_id?: number; amount?: number; date?: string; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "credit_applications_credit_note_id_fkey"; columns: ["credit_note_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "credit_applications_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
        ];
      };
      expenses: {
        Row: {
          id: number; name: string; category_id: number | null; amount: number; tax_rate: number; date: string; customer_id: number | null;
          payment_mode_id: number | null; reference: string | null; note: string | null; is_billable: boolean; invoice_id: number | null; created_by: string | null; created_at: string;
          recurring_every: number | null; recurring_unit: string; recurring_cycles: number | null; recurring_done: number; next_recurring_date: string | null;
          recurring_from: number | null; receipt_path: string | null; receipt_name: string | null;
        };
        Insert: {
          id?: never; name: string; category_id?: number | null; amount: number; tax_rate?: number; date?: string; customer_id?: number | null;
          payment_mode_id?: number | null; reference?: string | null; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_by?: string | null; created_at?: string;
          recurring_every?: number | null; recurring_unit?: string; recurring_cycles?: number | null; recurring_done?: number; next_recurring_date?: string | null;
          recurring_from?: number | null; receipt_path?: string | null; receipt_name?: string | null;
        };
        Update: {
          id?: never; name?: string; category_id?: number | null; amount?: number; tax_rate?: number; date?: string; customer_id?: number | null;
          payment_mode_id?: number | null; reference?: string | null; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_by?: string | null; created_at?: string;
          recurring_every?: number | null; recurring_unit?: string; recurring_cycles?: number | null; recurring_done?: number; next_recurring_date?: string | null;
          recurring_from?: number | null; receipt_path?: string | null; receipt_name?: string | null;
        };
        Relationships: [
          { foreignKeyName: "expenses_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "expense_categories"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_payment_mode_id_fkey"; columns: ["payment_mode_id"]; isOneToOne: false; referencedRelation: "payment_modes"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "expenses_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      projects: {
        Row: { id: number; name: string; customer_id: number; status: string; billing_type: string; fixed_price: number | null; hourly_rate: number | null; start_date: string; deadline: string | null; description: string | null; created_by: string | null; created_at: string };
        Insert: { id?: never; name: string; customer_id: number; status?: string; billing_type?: string; fixed_price?: number | null; hourly_rate?: number | null; start_date?: string; deadline?: string | null; description?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: never; name?: string; customer_id?: number; status?: string; billing_type?: string; fixed_price?: number | null; hourly_rate?: number | null; start_date?: string; deadline?: string | null; description?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "projects_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "projects_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      project_members: {
        Row: { project_id: number; staff_id: string };
        Insert: { project_id: number; staff_id: string };
        Update: { project_id?: number; staff_id?: string };
        Relationships: [{ foreignKeyName: "project_members_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }, { foreignKeyName: "project_members_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      milestones: {
        Row: { id: number; project_id: number; name: string; description: string | null; due_date: string | null; position: number; is_complete: boolean };
        Insert: { id?: never; project_id: number; name: string; description?: string | null; due_date?: string | null; position?: number; is_complete?: boolean };
        Update: { id?: never; project_id?: number; name?: string; description?: string | null; due_date?: string | null; position?: number; is_complete?: boolean };
        Relationships: [{ foreignKeyName: "milestones_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }];
      };
      timesheets: {
        Row: { id: number; project_id: number; task_id: number | null; staff_id: string | null; date: string; hours: number; note: string | null; is_billable: boolean; invoice_id: number | null; created_at: string };
        Insert: { id?: never; project_id: number; task_id?: number | null; staff_id?: string | null; date?: string; hours: number; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_at?: string };
        Update: { id?: never; project_id?: number; task_id?: number | null; staff_id?: string | null; date?: string; hours?: number; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_at?: string };
        Relationships: [{ foreignKeyName: "timesheets_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }, { foreignKeyName: "timesheets_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "timesheets_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "timesheets_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] }];
      };
      project_files: {
        Row: { id: number; project_id: number; name: string; path: string; size: number; mime: string | null; uploaded_by: string | null; created_at: string };
        Insert: { id?: never; project_id: number; name: string; path: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Update: { id?: never; project_id?: number; name?: string; path?: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "project_files_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }, { foreignKeyName: "project_files_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      project_comments: {
        Row: { id: number; project_id: number; body: string; created_by: string | null; created_at: string };
        Insert: { id?: never; project_id: number; body: string; created_by?: string | null; created_at?: string };
        Update: { id?: never; project_id?: number; body?: string; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "project_comments_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }, { foreignKeyName: "project_comments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      contract_types: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      contracts: {
        Row: { id: number; customer_id: number; type_id: number | null; subject: string; value: number | null; start_date: string; end_date: string | null; content: string | null; status: string; signed_by: string | null; signed_at: string | null; created_by: string | null; created_at: string };
        Insert: { id?: never; customer_id: number; type_id?: number | null; subject: string; value?: number | null; start_date?: string; end_date?: string | null; content?: string | null; status?: string; signed_by?: string | null; signed_at?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: never; customer_id?: number; type_id?: number | null; subject?: string; value?: number | null; start_date?: string; end_date?: string | null; content?: string | null; status?: string; signed_by?: string | null; signed_at?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "contracts_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "contracts_type_id_fkey"; columns: ["type_id"]; isOneToOne: false; referencedRelation: "contract_types"; referencedColumns: ["id"] }, { foreignKeyName: "contracts_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      ticket_departments: {
        Row: { id: number; name: string };
        Insert: { id?: never; name: string };
        Update: { id?: never; name?: string };
        Relationships: [];
      };
      tickets: {
        Row: { id: number; subject: string; customer_id: number | null; contact_id: number | null; department_id: number | null; project_id: number | null; priority: string; status: string; assigned_to: string | null; last_reply_at: string; closed_at: string | null; created_by: string | null; created_at: string };
        Insert: { id?: never; subject: string; customer_id?: number | null; contact_id?: number | null; department_id?: number | null; project_id?: number | null; priority?: string; status?: string; assigned_to?: string | null; last_reply_at?: string; closed_at?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: never; subject?: string; customer_id?: number | null; contact_id?: number | null; department_id?: number | null; project_id?: number | null; priority?: string; status?: string; assigned_to?: string | null; last_reply_at?: string; closed_at?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "tickets_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "tickets_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] }, { foreignKeyName: "tickets_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "ticket_departments"; referencedColumns: ["id"] }, { foreignKeyName: "tickets_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }, { foreignKeyName: "tickets_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "tickets_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      ticket_replies: {
        Row: { id: number; ticket_id: number; body: string; author_id: string | null; author_name: string | null; is_internal: boolean; created_at: string };
        Insert: { id?: never; ticket_id: number; body: string; author_id?: string | null; author_name?: string | null; is_internal?: boolean; created_at?: string };
        Update: { id?: never; ticket_id?: number; body?: string; author_id?: string | null; author_name?: string | null; is_internal?: boolean; created_at?: string };
        Relationships: [{ foreignKeyName: "ticket_replies_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] }, { foreignKeyName: "ticket_replies_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      kb_groups: {
        Row: { id: number; name: string; description: string | null; position: number };
        Insert: { id?: never; name: string; description?: string | null; position?: number };
        Update: { id?: never; name?: string; description?: string | null; position?: number };
        Relationships: [];
      };
      kb_articles: {
        Row: { id: number; group_id: number | null; title: string; slug: string; body: string; is_published: boolean; views: number; helpful: number; not_helpful: number; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: never; group_id?: number | null; title: string; slug: string; body?: string; is_published?: boolean; views?: number; helpful?: number; not_helpful?: number; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: never; group_id?: number | null; title?: string; slug?: string; body?: string; is_published?: boolean; views?: number; helpful?: number; not_helpful?: number; created_by?: string | null; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: "kb_articles_group_id_fkey"; columns: ["group_id"]; isOneToOne: false; referencedRelation: "kb_groups"; referencedColumns: ["id"] }, { foreignKeyName: "kb_articles_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      portal_users: {
        Row: { user_id: string; customer_id: number; contact_id: number | null; created_at: string };
        Insert: { user_id: string; customer_id: number; contact_id?: number | null; created_at?: string };
        Update: { user_id?: string; customer_id?: number; contact_id?: number | null; created_at?: string };
        Relationships: [{ foreignKeyName: "portal_users_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] }, { foreignKeyName: "portal_users_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] }];
      };
      calendar_events: {
        Row: { id: number; title: string; description: string | null; starts_at: string; ends_at: string | null; all_day: boolean; color: string; created_by: string | null; created_at: string };
        Insert: { id?: never; title: string; description?: string | null; starts_at: string; ends_at?: string | null; all_day?: boolean; color?: string; created_by?: string | null; created_at?: string };
        Update: { id?: never; title?: string; description?: string | null; starts_at?: string; ends_at?: string | null; all_day?: boolean; color?: string; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "calendar_events_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      announcements: {
        Row: { id: number; title: string; body: string; show_to_staff: boolean; show_to_clients: boolean; created_by: string | null; created_at: string };
        Insert: { id?: never; title: string; body: string; show_to_staff?: boolean; show_to_clients?: boolean; created_by?: string | null; created_at?: string };
        Update: { id?: never; title?: string; body?: string; show_to_staff?: boolean; show_to_clients?: boolean; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "announcements_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      goals: {
        Row: { id: number; title: string; metric: string; target: number; start_date: string; end_date: string; staff_id: string | null; created_by: string | null; created_at: string };
        Insert: { id?: never; title: string; metric: string; target: number; start_date: string; end_date: string; staff_id?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: never; title?: string; metric?: string; target?: number; start_date?: string; end_date?: string; staff_id?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "goals_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "goals_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      task_checklist_items: {
        Row: { id: number; task_id: number; description: string; is_done: boolean; done_by: string | null; done_at: string | null; position: number; created_by: string | null; created_at: string };
        Insert: { id?: never; task_id: number; description: string; is_done?: boolean; done_by?: string | null; done_at?: string | null; position?: number; created_by?: string | null; created_at?: string };
        Update: { id?: never; task_id?: number; description?: string; is_done?: boolean; done_by?: string | null; done_at?: string | null; position?: number; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "task_checklist_items_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "task_checklist_items_done_by_fkey"; columns: ["done_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "task_checklist_items_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      task_comments: {
        Row: { id: number; task_id: number; body: string; created_by: string | null; created_at: string };
        Insert: { id?: never; task_id: number; body: string; created_by?: string | null; created_at?: string };
        Update: { id?: never; task_id?: number; body?: string; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "task_comments_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "task_comments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      task_files: {
        Row: { id: number; task_id: number; name: string; path: string; size: number; mime: string | null; uploaded_by: string | null; created_at: string };
        Insert: { id?: never; task_id: number; name: string; path: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Update: { id?: never; task_id?: number; name?: string; path?: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "task_files_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "task_files_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      task_followers: {
        Row: { task_id: number; staff_id: string };
        Insert: { task_id: number; staff_id: string };
        Update: { task_id?: number; staff_id?: string };
        Relationships: [{ foreignKeyName: "task_followers_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "task_followers_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      task_timers: {
        Row: { id: number; task_id: number; staff_id: string; started_at: string; ended_at: string | null; note: string | null; timesheet_id: number | null };
        Insert: { id?: never; task_id: number; staff_id?: string; started_at?: string; ended_at?: string | null; note?: string | null; timesheet_id?: number | null };
        Update: { id?: never; task_id?: number; staff_id?: string; started_at?: string; ended_at?: string | null; note?: string | null; timesheet_id?: number | null };
        Relationships: [{ foreignKeyName: "task_timers_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }, { foreignKeyName: "task_timers_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "task_timers_timesheet_id_fkey"; columns: ["timesheet_id"]; isOneToOne: false; referencedRelation: "timesheets"; referencedColumns: ["id"] }];
      };
      reminders: {
        Row: { id: number; rel_type: string; rel_id: number; staff_id: string; remind_at: string; description: string; is_notified: boolean; created_by: string | null; created_at: string };
        Insert: { id?: never; rel_type: string; rel_id: number; staff_id?: string; remind_at: string; description: string; is_notified?: boolean; created_by?: string | null; created_at?: string };
        Update: { id?: never; rel_type?: string; rel_id?: number; staff_id?: string; remind_at?: string; description?: string; is_notified?: boolean; created_by?: string | null; created_at?: string };
        Relationships: [{ foreignKeyName: "reminders_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "reminders_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      todos: {
        Row: { id: number; staff_id: string; body: string; is_done: boolean; done_at: string | null; position: number; created_at: string };
        Insert: { id?: never; staff_id?: string; body: string; is_done?: boolean; done_at?: string | null; position?: number; created_at?: string };
        Update: { id?: never; staff_id?: string; body?: string; is_done?: boolean; done_at?: string | null; position?: number; created_at?: string };
        Relationships: [{ foreignKeyName: "todos_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      notifications: {
        Row: { id: number; user_id: string; actor_id: string | null; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };
        Insert: { id?: never; user_id: string; actor_id?: string | null; title: string; body?: string | null; link?: string | null; is_read?: boolean; created_at?: string };
        Update: { id?: never; user_id?: string; actor_id?: string | null; title?: string; body?: string | null; link?: string | null; is_read?: boolean; created_at?: string };
        Relationships: [{ foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "notifications_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      tags: {
        Row: { id: number; name: string; color: string };
        Insert: { id?: never; name: string; color?: string };
        Update: { id?: never; name?: string; color?: string };
        Relationships: [];
      };
      taggables: {
        Row: { tag_id: number; rel_type: string; rel_id: number };
        Insert: { tag_id: number; rel_type: string; rel_id: number };
        Update: { tag_id?: number; rel_type?: string; rel_id?: number };
        Relationships: [{ foreignKeyName: "taggables_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "tags"; referencedColumns: ["id"] }];
      };
      staff_departments: {
        Row: { staff_id: string; department_id: number };
        Insert: { staff_id: string; department_id: number };
        Update: { staff_id?: string; department_id?: number };
        Relationships: [{ foreignKeyName: "staff_departments_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "staff_departments_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "ticket_departments"; referencedColumns: ["id"] }];
      };
      predefined_replies: {
        Row: { id: number; title: string; body: string; created_at: string };
        Insert: { id?: never; title: string; body: string; created_at?: string };
        Update: { id?: never; title?: string; body?: string; created_at?: string };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: number; customer_id: number; name: string; description: string | null; item_id: number | null; quantity: number; unit_price: number; tax_rate: number;
          currency: string; interval_count: number; interval_unit: string; start_date: string; next_billing_date: string | null; ends_after_cycles: number | null;
          cycles_billed: number; auto_charge: boolean; status: string; cancelled_at: string | null; created_by: string | null; created_at: string;
        };
        Insert: {
          id?: never; customer_id: number; name: string; description?: string | null; item_id?: number | null; quantity?: number; unit_price: number; tax_rate?: number;
          currency?: string; interval_count?: number; interval_unit?: string; start_date?: string; next_billing_date?: string | null; ends_after_cycles?: number | null;
          cycles_billed?: number; auto_charge?: boolean; status?: string; cancelled_at?: string | null; created_by?: string | null; created_at?: string;
        };
        Update: {
          id?: never; customer_id?: number; name?: string; description?: string | null; item_id?: number | null; quantity?: number; unit_price?: number; tax_rate?: number;
          currency?: string; interval_count?: number; interval_unit?: string; start_date?: string; next_billing_date?: string | null; ends_after_cycles?: number | null;
          cycles_billed?: number; auto_charge?: boolean; status?: string; cancelled_at?: string | null; created_by?: string | null; created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "subscriptions_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_item_id_fkey"; columns: ["item_id"]; isOneToOne: false; referencedRelation: "items"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      email_log: {
        Row: {
          id: number; customer_id: number | null; to_email: string | null; to_name: string | null; subject: string; body: string; kind: string;
          rel_type: string | null; rel_id: number | null; automatic: boolean; sent_by: string | null; created_at: string;
        };
        Insert: {
          id?: never; customer_id?: number | null; to_email?: string | null; to_name?: string | null; subject: string; body: string; kind?: string;
          rel_type?: string | null; rel_id?: number | null; automatic?: boolean; sent_by?: string | null; created_at?: string;
        };
        Update: {
          id?: never; customer_id?: number | null; to_email?: string | null; to_name?: string | null; subject?: string; body?: string; kind?: string;
          rel_type?: string | null; rel_id?: number | null; automatic?: boolean; sent_by?: string | null; created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "email_log_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "email_log_sent_by_fkey"; columns: ["sent_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      custom_fields: {
        Row: { id: number; entity: string; label: string; type: string; options: string[]; required: boolean; show_on_pdf: boolean; position: number; is_active: boolean; created_at: string };
        Insert: { id?: never; entity: string; label: string; type?: string; options?: string[]; required?: boolean; show_on_pdf?: boolean; position?: number; is_active?: boolean; created_at?: string };
        Update: { id?: never; entity?: string; label?: string; type?: string; options?: string[]; required?: boolean; show_on_pdf?: boolean; position?: number; is_active?: boolean; created_at?: string };
        Relationships: [];
      };
      custom_field_values: {
        Row: { field_id: number; rel_id: number; value: string | null };
        Insert: { field_id: number; rel_id: number; value?: string | null };
        Update: { field_id?: number; rel_id?: number; value?: string | null };
        Relationships: [
          { foreignKeyName: "custom_field_values_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "custom_fields"; referencedColumns: ["id"] },
        ];
      };
      email_templates: {
        Row: { key: string; name: string; description: string | null; subject: string; body: string; updated_at: string };
        Insert: { key: string; name: string; description?: string | null; subject: string; body: string; updated_at?: string };
        Update: { key?: string; name?: string; description?: string | null; subject?: string; body?: string; updated_at?: string };
        Relationships: [];
      };
      currencies: {
        Row: { id: number; code: string; name: string; symbol: string; rate: number; is_base: boolean };
        Insert: { id?: never; code: string; name: string; symbol: string; rate?: number; is_base?: boolean };
        Update: { id?: never; code?: string; name?: string; symbol?: string; rate?: number; is_base?: boolean };
        Relationships: [];
      };
      media_files: {
        Row: { id: number; folder: string; name: string; path: string; size: number; mime: string | null; uploaded_by: string | null; created_at: string };
        Insert: { id?: never; folder?: string; name: string; path: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Update: { id?: never; folder?: string; name?: string; path?: string; size?: number; mime?: string | null; uploaded_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "media_files_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      web_forms: {
        Row: { id: number; key: string; name: string; kind: string; intro: string | null; fields: string[]; required: string[]; source_id: number | null; status_id: number | null; assigned_to: string | null; success_message: string; is_active: boolean; submissions: number; created_by: string | null; created_at: string };
        Insert: { id?: never; key?: string; name: string; kind?: string; intro?: string | null; fields?: string[]; required?: string[]; source_id?: number | null; status_id?: number | null; assigned_to?: string | null; success_message?: string; is_active?: boolean; submissions?: number; created_by?: string | null; created_at?: string };
        Update: { id?: never; key?: string; name?: string; kind?: string; intro?: string | null; fields?: string[]; required?: string[]; source_id?: number | null; status_id?: number | null; assigned_to?: string | null; success_message?: string; is_active?: boolean; submissions?: number; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "web_forms_source_id_fkey"; columns: ["source_id"]; isOneToOne: false; referencedRelation: "lead_sources"; referencedColumns: ["id"] },
          { foreignKeyName: "web_forms_status_id_fkey"; columns: ["status_id"]; isOneToOne: false; referencedRelation: "lead_statuses"; referencedColumns: ["id"] },
          { foreignKeyName: "web_forms_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "web_forms_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      estimate_requests: {
        Row: { id: number; form_id: number | null; name: string; email: string | null; phone: string | null; company: string | null; message: string | null; budget: string | null; status: string; assigned_to: string | null; lead_id: number | null; estimate_id: number | null; created_at: string };
        Insert: { id?: never; form_id?: number | null; name: string; email?: string | null; phone?: string | null; company?: string | null; message?: string | null; budget?: string | null; status?: string; assigned_to?: string | null; lead_id?: number | null; estimate_id?: number | null; created_at?: string };
        Update: { id?: never; form_id?: number | null; name?: string; email?: string | null; phone?: string | null; company?: string | null; message?: string | null; budget?: string | null; status?: string; assigned_to?: string | null; lead_id?: number | null; estimate_id?: number | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "estimate_requests_form_id_fkey"; columns: ["form_id"]; isOneToOne: false; referencedRelation: "web_forms"; referencedColumns: ["id"] },
          { foreignKeyName: "estimate_requests_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "estimate_requests_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "estimate_requests_estimate_id_fkey"; columns: ["estimate_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
        ];
      };
      posts: {
        Row: { id: number; body: string; pinned: boolean; created_by: string | null; created_at: string };
        Insert: { id?: never; body: string; pinned?: boolean; created_by?: string | null; created_at?: string };
        Update: { id?: never; body?: string; pinned?: boolean; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "posts_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      post_likes: {
        Row: { post_id: number; staff_id: string };
        Insert: { post_id: number; staff_id?: string };
        Update: { post_id?: number; staff_id?: string };
        Relationships: [
          { foreignKeyName: "post_likes_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] },
          { foreignKeyName: "post_likes_staff_id_fkey"; columns: ["staff_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      post_comments: {
        Row: { id: number; post_id: number; body: string; created_by: string | null; created_at: string };
        Insert: { id?: never; post_id: number; body: string; created_by?: string | null; created_at?: string };
        Update: { id?: never; post_id?: number; body?: string; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "post_comments_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] },
          { foreignKeyName: "post_comments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      surveys: {
        Row: { id: number; key: string; title: string; description: string | null; thank_you: string; is_active: boolean; created_by: string | null; created_at: string };
        Insert: { id?: never; key?: string; title: string; description?: string | null; thank_you?: string; is_active?: boolean; created_by?: string | null; created_at?: string };
        Update: { id?: never; key?: string; title?: string; description?: string | null; thank_you?: string; is_active?: boolean; created_by?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "surveys_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      survey_questions: {
        Row: { id: number; survey_id: number; label: string; type: string; options: string[]; required: boolean; position: number };
        Insert: { id?: never; survey_id: number; label: string; type?: string; options?: string[]; required?: boolean; position?: number };
        Update: { id?: never; survey_id?: number; label?: string; type?: string; options?: string[]; required?: boolean; position?: number };
        Relationships: [
          { foreignKeyName: "survey_questions_survey_id_fkey"; columns: ["survey_id"]; isOneToOne: false; referencedRelation: "surveys"; referencedColumns: ["id"] },
        ];
      };
      survey_responses: {
        Row: { id: number; survey_id: number; name: string | null; email: string | null; created_at: string };
        Insert: { id?: never; survey_id: number; name?: string | null; email?: string | null; created_at?: string };
        Update: { id?: never; survey_id?: number; name?: string | null; email?: string | null; created_at?: string };
        Relationships: [
          { foreignKeyName: "survey_responses_survey_id_fkey"; columns: ["survey_id"]; isOneToOne: false; referencedRelation: "surveys"; referencedColumns: ["id"] },
        ];
      };
      survey_answers: {
        Row: { response_id: number; question_id: number; value: string };
        Insert: { response_id: number; question_id: number; value: string };
        Update: { response_id?: number; question_id?: number; value?: string };
        Relationships: [
          { foreignKeyName: "survey_answers_response_id_fkey"; columns: ["response_id"]; isOneToOne: false; referencedRelation: "survey_responses"; referencedColumns: ["id"] },
          { foreignKeyName: "survey_answers_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "survey_questions"; referencedColumns: ["id"] },
        ];
      };
      gdpr_requests: {
        Row: { id: number; customer_id: number | null; contact_id: number | null; kind: string; note: string | null; status: string; created_at: string; resolved_at: string | null; resolved_by: string | null };
        Insert: { id?: never; customer_id?: number | null; contact_id?: number | null; kind: string; note?: string | null; status?: string; created_at?: string; resolved_at?: string | null; resolved_by?: string | null };
        Update: { id?: never; customer_id?: number | null; contact_id?: number | null; kind?: string; note?: string | null; status?: string; created_at?: string; resolved_at?: string | null; resolved_by?: string | null };
        Relationships: [
          { foreignKeyName: "gdpr_requests_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "gdpr_requests_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] },
          { foreignKeyName: "gdpr_requests_resolved_by_fkey"; columns: ["resolved_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
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
          status: Database["public"]["Enums"]["task_status"]; milestone_id: number | null;
        };
        Insert: {
          completed_at?: string | null; created_at?: string; created_by?: string | null; description?: string | null; due_date?: string | null; id?: never;
          name: string; priority?: Database["public"]["Enums"]["task_priority"]; rel_id?: number | null; rel_type?: string | null; start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"]; milestone_id?: number | null;
        };
        Update: {
          completed_at?: string | null; created_at?: string; created_by?: string | null; description?: string | null; due_date?: string | null; id?: never;
          name?: string; priority?: Database["public"]["Enums"]["task_priority"]; rel_id?: number | null; rel_type?: string | null; start_date?: string | null;
          status?: Database["public"]["Enums"]["task_status"]; milestone_id?: number | null;
        };
        Relationships: [
          { foreignKeyName: "tasks_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "tasks_milestone_id_fkey"; columns: ["milestone_id"]; isOneToOne: false; referencedRelation: "milestones"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      doc_balances: {
        Row: { id: number; paid: number; credited: number; credit_used: number; balance: number };
        Relationships: [];
      };
    };
    Functions: {
      convert_lead: { Args: { p_lead_id: number }; Returns: number };
      reset_demo_data: { Args: Record<PropertyKey, never>; Returns: undefined };
      kb_track: { Args: { p_article: number; p_event: string }; Returns: undefined };
      portal_respond: { Args: { p_doc: number; p_accept: boolean }; Returns: undefined };
      portal_sign_contract: { Args: { p_contract: number; p_name: string }; Returns: undefined };
      portal_open_ticket: { Args: { p_subject: string; p_body: string; p_department: number | null; p_priority: string }; Returns: number };
      portal_reply: { Args: { p_ticket: number; p_body: string }; Returns: undefined };
      start_task_timer: { Args: { p_task: number }; Returns: number };
      stop_task_timer: { Args: { p_timer: number; p_note: string | null }; Returns: number };
      flush_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      run_recurring: { Args: Record<PropertyKey, never>; Returns: Json };
      save_sales_doc: { Args: { p_kind: Database["public"]["Enums"]["doc_kind"]; p_id: number | null; p_doc: Json; p_lines: Json }; Returns: Json };
      invoice_project: { Args: { p_project: number }; Returns: Json };
      demo_mode: { Args: Record<PropertyKey, never>; Returns: boolean };
      portal_pay: { Args: { p_invoice: number; p_amount: number; p_method: string }; Returns: string };
      web_form_info: { Args: { p_key: string }; Returns: Json };
      submit_web_form: { Args: { p_key: string; p_data: Json }; Returns: string };
      survey_info: { Args: { p_key: string }; Returns: Json };
      submit_survey: { Args: { p_key: string; p_name: string | null; p_email: string | null; p_answers: Json }; Returns: string };
      portal_set_consent: { Args: { p_consent: boolean }; Returns: undefined };
      portal_gdpr_request: { Args: { p_kind: string; p_note: string | null }; Returns: undefined };
    };
    Enums: {
      doc_kind: "proposal" | "estimate" | "invoice" | "credit_note";
      task_priority: "low" | "medium" | "high" | "urgent";
      task_status: "not_started" | "in_progress" | "testing" | "awaiting_feedback" | "complete";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
