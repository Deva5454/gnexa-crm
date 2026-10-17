"use client";

import { useRef } from "react";
import { addNote } from "@/lib/actions/notes";
import { SubmitButton } from "@/components/ui/submit-button";

export function NoteComposer({ relType, relId }: { relType: "customer" | "lead" | "project" | "contract"; relId: number }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await addNote(fd);
        ref.current?.reset();
      }}
      className="space-y-2"
    >
      <input type="hidden" name="rel_type" value={relType} />
      <input type="hidden" name="rel_id" value={relId} />
      <textarea name="body" required rows={3} placeholder="Write a note — call summary, next steps, context…" className="field resize-y" />
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingText="Saving…">Add note</SubmitButton>
      </div>
    </form>
  );
}
