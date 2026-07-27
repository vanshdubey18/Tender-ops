import { createClient } from "@supabase/supabase-js";

// The anon key is designed to be public — every write it can make is
// governed by the RLS policies on the `tenderops` schema, scoping each
// business to its own rows.
const SUPABASE_URL = "https://qtjuqdnopkphvcikocow.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anVxZG5vcGtwaHZjaWtvY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzg3MjUsImV4cCI6MjA5NDc1NDcyNX0.EtIDccQj9wAfdxd09YiolUXeiZtuNUEnoiFw6cWYhVQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: "tenderops" },
});
