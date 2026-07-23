import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — set them in .env.local (see .env.example).',
  )
}

/** Single Supabase client. Session persistence + refresh is handled
    automatically (localStorage), which is what keeps a user signed in
    across navigation and page reloads. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
