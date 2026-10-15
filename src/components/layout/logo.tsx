import { useId } from "react";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  // Unique gradient id: several logos can be on one page and a hidden one must not own the id
  const id = `gx${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a75fb" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path
        d="M21.5 11.2A7 7 0 1 0 23 16h-6.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23" cy="16" r="1.9" fill="#fff" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className="text-[17px] font-bold tracking-tight text-white">
          gnexa<span className="text-accent-400">.</span>crm
        </span>
      )}
    </div>
  );
}
