/** Adaptador Deno de la alerta de presupuesto: Supabase (BD + Edge) y el SMTP ya usado por Auth. */
import nodemailer from 'npm:nodemailer@6'
import { serviceClient } from '../_shared/admin.ts'
import { crearHandler } from './handler.ts'

const service = serviceClient()

function correo() {
  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  if (!host || !user || !pass) return null
  const port = Number(Deno.env.get('SMTP_PORT') || '465')
  const transporte = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  const from = Deno.env.get('SMTP_FROM') || `SEACE Monitor <${user}>`
  return async (destinatario: string, c: { asunto: string; texto: string; html: string }) => {
    await transporte.sendMail({ from, to: destinatario, subject: c.asunto, text: c.texto, html: c.html })
  }
}

Deno.serve(crearHandler({
  async config() {
    const { data, error } = await service.from('alertas_presupuesto_config').select('*').eq('id', 1).maybeSingle()
    if (error) throw new Error('config')
    return data
  },
  async gastoCents(dia) {
    const { data, error } = await service.rpc('proxy_leer_spend', { p_scope: `dia:${dia}` })
    if (error || typeof data !== 'number') throw new Error('gasto')
    return data
  },
  async reclamar(dia, nivel) {
    const { data, error } = await service.rpc('alertas_presupuesto_reclamar', { p_dia: dia, p_nivel: nivel })
    if (error) throw new Error('reclamar')
    return data === true
  },
  async marcar(dia, nivel, ok, err) {
    const { error } = await service.rpc('alertas_presupuesto_marcar', { p_dia: dia, p_nivel: nivel, p_ok: ok, p_error: err })
    if (error) throw new Error('marcar')
  },
  correo,
  ahora: () => new Date(),
  panelUrl: Deno.env.get('PANEL_URL') || 'https://seace.rdiaz-lab.xyz/observabilidad',
}))
