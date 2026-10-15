"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";

export function PrintToolbar({ backHref, name }: { backHref: string; name: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[860px] items-center justify-between gap-3 px-4 print:hidden">
      <Link href={backHref} className={buttonClass({ variant: "secondary", size: "sm" })}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 sm:inline">Choose “Save as PDF” as the printer</span>
        <Button size="sm" onClick={() => window.print()} aria-label={`Download ${name} as PDF`}>
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>
    </div>
  );
}
