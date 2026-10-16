/**
 * Supabase returns at most 1,000 rows per request, silently. For totals, pickers and summaries that must
 * see every row, page through the whole result instead. Pass a function that builds the query for a range
 * (with a stable order, so pages don't overlap). Returns `{ data }` like a normal query.
 */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  cap = 50_000,
): Promise<{ data: T[] }> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: out };
}

/** Split a long id list so `.in("id", …)` filters never outgrow the request URL. */
export function chunks<T>(xs: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
