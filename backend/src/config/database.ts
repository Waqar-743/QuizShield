import { supabase } from './supabase';

export const connectDatabase = async () => {
  try {
    // Simple query to check connection
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') { // Ignore "relation does not exist" if table is missing, but catch auth errors
       console.warn('Supabase connection check warning:', error.message);
       // We don't throw here because tables might not exist yet
    }
    
    console.log('Supabase client initialized successfully');
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    process.exit(1);
  }
};
