import { CheckCircle2 } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";

const points = ["Pipeline you can see at a glance", "Customers, contacts & notes in one place", "Tasks that never slip through"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-accent-500/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="text-xl font-bold tracking-tight">
            gnexa<span className="text-accent-400">.</span>crm
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Relationships,
            <br />
            <span className="bg-aurora bg-clip-text text-transparent">beautifully organised.</span>
          </h2>
          <ul className="mt-8 space-y-3 text-slate-300">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-400" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-16 text-xs text-slate-500">© {new Date().getFullYear()} Gnexa</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="text-lg font-bold">
              gnexa<span className="text-accent-500">.</span>crm
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
