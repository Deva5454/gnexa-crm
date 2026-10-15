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
          address: string | null; gstin: string | null; email: string | null; phone: string | null; bank_details: string | null; default_terms: string | null;
        };
        Insert: {
          company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string;
          address?: string | null; gstin?: string | null; email?: string | null; phone?: string | null; bank_details?: string | null; default_terms?: string | null;
        };
        Update: {
          company_name?: string; currency?: string; date_format?: string; id?: boolean; updated_at?: string;
          address?: string | null; gstin?: string | null; email?: string | null; phone?: string | null; bank_details?: string | null; default_terms?: string | null;
        };
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
      taxes: {
        Row: { id: number; name: string; rate: number };
        Insert: { id?: never; name: string; rate: number };
        Update: { id?: never; name?: string; rate?: number };
        Relationships: [];
      };
      items: {
        Row: { id: number; name: string; description: string | null; rate: number; unit: string | null; tax_id: number | null; created_at: string };
        Insert: { id?: never; name: string; description?: string | null; rate?: number; unit?: string | null; tax_id?: number | null; created_at?: string };
        Update: { id?: never; name?: string; description?: string | null; rate?: number; unit?: string | null; tax_id?: number | null; created_at?: string };
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
      sales_docs: {
        Row: {
          id: number; kind: Database["public"]["Enums"]["doc_kind"]; number: number; customer_id: number | null; lead_id: number | null;
          subject: string | null; content: string | null; date: string; due_date: string | null; status: string; currency: string;
          discount_percent: number; adjustment: number; subtotal: number; discount_total: number; tax_total: number; total: number;
          notes: string | null; terms: string | null; source_id: number | null; sent_at: string | null; created_by: string | null; created_at: string;
          project_id: number | null;
        };
        Insert: {
          id?: never; kind: Database["public"]["Enums"]["doc_kind"]; number?: number; customer_id?: number | null; lead_id?: number | null;
          subject?: string | null; content?: string | null; date?: string; due_date?: string | null; status?: string; currency?: string;
          discount_percent?: number; adjustment?: number; subtotal?: number; discount_total?: number; tax_total?: number; total?: number;
          notes?: string | null; terms?: string | null; source_id?: number | null; sent_at?: string | null; created_by?: string | null; created_at?: string;
          project_id?: number | null;
        };
        Update: {
          id?: never; kind?: Database["public"]["Enums"]["doc_kind"]; number?: number; customer_id?: number | null; lead_id?: number | null;
          subject?: string | null; content?: string | null; date?: string; due_date?: string | null; status?: string; currency?: string;
          discount_percent?: number; adjustment?: number; subtotal?: number; discount_total?: number; tax_total?: number; total?: number;
          notes?: string | null; terms?: string | null; source_id?: number | null; sent_at?: string | null; created_by?: string | null; created_at?: string;
          project_id?: number | null;
        };
        Relationships: [
          { foreignKeyName: "sales_docs_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_lead_id_fkey"; columns: ["lead_id"]; isOneToOne: false; referencedRelation: "leads"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_source_id_fkey"; columns: ["source_id"]; isOneToOne: false; referencedRelation: "sales_docs"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_docs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      sales_doc_items: {
        Row: { id: number; doc_id: number; position: number; item_id: number | null; description: string; long_description: string | null; qty: number; unit: string | null; rate: number; tax_rate: number };
        Insert: { id?: never; doc_id: number; position?: number; item_id?: number | null; description: string; long_description?: string | null; qty?: number; unit?: string | null; rate?: number; tax_rate?: number };
        Update: { id?: never; doc_id?: number; position?: number; item_id?: number | null; description?: string; long_description?: string | null; qty?: number; unit?: string | null; rate?: number; tax_rate?: number };
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
        };
        Insert: {
          id?: never; name: string; category_id?: number | null; amount: number; tax_rate?: number; date?: string; customer_id?: number | null;
          payment_mode_id?: number | null; reference?: string | null; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_by?: string | null; created_at?: string;
        };
        Update: {
          id?: never; name?: string; category_id?: number | null; amount?: number; tax_rate?: number; date?: string; customer_id?: number | null;
          payment_mode_id?: number | null; reference?: string | null; note?: string | null; is_billable?: boolean; invoice_id?: number | null; created_by?: string | null; created_at?: string;
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
