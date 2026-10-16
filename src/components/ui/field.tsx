import { isValidElement } from "react";
import { cn } from "@/lib/utils";
import { KeepValues } from "./keep-values";

export function Field({
  label,
  htmlFor,
  className,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  // A single input/select/textarea is wrapped by its label, so screen readers announce the label and
  // clicking it focuses the field — even when no htmlFor/id pair was given
  const single = !htmlFor && isValidElement(children) && typeof children.type === "string" && ["input", "select", "textarea"].includes(children.type);
  if (single)
    return (
      <div className={cn("min-w-0", className)}>
        <label className="block">
          <span className="label block">{label}</span>
          {children}
        </label>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    );
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** The form's error message. Also keeps what was typed when a failed save makes React reset the form. */
export function FormError({ message }: { message?: string | null }) {
  return (
    <>
      <KeepValues active={!!message} />
      {message && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {message}
        </div>
      )}
    </>
  );
}
