export const REQ_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-sky-50 text-sky-700 ring-sky-200" },
  in_review: { label: "In review", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  quoted: { label: "Quoted", color: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  declined: { label: "Declined", color: "bg-slate-100 text-slate-600 ring-slate-200" },
};
