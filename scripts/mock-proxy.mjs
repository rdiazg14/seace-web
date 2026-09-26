// Proxy de IA simulado para revisar la interfaz sin consumir proveedores.
// Uso: node scripts/mock-proxy.mjs  y  VITE_AI_PROXY=http://localhost:8788 npm run dev
// Respuestas fijas con la forma del contrato real (/analizar, /cotizar y chat SSE).
// Escenarios de error: incluir "error" en la pregunta (502) o "limite" (429).
import http from 'node:http'

const PORT = Number(process.env.MOCK_PROXY_PORT || 8788)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Funnel-Token, X-Contrato-Id, X-Service-Token',
  'Access-Control-Expose-Headers': 'Content-Type, X-Analisis-Cache, X-Cotizar-Cache, X-Cotizar-Intent',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function json(res, status, body, extra = {}) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', ...extra })
  res.end(JSON.stringify(body))
}

async function sse(res, events, extra = {}) {
  res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', ...extra })
  for (const ev of events) {
    res.write(`data: ${JSON.stringify(ev)}\n\n`)
    await sleep(250)
  }
  res.end()
}

function analisis(id) {
  return {
    contrato_id: id,
    nro: `CS-${id}-2026`,
    entidad: 'Entidad simulada',
    estado: 'Vigente',
    url: `https://prod6.seace.gob.pe/buscador-publico/contrataciones/${id}`,
    tdr_fuente: 'tdr_texto',
    tdr_chars: 12345,
    techo_soles: 42800,
    urgente: false,
    analizado_utc: new Date().toISOString(),
    analisis: {
      resumen: 'Servicio simulado de desarrollo de un portal web con integración a sistemas internos.',
      encaje: { rubro: 'nucleo', califica: 'si', perfil_pedido: 'Desarrollador full stack', razon: 'Encaja con el núcleo de desarrollo.' },
      condiciones: {
        modalidad: 'remoto', modalidad_detalle: 'Trabajo remoto con reuniones virtuales', pago: 'Pago único a la conformidad', armadas: 1,
        plazo: '60 días calendario', penalidades: 'Penalidad diaria según fórmula', tono_modalidad: 'ok', tono_pago: 'ok', tono_plazo: 'warn', tono_penalidad: 'warn',
      },
      economia: {
        valor_estimado_soles: 40000, costo_estimado_soles: 28000, margen_soles: 12000, pistas_valor: 'Experiencia mínima facturada de S/ 40 000.',
        supuestos: ['Equipo de 2 personas', 'Sin licencias'], lo_que_no_sabe: ['Volumen de usuarios'],
      },
      veredicto: { codigo: 'recomendado', razonamiento: 'Margen sano y condiciones favorables.', aviso_humano: 'El número final lo pone ENERTRONIC.' },
      optimizacion: ['Reutilizar componentes del portal previo'],
      chips_sugeridos: ['¿Qué certificados piden?', 'Compara las vías', 'Costo por componente'],
      alternativas: [{ etiqueta: 'A', titulo: 'Vía directa', viabilidad: 'viable', veredicto_corto: 'Viable', explicacion: 'Cabe en el techo.', recomendada: true, economia: { valor: 40000, costo: 28000, margen: 12000 } }],
      timeline: { duracion_total_texto: '60 días', hitos: [
        { orden: 1, nombre: 'Inicio', tipo: 'inicio', momento_texto: 'Día 0', momento_dia: 0, tiene_pago: false, es_critico: false },
        { orden: 2, nombre: 'Entrega final', tipo: 'entregable', momento_texto: 'Día 60', momento_dia: 60, tiene_pago: true, es_critico: true, nota_critica: 'Plazo ajustado' },
      ] },
    },
  }
}

const ESCENARIO = {
  tipo_respuesta: 'tabla',
  escenario: 'Escenario **simulado**: la vía directa mantiene un margen estimado positivo.',
  supuestos_aplicados: ['2 desarrolladores'],
  cambio_vs_analisis: '',
  sigue_sin_saberse: ['Volumen de usuarios'],
  valor_estimado_soles: 40000,
  costo_estimado_soles: 30000,
  margen_estimado_soles: 10000,
  nota: 'El número final lo pone ENERTRONIC.',
  tabla: { titulo: 'Componentes', columnas: ['Componente', 'Mín (S/)', 'Máx (S/)'], filas: [['Portal', '20000', '25000'], ['Integración', '8000', '10000']] },
  grafica: null,
  recomendacion: null,
}

function leer(req) {
  return new Promise((resolve) => {
    let b = ''
    req.on('data', (c) => { b += c })
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')) } catch { resolve({}) }
    })
  })
}

http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return }
  if (req.method !== 'POST') { res.writeHead(405, CORS); res.end('Method Not Allowed'); return }
  const body = await leer(req)
  const q = String(body.query || '').toLowerCase()

  if (path.endsWith('/analizar')) {
    await sleep(800)
    return json(res, 200, analisis(Number(body.contrato_id) || 1), { 'X-Analisis-Cache': 'MISS' })
  }

  if (path.endsWith('/cotizar')) {
    if (q.includes('limite')) return json(res, 429, { error: 'rate_limited', respuesta: 'Has hecho demasiadas consultas. Espera un minuto e intenta de nuevo.' }, { 'Retry-After': '60' })
    if (q.includes('error')) return json(res, 502, { error: 'gemini HTTP 500 [simulado]', layer: 'gemini', model: 'gemini-3.1-flash-lite' })
    return sse(res, [
      { type: 'phase', phase: 'clasificar', message: 'Clasificando tu pregunta...' },
      { type: 'phase', phase: 'contexto', message: 'Recuperando contexto del contrato...' },
      { type: 'phase', phase: 'redactar', message: 'Redactando respuesta...' },
      { type: 'thought', token: 'Reviso el análisis congelado ' },
      { type: 'thought', token: 'y los supuestos.' },
      { type: 'thought_done' },
      { type: 'text', token: 'Escenario **simulado**: ' },
      { type: 'text', token: 'la vía directa mantiene un margen estimado positivo.' },
      {
        type: 'data', contrato_id: body.contrato_id, escenario: ESCENARIO,
        clasificacion: { nivel: 2, formato: 'tabla', necesita_internet: false, razon: 'self-routing' },
        usage: { prompt: 1200, completion: 180, cached: 0, thoughts: 40, total: 1420 }, thought: 'Reviso el análisis congelado y los supuestos.',
        model: body.model || 'gemini-3.1-flash-lite', meta: { finishReason: 'STOP', thinkingLevel: 'low', latencyMs: 1234 },
        models: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.1-pro-preview'], request_id: 'mock-0000-0000',
        web_sources: [], consumido_usd: 0.42, presupuesto_usd: 5.93, saldo_usd: 5.51,
      },
      { type: 'done' },
    ], { 'X-Cotizar-Cache': 'MISS', 'X-Cotizar-Intent': 'flash' })
  }

  if (q.includes('limite')) return json(res, 429, { error: 'daily_limited', respuesta: 'Llegaste al límite diario de consultas para tu cuenta. Intenta mañana.', response: '', contratos_referenciados: [], chunks_usados: 0 })
  if (q.includes('error')) {
    return sse(res, [{ stage: 'searching', message: 'Buscando en TDR...' }, { stage: 'error', message: 'gemini embed HTTP 500 [simulado]' }])
  }
  return sse(res, [
    { stage: 'searching', message: 'Buscando en TDR...' },
    { stage: 'found', chunks: 2, message: 'Encontré 2 fragmentos relevantes' },
    { stage: 'streaming', token: 'Respuesta **simulada** del chat: ' },
    { stage: 'streaming', token: 'no se consultó ningún proveedor.' },
    { stage: 'done', contratos_referenciados: [], chunks_usados: 2, usage: { prompt: 300, completion: 40 }, web_sources: [] },
  ])
}).listen(PORT, () => console.log(`proxy simulado en http://localhost:${PORT}`))
