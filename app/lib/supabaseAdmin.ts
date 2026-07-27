import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qtjuqdnopkphvcikocow.supabase.co";

export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");
  }
  return createClient(SUPABASE_URL, serviceKey, { db: { schema: "tenderops" } });
}
