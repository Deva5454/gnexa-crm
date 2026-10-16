"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck, BellRing } from "lucide-react";
import { loadBell, markAllRead, markRead, type BellItem } from "@/lib/actions/notifications";
import { cn, timeAgo } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const last = useRef(0);
  const refresh = useCallback(() => {
    last.current = Date.now();
    loadBell()
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
      })
      .catch(() => {});
  }, []);

  // Refresh when the page changes (at most every 30 s), and every minute while the tab is visible —
  // a hidden tab doesn't poll at all, and catches up as soon as it's shown again
  useEffect(() => {
    if (Date.now() - last.current > 30_000) refresh();
  }, [pathname, refresh]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    const onShow = () => {
      if (document.visibilityState === "visible" && Date.now() - last.current > 30_000) refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [refresh]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (n: BellItem) => {
    setOpen(false);
    if (!n.is_read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      start(() => markRead(n.id));
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refresh();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() =>
                  start(async () => {
                    await markAllRead();
                    setItems((l) => l.map((x) => ({ ...x, is_read: true })));
                    setUnread(0);
                  })
                }
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => go(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50", !n.is_read && "bg-brand-50/50")}>
                  <span className={cn("mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full", n.title === "Reminder" ? "bg-amber-100 text-amber-600" : "bg-brand-100 text-brand-600")}>
                    {n.title === "Reminder" ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", n.is_read ? "text-slate-600" : "font-semibold text-slate-900")}>{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-slate-400" suppressHydrationWarning>{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </button>
              </li>
            ))}
            {!items.length && <li className="px-4 py-10 text-center text-sm text-slate-400">You&apos;re all caught up.</li>}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-brand-600 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
