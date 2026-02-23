import { createClient as supabaseCreateClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton for convenience
export const supabase = supabaseCreateClient(url, key);

// Factory for component-level usage
export function createClient() {
    return supabaseCreateClient(url, key);
}
