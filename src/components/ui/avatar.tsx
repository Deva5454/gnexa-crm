import { cn, initials } from "@/lib/utils";

const tints = [
  "bg-brand-100 text-brand-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-lime-100 text-lime-700",
];

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const n = name ?? "";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return (
    <span
      title={n}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tints[h % tints.length],
        className,
      )}
    >
      {initials(n)}
    </span>
  );
}
