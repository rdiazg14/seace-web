import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wusywwhcyqngnpvpzxyr.supabase.co'
// anon/public key — safe to expose in frontend (RLS enabled, read-only)
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3l3d2hjeXFuZ25wdnB6eHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDc0NDcsImV4cCI6MjEwMjMyMzQ0N30.jDZeGaW8lQuROU7IF11clkfjgyyiMrgyIfi6LvuAFeY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
