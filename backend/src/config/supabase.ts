import { createClient } from '@supabase/supabase-js';
import { config } from './environment';

// Use the service role key for server-side operations — it bypasses RLS safely
// because our Express middleware enforces auth at the API layer.
// The anon key is intentionally NOT used here so that disabled-RLS tables
// cannot be accessed directly from the browser via the Supabase client.
const serviceKey = config.supabaseServiceKey || config.supabaseKey;

export const supabase = createClient(config.supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
