// Demo mode: no individual logins. Each persona is a real Supabase account; the role switcher signs in as one.
export const DEMO_PERSONAS = [
  { key: "admin", email: "admin@demo.gnexa.app", name: "Aarav Mehta", role: "Administrator", blurb: "Everything, including Setup" },
  { key: "manager", email: "manager@demo.gnexa.app", name: "Priya Nair", role: "Sales Manager", blurb: "Full access to customers, leads & tasks" },
  { key: "executive", email: "executive@demo.gnexa.app", name: "Rohan Kulkarni", role: "Sales Executive", blurb: "Create & edit — can't delete" },
  { key: "support", email: "support@demo.gnexa.app", name: "Sneha Iyer", role: "Support", blurb: "Views customers & leads, works on tasks" },
] as const;

export type PersonaKey = (typeof DEMO_PERSONAS)[number]["key"];

export const personaByEmail = (email: string | null | undefined) => DEMO_PERSONAS.find((p) => p.email === email);
export const personaByKey = (key: string | null | undefined) => DEMO_PERSONAS.find((p) => p.key === key);
