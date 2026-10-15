import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { saveCustomFieldValues } from "@/lib/actions/custom-fields";
import { requireStaff } from "@/lib/auth";
import { loadCustomFields, type CfEntity } from "@/lib/custom-fields";
import { CustomFieldsForm } from "./custom-fields-form";

const MODULE = { customer: "customers", lead: "leads", project: "projects", ticket: "support", sales_doc: "sales", contract: "contracts" } as const;

/** "More details" card with the admin-defined custom fields for one record. Renders nothing if none exist. */
export async function CustomFieldsCard({ entity, relId, path }: { entity: CfEntity; relId: number; path: string }) {
  const { supabase, can } = await requireStaff();
  const { fields, values } = await loadCustomFields(supabase, entity, relId);
  if (!fields.length) return null;
  return (
    <Card>
      <CardHeader title="More details" description="Custom fields — set them up in Setup" />
      <CardBody>
        <CustomFieldsForm fields={fields} values={values} action={saveCustomFieldValues.bind(null, entity, relId, path)} canEdit={can(MODULE[entity], "edit")} />
      </CardBody>
    </Card>
  );
}
