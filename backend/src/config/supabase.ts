import { createClient } from '@supabase/supabase-js';
import { config } from './environment';

if (!config.supabaseUrl || !config.supabaseKey) {
  console.warn('Supabase URL or Key is missing. Please check your .env file.');
}

// Ensure we have valid string values to prevent createClient from throwing synchronously
// Use placeholders if keys are missing so the app can start (and fail gracefully at runtime instead of crash-on-boot)
const url = config.supabaseUrl || 'https://placeholder.supabase.co';
const key = config.supabaseKey || 'placeholder-key';

if (!config.supabaseUrl || !config.supabaseKey) {
  console.warn('-------------------------------------------------------');
  console.warn('⚠️  WARNING: Supabase URL or Key is MISSING in environment variables!');
  console.warn('⚠️  App is running in placeholder mode. Database operations WILL fail.');
  console.warn('-------------------------------------------------------');
}

export const supabase = createClient(url, key);
