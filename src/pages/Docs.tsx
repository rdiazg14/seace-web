import { useState } from 'react'

const SUPABASE_URL = 'https://wusywwhcyqngnpvpzxyr.supabase.co'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1c3l3d2hjeXFuZ25wdnB6eHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NDc0NDcsImV4cCI6MjEwMjMyMzQ0N30.' +
  'jDZeGaW8lQuROU7IF11clkfjgyyiMrgyIfi6LvuAFeY'
const AI_PROXY = 'https://seace-ai-proxy.rdiazg14.workers.dev'

/* ── Code snippets ─────────────────────────────────────────────────── */

const CURL_BUSCAR = `curl -X POST '${SUPABASE_URL}/rest/v1/rpc/buscar_contratos' \\
  -H "apikey: ${ANON_KEY}" \\
  -H "Authorization: Bearer ${ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "termino": "ciberseguridad",
    "filtro_objeto": "Servicio",
    "filtro_estado": "Vigente",
    "filtro_entidad": null,
    "limite": 10,
    "offset_val": 0
  }'`

const CURL_AI = `curl -X POST '${AI_PROXY}' \\
  -H "Content-Type: application/json" \\
  -H "Origin: https://seace.rdiaz-lab.xyz" \\
  -d '{
    "query": "ciberseguridad vigente",
    "contratos": [{
      "id": 1,
      "descripcion": "SERVICIO DE CIBERSEGURIDAD",
      "entidad": "MINISTERIO DE ECONOMIA",
      "estado": "Vigente",
      "objeto": "Servicio",
      "relevancia_ia": null
    }]
  }'`

const PYTHON_CODE = `import requests

SUPABASE_URL = "${SUPABASE_URL}"
ANON_KEY     = "${ANON_KEY}"

def buscar_contratos(termino, filtro_objeto=None, filtro_estado=None, limite=10):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/buscar_contratos",
        headers={
            "apikey":        ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type":  "application/json",
        },
        json={
            "termino":        termino,
            "filtro_objeto":  filtro_objeto,
            "filtro_estado":  filtro_estado,
            "filtro_entidad": None,
            "limite":         limite,
            "offset_val":     0,
        },
    )
    r.raise_for_status()
    return r.json()

# Ejemplo: contratos de token vigentes
resultados = buscar_contratos("token", filtro_estado="Vigente")
for c in resultados:
    print(c["entidad"], "—", c["descripcion_contrato"])`

const JS_CODE = `const SUPABASE_URL = '${SUPABASE_URL}'
const ANON_KEY     = '${ANON_KEY}'

async function buscarContratos({ termino, filtroObjeto, filtroEstado, limite = 10 }) {
  const res = await fetch(\`\${SUPABASE_URL}/rest/v1/rpc/buscar_contratos\`, {
    method: 'POST',
    headers: {
      'apikey':        ANON_KEY,
      'Authorization': \`Bearer \${ANON_KEY}\`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      termino,
      filtro_objeto:  filtroObjeto ?? null,
      filtro_estado:  filtroEstado ?? null,
      filtro_entidad: null,
      limite,
      offset_val: 0,
    }),
  })
  if (!res.ok) throw new Error(\`HTTP \${res.status}\`)
  return res.json()
}

// Ejemplo: oracle vigente
const contratos = await buscarContratos({ termino: 'oracle', filtroEstado: 'Vigente' })
console.log(contratos)`

const CLAUDE_PROMPT = `Eres un asistente especializado en contrataciones públicas del Estado peruano (SEACE).
Tienes acceso a una base de datos con 76,250 contratos publicados en 2026.

## Endpoint de búsqueda

POST ${SUPABASE_URL}/rest/v1/rpc/buscar_contratos
Headers:
  apikey: ${ANON_KEY}
  Authorization: Bearer ${ANON_KEY}
  Content-Type: application/json

Body (JSON):
{
  "termino":        "palabras a buscar (búsqueda de texto completo)",
  "filtro_objeto":  "Bien" | "Servicio" | "Obra" | "Consultoría de Obra" | null,
  "filtro_estado":  "Vigente" | "En Evaluación" | "Culminado" | "Cancelado" | null,
  "filtro_entidad": null,
  "limite":         10,
  "offset_val":     0
}

## Esquema de cada contrato

{
  "id":                   número único del contrato,
  "nro_contratacion":     número del proceso (ej: CM-001-2026-MINSA),
  "descripcion_contrato": título del proceso de contratación,
  "objeto":               Bien | Servicio | Obra | Consultoría de Obra,
  "descripcion":          descripción del objeto contratado,
  "entidad":              nombre de la entidad del Estado peruano,
  "estado":               Vigente | En Evaluación | Culminado | Cancelado,
  "fecha_publica":        fecha de publicación (ISO 8601),
  "fecha_ini_cotizacion": inicio de cotización,
  "fecha_fin_cotizacion": cierre de cotización (importante para urgencia),
  "categoria_it":         Ciberseguridad | IA/analytics | Microsoft | Oracle | Hardware… | null,
  "relevancia_ia":        ALTA | MEDIA | BAJA | null
}

## Categorías IT disponibles

Firma digital, IA/analytics, Ciberseguridad, Cloud/hosting, Microsoft, Oracle,
Base de datos/ERP, Desarrollo software, Licencias, Soporte tecnico,
Redes/cableado, Correo electronico, Hardware

## Instrucciones

1. Cuando el usuario pregunte sobre contratos, llama al endpoint con los términos relevantes.
2. Presenta los resultados de forma clara: entidad, descripción, estado y fecha de cierre.
3. Prioriza contratos VIGENTES con fecha_fin_cotizacion próxima.
4. Identifica patrones: entidades más activas, categorías predominantes, tendencias.
5. Responde siempre en español.
6. Si no encuentras resultados, sugiere términos alternativos.
7. Para análisis de IA generativa, filtra por relevancia_ia = ALTA.`

const CHATGPT_PROMPT = `Eres un asistente experto en el SEACE, el Sistema Electrónico de Contrataciones del Estado peruano.

Tienes acceso a datos reales de 76,250 contratos del año 2026 mediante esta API pública:

ENDPOINT: POST ${SUPABASE_URL}/rest/v1/rpc/buscar_contratos
API KEY:  ${ANON_KEY}

Parámetros de búsqueda (JSON body):
  termino        → texto libre (búsqueda full-text en español)
  filtro_objeto  → "Bien" | "Servicio" | "Obra" | null
  filtro_estado  → "Vigente" | "En Evaluación" | "Culminado" | null
  filtro_entidad → null (siempre null)
  limite         → número de resultados (recomendado: 10-20)
  offset_val     → paginación (0 = primera página)

Headers requeridos:
  apikey: [API KEY arriba]
  Authorization: Bearer [API KEY arriba]
  Content-Type: application/json

INSTRUCCIONES:
- Usa Code Interpreter para hacer la llamada HTTP cuando el usuario pida datos de contratos.
- Extrae los campos más relevantes: entidad, descripcion_contrato, estado, fecha_fin_cotizacion.
- Identifica oportunidades: contratos Vigentes con cotización abierta (fecha_fin_cotizacion futura).
- Para contratos IT, busca términos como: oracle, microsoft, ciberseguridad, token, inteligencia artificial.
- Responde siempre en español con análisis concreto y accionable.`

/* ── Helpers ───────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600
                 text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

function Code({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs text-slate-300
                      overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100 border-b border-slate-700 pb-2">{title}</h2>
      {children}
    </section>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
      <code className="text-emerald-400 font-mono text-xs break-all">{value}</code>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function Docs() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-slate-100">API Pública</h1>
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400
                           border border-emerald-500/30 rounded-full">
            Acceso libre
          </span>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          Accede a los 76,250 contratos SEACE 2026 directamente. La API usa Supabase con clave
          anónima pública — sin registro, sin OAuth, sin límite de peticiones razonable.
        </p>
      </div>

      {/* Base config */}
      <Section title="Configuración base">
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-2.5">
          <Pill label="Base URL" value={SUPABASE_URL} />
          <Pill label="API Key (anon)" value={ANON_KEY} />
          <Pill label="AI Proxy" value={AI_PROXY} />
        </div>
        <p className="text-xs text-slate-500">
          La clave <code className="text-slate-400">anon</code> es de solo lectura y está protegida
          por RLS en PostgreSQL. No permite escritura ni acceso a datos sensibles.
        </p>
      </Section>

      {/* Endpoints */}
      <Section title="Endpoints">
        {/* buscar_contratos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-400
                             border border-emerald-500/30 rounded">POST</span>
            <code className="text-sm text-slate-300 font-mono">/rest/v1/rpc/buscar_contratos</code>
          </div>
          <p className="text-sm text-slate-400">
            Búsqueda full-text en español con filtros opcionales. Devuelve contratos ordenados por
            relevancia FTS.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-500 font-medium pb-2 pr-4">Parámetro</th>
                  <th className="text-left text-slate-500 font-medium pb-2 pr-4">Tipo</th>
                  <th className="text-left text-slate-500 font-medium pb-2">Valores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  ['termino', 'string', 'Texto libre · búsqueda full-text'],
                  ['filtro_objeto', 'string | null', '"Bien" | "Servicio" | "Obra" | "Consultoría de Obra"'],
                  ['filtro_estado', 'string | null', '"Vigente" | "En Evaluación" | "Culminado" | "Cancelado"'],
                  ['filtro_entidad', 'null', 'Siempre null (reservado)'],
                  ['limite', 'int', 'Registros por página (máx. 100)'],
                  ['offset_val', 'int', 'Paginación: 0 = primera página'],
                ].map(([p, t, v]) => (
                  <tr key={p}>
                    <td className="py-2 pr-4 font-mono text-emerald-400">{p}</td>
                    <td className="py-2 pr-4 text-blue-400">{t}</td>
                    <td className="py-2 text-slate-400">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code code={CURL_BUSCAR} />
        </div>

        {/* Views */}
        <div className="space-y-2 mt-6">
          <p className="text-sm font-medium text-slate-300">Vistas disponibles (GET)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                path: '/rest/v1/dashboard_resumen',
                desc: 'Agrupado por objeto, estado, categoría IT y mes. Úsalo para gráficas y estadísticas.',
              },
              {
                path: '/rest/v1/vigentes_urgentes',
                desc: 'Contratos Vigentes ordenados por fecha de cierre de cotización ascendente.',
              },
            ].map(({ path, desc }) => (
              <div key={path} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <code className="text-emerald-400 text-xs font-mono block mb-1">{path}</code>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Proxy */}
        <div className="space-y-3 mt-6">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-violet-500/10 text-violet-400
                             border border-violet-500/30 rounded">POST</span>
            <code className="text-sm text-slate-300 font-mono">{AI_PROXY}</code>
          </div>
          <p className="text-sm text-slate-400">
            Proxy de Cloudflare Workers AI (Llama 3.3 70B). Recibe una consulta + lista de contratos
            y devuelve un análisis en español. Siempre responde HTTP 200 (fallback incluido).
          </p>
          <Code code={CURL_AI} />
        </div>
      </Section>

      {/* Schema */}
      <Section title="Esquema del contrato">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-500 font-medium pb-2 pr-4">Campo</th>
                <th className="text-left text-slate-500 font-medium pb-2 pr-4">Tipo</th>
                <th className="text-left text-slate-500 font-medium pb-2">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                ['id', 'number', 'Identificador único (PK)'],
                ['nro_contratacion', 'string', 'Número del proceso (ej: CM-001-2026-MINSA)'],
                ['descripcion_contrato', 'string', 'Título del proceso de contratación'],
                ['objeto', 'string', 'Bien · Servicio · Obra · Consultoría de Obra'],
                ['descripcion', 'string', 'Descripción del objeto contratado'],
                ['entidad', 'string', 'Nombre de la entidad del Estado peruano'],
                ['estado', 'string', 'Vigente · En Evaluación · Culminado · Cancelado'],
                ['fecha_publica', 'string | null', 'Fecha de publicación (ISO 8601)'],
                ['fecha_ini_cotizacion', 'string | null', 'Inicio del período de cotización'],
                ['fecha_fin_cotizacion', 'string | null', 'Cierre de cotización — indica urgencia'],
                ['cotizar', 'boolean | null', 'Si la contratación acepta cotizaciones'],
                ['categoria_it', 'string | null', 'Categoría TI asignada (13 posibles)'],
                ['relevancia_ia', 'string | null', 'ALTA · MEDIA · BAJA — para IA generativa'],
              ].map(([f, t, d]) => (
                <tr key={f}>
                  <td className="py-2 pr-4 font-mono text-emerald-400">{f}</td>
                  <td className="py-2 pr-4 text-blue-400">{t}</td>
                  <td className="py-2 text-slate-400">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-2">
          <p className="text-xs text-slate-500 mb-2">Categorías IT disponibles en <code className="text-slate-400">categoria_it</code></p>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Firma digital','IA/analytics','Ciberseguridad','Cloud/hosting',
              'Microsoft','Oracle','Base de datos/ERP','Desarrollo software',
              'Licencias','Soporte tecnico','Redes/cableado','Correo electronico','Hardware',
            ].map(c => (
              <span key={c} className="px-2 py-0.5 text-xs bg-slate-800 border border-slate-700
                                       text-slate-400 rounded">{c}</span>
            ))}
          </div>
        </div>
      </Section>

      {/* Code examples */}
      <Section title="Ejemplos de código">
        <div className="space-y-5">
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Python</p>
            <Code code={PYTHON_CODE} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">JavaScript / TypeScript</p>
            <Code code={JS_CODE} />
          </div>
        </div>
      </Section>

      {/* AI Prompts */}
      <Section title="System prompts para IA">
        <p className="text-sm text-slate-400">
          Pega estos prompts en un Proyecto de Claude o en las instrucciones personalizadas de ChatGPT
          para que el modelo pueda consultar la base de datos SEACE directamente.
        </p>

        <div className="space-y-5">
          {/* Claude */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-400
                               border border-amber-500/30 rounded">Claude</span>
              <span className="text-xs text-slate-500">Proyectos · instrucciones del sistema</span>
            </div>
            <Code code={CLAUDE_PROMPT} />
          </div>

          {/* ChatGPT */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-green-500/10 text-green-400
                               border border-green-500/30 rounded">ChatGPT</span>
              <span className="text-xs text-slate-500">Custom Instructions · GPTs · Code Interpreter</span>
            </div>
            <Code code={CHATGPT_PROMPT} />
          </div>
        </div>
      </Section>

      {/* Footer note */}
      <div className="border-t border-slate-800 pt-6 text-xs text-slate-600 space-y-1">
        <p>Datos actualizados diariamente a las 06:00 hora Perú (UTC−5) vía GitHub Actions.</p>
        <p>La clave anon es pública y de solo lectura. Nunca uses la clave service_role en código cliente.</p>
      </div>
    </div>
  )
}
