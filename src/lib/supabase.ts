import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://wusywwhcyqngnpvpzxyr.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3l3d2hjeXFuZ25wdnB6eHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDc0NDcsImV4cCI6MjEwMjMyMzQ0N30.jDZeGaW8lQuROU7IF11clkfjgyyiMrgyIfi6LvuAFeY'

export const AI_PROXY = 'https://seace-ai-proxy.rdiazg14.workers.dev'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
