# gnexa.crm

A calm, modern CRM: customers, leads and tasks in one workspace. Feature set modelled on Perfex CRM, with its own look
(deep-ink navigation rail, violet → teal "aurora" accents, Plus Jakarta Sans).

- **Frontend:** Next.js 15 (App Router, Server Components + Server Actions), TypeScript, Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Row Level Security), project `gnexa-crm` (`vnypwxkruxczjbaesfye`, Mumbai)
- **Hosting:** Vercel (`gnexa-crm.vercel.app`)

## Phase 1 — Core sales (this release)

| Module | What's included |
| --- | --- |
| Demo mode & roles | No login screen — visitors are signed in automatically as the Administrator. A **role switcher** in the top bar swaps between four personas (Administrator, Sales Manager, Sales Executive, Support); each role's permissions are enforced on the server and the UI hides what it can't do. Admins can **reset the demo data** from Setup. |
| Dashboard | Pipeline value, active customers, win rate, overdue tasks, pipeline-by-stage chart, 14-day new-lead trend, leads by source, my open tasks, team activity |
| Customers | List with search / status / group filters and pagination, profile, multiple contacts with primary contact, notes, linked tasks, activity log, active/inactive, delete |
| Leads | Drag-and-drop kanban board + list view, filters (mine, source, lost, junk), deal value, owner, notes, linked tasks, mark lost/junk, **one-click convert to customer** (creates customer + primary contact, moves notes & tasks) |
| Tasks | My / all tasks, status summary tiles, due-today & overdue filters, inline status change, quick-complete, priority, start/due dates, multiple assignees, link to a customer or lead |
| Search | Global search across customers, contacts, leads and tasks |
| Setup (admin) | Company name & currency, staff activation / admin / role, roles, pipeline stages (colour, order, "won" stage), lead sources, customer groups |

## Roadmap

- **Phase 2 — Finance:** proposals, estimates, invoices (PDF), payments, credit notes, expenses, taxes, items catalogue
- **Phase 3 — Projects & support:** projects (milestones, timesheets, files, discussions), contracts with e-sign, support tickets, knowledge base
- **Phase 4 — Portal & utilities:** customer portal, calendar, announcements, goals, reports, fine-grained role permissions, email templates

## Local development

```bash
cp .env.example .env.local   # already points at the gnexa-crm Supabase project
npm install
npm run dev                  # http://localhost:3000
```

`npm run typecheck`, `npm run lint` and `npm run build` should all pass before pushing.

## Database

SQL migrations live in `supabase/migrations/` and have already been applied to the Supabase project:

1. `0001_core_sales.sql` — tables, enums, triggers, RLS policies, `convert_lead()` RPC, seed data
2. `0002_harden_functions.sql` — moves helper functions into a non-exposed `private` schema
3. `0003_fk_indexes.sql` — covering indexes for foreign keys
4. `0004_demo_mode.sql` — demo persona accounts, sample data, `reset_demo_data()` — **run this once in the Supabase
   SQL Editor** (it writes to the `auth` schema). Safe to re-run.

### Demo roles

| Persona | Role | Customers | Leads | Tasks | Setup |
| --- | --- | --- | --- | --- | --- |
| Aarav Mehta | Administrator | full | full | full | ✓ |
| Priya Nair | Sales Manager | full | full | full | — |
| Rohan Kulkarni | Sales Executive | create & edit | create & edit | create & edit | — |
| Sneha Iyer | Support | view | view | create & edit | — |

"full" includes delete. Role permissions come from the `roles.permissions` column, so editing a role changes what its
persona can do.

**Security model:** every table has RLS. Signed-out visitors can't read anything; signed-in but un-approved users
see only their own profile; active staff have full access to customers, leads and tasks; only admins can change
configuration or other people's access. A database trigger stops anyone from making themselves an admin.

## Deploying to Vercel

1. Push this repo to GitHub (`Deva5454/gnexa-crm`).
2. In Vercel → **Add New → Project** → import `gnexa-crm`. Name the project **`gnexa-crm`** so it gets
   `https://gnexa-crm.vercel.app`.
3. Add environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vnypwxkruxczjbaesfye.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the publishable key from `.env.example`
4. Deploy.
5. Run `supabase/migrations/0004_demo_mode.sql` in the Supabase SQL Editor (creates the demo personas and data).
6. Optional: Supabase → **Authentication → Sign In / Providers** → turn off **Allow new users to sign up** — the demo
   doesn't use sign-ups.
