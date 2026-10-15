// Demo mode: no individual logins. Each persona is a real Supabase account; the role switcher signs in as one.
export const DEMO_PERSONAS = [
  { key: "admin", email: "admin@demo.gnexa.app", name: "Aarav Mehta", role: "Administrator", blurb: "Everything, including Setup", client: false },
  { key: "manager", email: "manager@demo.gnexa.app", name: "Priya Nair", role: "Sales Manager", blurb: "Full access to sales, projects & support", client: false },
  { key: "executive", email: "executive@demo.gnexa.app", name: "Rohan Kulkarni", role: "Sales Executive", blurb: "Create & edit everything — can't delete", client: false },
  { key: "support", email: "support@demo.gnexa.app", name: "Sneha Iyer", role: "Support", blurb: "Runs tickets & knowledge base; views the rest", client: false },
  { key: "client-tata", email: "client.tata@demo.gnexa.app", name: "Rajesh Khanna", role: "Client · Tata Advanced Materials", blurb: "Client portal — invoices, contracts, tickets", client: true },
  { key: "client-orchid", email: "client.orchid@demo.gnexa.app", name: "Sunil Fernandes", role: "Client · Orchid Hotels & Resorts", blurb: "Client portal — invoices, contracts, tickets", client: true },
] as const;

export type PersonaKey = (typeof DEMO_PERSONAS)[number]["key"];

export const personaByEmail = (email: string | null | undefined) => DEMO_PERSONAS.find((p) => p.email === email);
export const personaByKey = (key: string | null | undefined) => DEMO_PERSONAS.find((p) => p.key === key);

/** Demo client logins by auth user id (see supabase/migrations/0010_demo_portal.sql). */
export const PORTAL_PERSONA_BY_USER: Record<string, string> = {
  "b0000000-0000-4000-8000-000000000001": "client-tata",
  "b0000000-0000-4000-8000-000000000002": "client-orchid",
};
