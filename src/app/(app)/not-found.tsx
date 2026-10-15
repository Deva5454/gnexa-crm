import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <Card>
      <EmptyState icon={SearchX} title="Not found" description="This record doesn't exist or was deleted." action={<LinkButton href="/dashboard">Back to dashboard</LinkButton>} />
    </Card>
  );
}
