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

## Phase 2 — Finance

| Module | What's included |
| --- | --- |
| Proposals | To a lead or a customer, with a written pitch plus priced line items; accept / decline; convert to an estimate or invoice |
| Estimates | Quote with expiry date; accept / decline / expired; one-click convert to invoice |
| Invoices | Sequential numbers (INV-00001), GST per line (shown as CGST + SGST), discount %, adjustment, notes & terms, bank details; status works itself out: draft → unpaid → partially paid → paid, or overdue |
| Payments | Record full or part payments (NEFT/RTGS, UPI, cheque, cash, card) with UTR / reference; payments ledger with monthly totals |
| Credit notes | Issue credit and apply it to the same customer's open invoices |
| Items | Product & service catalogue with rate, unit and GST rate — pick items straight into any document |
| Expenses | Categories, GST, payment mode, customer link; mark billable and **bill to the customer** as an invoice in one click |
| PDF | Every document has a print-ready A4 page — **Download PDF** uses the browser's "Save as PDF" |
| Everywhere else | Dashboard money strip (outstanding, overdue, collected, spent), customer **Billing** tab, lead proposals, Setup → Finance (GST rates, payment modes, expense categories) and company details printed on documents |

New role permissions: **Sales** (Manager full, Executive edit, Support view) and **Expenses** (Manager full, Executive edit, Support none).

## Phase 3 — Projects, contracts & support

| Module | What's included |
| --- | --- |
| Projects | Customer, status, fixed-price or hourly billing, team, deadline; progress from tasks; tabs for tasks (grouped by milestone), milestones, timesheets, files and discussion |
| Timesheets | Log hours per task (billable or not); **Invoice hours** turns unbilled time into a draft invoice (one line per task); fixed-price projects invoice the agreed amount |
| Files | Upload to private Supabase Storage (bucket `project-files`, 10 MB per file); downloads use short-lived signed links |
| Contracts | Type, value, term, terms text; draft → sent → signed (signer & date recorded); active / expiring (30 days) / expired; one-click **Renew**; PDF with signature blocks |
| Support | Numbered tickets with department, priority, assignee, project; conversation thread with customer messages, staff replies and private internal notes; status follows the conversation; suggested help articles |
| Knowledge base | Categories and articles with search, view counts and “Was this helpful?” votes |
| Elsewhere | Dashboard delivery strip, customer **Projects & support** tab, project tasks on the Tasks page, global search across all of the above, Setup → Contracts & support |

New role permissions: **Projects**, **Contracts**, **Support**, **Knowledge base** — Sales Manager full; Sales Executive edits
projects/contracts/tickets and reads the knowledge base; Support runs tickets and the knowledge base and views the rest.

## Roadmap

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
5. `0005_finance.sql` — finance tables, `doc_balances` view, document numbering, RLS, GST rates, payment modes
6. `0006_demo_finance.sql` — finance demo data; `reset_demo_data()` now restores it too

Migrations 5 and 6 are run together in the Supabase SQL Editor (one transaction).
7. `0007_projects_support.sql` — projects, milestones, timesheets, files (+ storage bucket), contracts, tickets, knowledge base, RLS
8. `0008_demo_work.sql` — Phase 3 demo data; `reset_demo_data()` restores it too

Migrations 7 and 8 are likewise run together in the SQL Editor.

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
