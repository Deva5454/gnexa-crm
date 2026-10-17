import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parseFormat, setFormatConfig } from "@/lib/format-config";

/** Load Setup → Numbering & dates for this request (anyone may read it) and apply it to docNumber / formatDate. */
export const loadFormat = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("format_settings");
  const config = parseFormat(data);
  setFormatConfig(config);
  return config;
});
