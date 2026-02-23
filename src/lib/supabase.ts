import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton browser client — shares auth session across all components
export const supabase = createBrowserClient(url, key);

// Alias for compatibility
export function createClient() {
    return supabase; // Return the same singleton to ensure auth session is shared
}
