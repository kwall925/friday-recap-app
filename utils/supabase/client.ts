// utils/supabase/client.ts

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// import { Database } from '@/lib/database.types' // Omitted for now

export function createClient() {
  // createClientComponentClient is the standard helper for browser-side code.
  // It automatically looks up the NEXT_PUBLIC_* variables.
  return createClientComponentClient(); 
}