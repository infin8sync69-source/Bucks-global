import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Log a warning but don't throw — the app can still function via the FastAPI backend
    if (typeof window !== 'undefined') {
        console.warn(
            '[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
            'Direct Supabase features (real-time, direct queries) will be unavailable.',
        );
    }
}

// Create a single Supabase client for the entire frontend.
// If env vars are missing we create a stub client with placeholder values
// so that imports don't crash; actual calls will fail gracefully.
export const supabase = createClient(
    supabaseUrl  || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
);

export default supabase;
