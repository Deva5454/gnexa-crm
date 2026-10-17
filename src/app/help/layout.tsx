import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/help" className="flex items-center gap-2.5 font-bold text-slate-900"><LogoMark className="h-8 w-8" /> Help center</Link>
          <Link href="/portal" className="text-sm font-medium text-brand-700 hover:underline">Client portal sign-in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <p className="pb-8 text-center text-xs text-slate-400">Powered by Gnexa CRM</p>
    </div>
  );
}
