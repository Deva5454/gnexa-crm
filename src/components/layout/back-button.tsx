"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Entry = { path: string; url: string };
const KEY = "gnexa-trail";
// Forms are never a "back" target once you've left them (e.g. after saving a new record)
const FORM = /\/(new|edit|import)$/;
// Folders with no page of their own
const NO_PAGE = new Set(["/sales"]);

function read(): Entry[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(trail: Entry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-50)));
  } catch {
    /* private mode: the button falls back to the parent page */
  }
}

/** The page one level up: /customers/5/edit → /customers/5, /settings/finance → /settings. */
function parentOf(path: string, home: string) {
  let p = path;
  do p = p.slice(0, p.lastIndexOf("/")); while (NO_PAGE.has(p));
  return p && p !== "/" ? p : home;
}

/**
 * "Back" on every screen (rendered by the staff and portal layouts).
 * Goes to the previous page you were on in this tab — ignoring filter and paging changes on the same page —
 * or, when you arrived directly (a link, a bookmark), to the page one level up.
 */
export function BackButton({ home }: { home: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams().toString();

  // Keep a per-tab trail of the pages visited
  useEffect(() => {
    const url = params ? `${path}?${params}` : path;
    const trail = read();
    while (trail.length && FORM.test(trail.at(-1)!.path) && trail.at(-1)!.path !== path) trail.pop();
    if (trail.at(-1)?.path === path) trail[trail.length - 1] = { path, url };
    else if (trail.at(-2)?.path === path) {
      trail.pop();
      trail[trail.length - 1] = { path, url };
    } else trail.push({ path, url });
    write(trail);
  }, [path, params]);

  if (path === home) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const prev = read().at(-2);
        router.push(prev && prev.path !== path ? prev.url : parentOf(path, home));
      }}
      className="mb-3 inline-flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm font-medium text-slate-500 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 print:hidden"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
}
