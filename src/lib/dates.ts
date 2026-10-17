/**
 * Calendar dates in Indian time. The server runs in UTC, so `new Date().toISOString().slice(0, 10)` is
 * yesterday between midnight and 5:30 am IST — new invoices and payments got the wrong date and overdue
 * checks ran a day late. Everything that means "today" goes through here. Works in the browser too.
 */
export const APP_TIME_ZONE = "Asia/Kolkata";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date (YYYY-MM-DD) in India. */
export function todayIST(now: Date = new Date()) {
  return fmt.format(now);
}

/** Today ± n days (YYYY-MM-DD), India. */
export function daysFromToday(n: number) {
  const d = new Date(`${todayIST()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** First day of this month (or `offset` months away), India. */
export function monthStartIST(offset = 0) {
  const [y, m] = todayIST().split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
}

/** Last day of this month, India. */
export function monthEndIST() {
  const [y, m] = todayIST().split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

/** Period filters shared by the money lists (expenses, payments). */
export const PERIODS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "fy", label: "This financial year" },
];

/** [from, to] (inclusive, YYYY-MM-DD) for a period filter, India time. Financial year runs April–March. */
export function periodRange(p: string | undefined): [string, string] | null {
  const today = todayIST();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (p) {
    case "this_month": return [monthStartIST(), monthEndIST()];
    case "last_month": {
      const start = monthStartIST(-1);
      const end = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10);
      return [start, end];
    }
    case "this_year": return [`${y}-01-01`, `${y}-12-31`];
    case "last_year": return [`${y - 1}-01-01`, `${y - 1}-12-31`];
    case "fy": return m >= 4 ? [`${y}-04-01`, `${y + 1}-03-31`] : [`${y - 1}-04-01`, `${y}-03-31`];
    default: return null;
  }
}
