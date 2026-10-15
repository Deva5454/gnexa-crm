import { LogoMark } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

/** Frame for public pages (forms, surveys). `embed` drops the background for use inside an iframe. */
export function PublicShell({ company, embed, children }: { company: string; embed?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-h-screen", embed ? "bg-transparent p-2" : "bg-slate-50 px-4 py-10 sm:py-16")}>
      <div className="mx-auto w-full max-w-xl">
        {!embed && (
          <div className="mb-6 flex items-center gap-2.5">
            <LogoMark className="h-9 w-9" />
            <span className="text-base font-bold text-slate-900">{company}</span>
          </div>
        )}
        <div className={cn("rounded-2xl border border-slate-200 bg-white p-6 sm:p-8", !embed && "shadow-card")}>{children}</div>
        {!embed && <p className="mt-4 text-center text-xs text-slate-400">Powered by Gnexa CRM</p>}
      </div>
    </div>
  );
}
