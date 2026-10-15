import type { Json } from "@/lib/database.types";

export type Module = "customers" | "leads" | "tasks" | "sales" | "expenses" | "projects" | "contracts" | "support" | "knowledge_base" | "reports";
export const MODULES: Module[] = ["customers", "leads", "tasks", "sales", "expenses", "projects", "contracts", "support", "knowledge_base", "reports"];
/** view < edit (create & change) < full (also delete) */
export type Level = "view" | "edit" | "full";

const RANK = { none: 0, view: 1, edit: 2, full: 3 } as const;

export type Access = Record<Module, Level | "none">;

/** Resolve a staff member's access from the admin flag and their role's `permissions` JSON. */
export function resolveAccess(isAdmin: boolean, rolePermissions: Json | null | undefined): Access {
  if (isAdmin) return Object.fromEntries(MODULES.map((m) => [m, "full"])) as Access;
  const perms = (rolePermissions && typeof rolePermissions === "object" && !Array.isArray(rolePermissions) ? rolePermissions : {}) as Record<string, Json>;
  const pick = (m: Module): Level | "none" => {
    const v = perms[m];
    if (v === "none" || v === "view" || v === "edit" || v === "full") return v;
    return "edit"; // staff without a role (or a role predating a module) default to edit
  };
  return Object.fromEntries(MODULES.map((m) => [m, pick(m)])) as Access;
}

export function allows(access: Access, module: Module, need: Level) {
  return RANK[access[module]] >= RANK[need];
}

export const LEVEL_LABEL: Record<Level | "none", string> = { none: "No access", view: "View only", edit: "Create & edit", full: "Full (incl. delete)" };
