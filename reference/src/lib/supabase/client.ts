import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (login form, realtime if ever needed). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
