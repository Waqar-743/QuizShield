import { createClient } from '@supabase/supabase-js';
import { config } from './environment';

if (!config.supabaseUrl || !config.supabaseKey) {
  console.warn('Supabase URL or Key is missing. Please check your .env file.');
}

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);
