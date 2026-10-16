"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Production hides server error details; only show messages that weren't replaced by that notice
  const hidden = !error.message || /omitted in production|Server Components render/i.test(error.message);
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description={hidden ? "This page couldn't load. Try again — if it keeps happening, go back and retry the last step." : error.message}
        action={
          <Button disabled={pending} onClick={() => start(() => { router.refresh(); reset(); })}>
            {pending ? "Retrying…" : "Try again"}
          </Button>
        }
      />
    </Card>
  );
}
