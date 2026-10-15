"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card>
      <EmptyState icon={AlertTriangle} title="Something went wrong" description={error.message || "Please try again."} action={<Button onClick={reset}>Try again</Button>} />
    </Card>
  );
}
