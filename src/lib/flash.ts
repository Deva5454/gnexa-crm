import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";

export const FLASH_COOKIE = "gnexa_flash";

/** Turn a database or app error into something a person can act on. */
export function friendlyError(message: string) {
  if (/row-level security|permission denied/i.test(message)) return "Your role doesn't allow this.";
  if (/violates foreign key constraint/i.test(message)) return "This record is still linked to other records, so it can't be removed.";
  if (/duplicate key value/i.test(message)) return "That already exists.";
  if (/invalid input syntax for type (date|numeric|integer|bigint)/i.test(message)) return "One of the values isn't valid — check dates and numbers.";
  return message;
}

/**
 * Run a form action; if it fails, show the reason as a message on the page instead of the error screen.
 * (Production builds hide thrown messages from the browser, so we hand them over in a short-lived cookie
 * that the app layout turns into a toast.) Redirects and not-found still work as usual.
 */
export async function withFlash<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    unstable_rethrow(e);
    const message = friendlyError(e instanceof Error && e.message ? e.message : "Something went wrong — please try again.");
    (await cookies()).set(FLASH_COOKIE, JSON.stringify({ id: Date.now(), message: message.slice(0, 300) }), { path: "/", maxAge: 60, sameSite: "lax" });
    revalidatePath("/", "layout"); // re-render the layout so the message shows straight away
    return undefined;
  }
}

/** Throw (→ shown by withFlash) when a Supabase write failed, instead of silently carrying on. */
export function must<T extends { error: { message: string } | null }>(result: T): T {
  if (result.error) throw new Error(result.error.message);
  return result;
}
