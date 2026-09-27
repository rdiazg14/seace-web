/** Adaptador Deno: la administraci?n permanece en Supabase Edge Functions. */
import { requireAdmin } from '../_shared/admin.ts'
import { crearHandler } from './handler.ts'

Deno.serve(crearHandler({ requireAdmin, masterKey: () => Deno.env.get('IA_MASTER_KEY') }))
