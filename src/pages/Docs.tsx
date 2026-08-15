import { useState, type ReactNode } from 'react'
import { SUPABASE_ANON_KEY, SUPABASE_URL, AI_PROXY } from '../lib/supabase'

const CURL_BUSCAR = `curl -X POST '${SUPABASE_URL}/rest/v1/rpc/buscar_contratos' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
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
  -d '{"query": "contratos de ciberseguridad vigentes"}'`

const CURL_TDR = `curl -X POST '${SUPABASE_URL}/rest/v1/rpc/buscar_tdr' \\
  -H "apikey: ${SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query_embedding": [0.01, 0.02],
    "match_count": 8,
    "filter_estado": "Vigente"
  }'`

const PYTHON_CODE = `import requests

URL = "${SUPABASE_URL}"
KEY = "${SUPABASE_ANON_KEY}"

def buscar(termino, objeto=None, estado=None, limite=10):
    r = requests.post(
        f"{URL}/rest/v1/rpc/buscar_contratos",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json"},
        json={"termino": termino, "filtro_objeto": objeto,
              "filtro_estado": estado, "filtro_entidad": None,
              "limite": limite, "offset_val": 0},
    )
    r.raise_for_status()
    return r.json()

print(buscar("ciberseguridad", estado="Vigente"))`

const JS_CODE = `const URL = '${SUPABASE_URL}'
const KEY = '${SUPABASE_ANON_KEY}'

async function buscar(termino, filtroEstado) {
  const res = await fetch(\`\${URL}/rest/v1/rpc/buscar_contratos\`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: \`Bearer \${KEY}\`,
               'Content-Type': 'application/json' },
    body: JSON.stringify({
      termino, filtro_objeto: null, filtro_estado: filtroEstado ?? null,
      filtro_entidad: null, limite: 10, offset_val: 0,
    }),
  })
  return res.json()
}`

const CLAUDE_PROMPT = `Eres un asistente de contrataciones públicas del Perú (SEACE).
Hay 76,250 contratos 2026 y un RAG sobre 2,330 vigentes (TDR + ítems CUBSO).

Búsqueda FTS:
POST ${SUPABASE_URL}/rest/v1/rpc/buscar_contratos
Headers: apikey y Authorization Bearer ${SUPABASE_ANON_KEY}
Body: { "termino": "texto", "filtro_objeto": null, "filtro_estado": "Vigente",
        "filtro_entidad": null, "limite": 10, "offset_val": 0 }

Chat RAG (recomendado para specs técnicas):
POST ${AI_PROXY}
Body: { "query": "pregunta en español" }
Devuelve { respuesta, contratos_referenciados, chunks_usados }.

Responde en español. Prioriza vigentes. No inventes requisitos que no estén en los datos.`

const CHATGPT_PROMPT = `Experto SEACE Perú. API pública:

POST ${SUPABASE_URL}/rest/v1/rpc/buscar_contratos
API KEY: ${SUPABASE_ANON_KEY}
Body: { termino, filtro_objeto, filtro_estado, filtro_entidad: null, limite: 10, offset_val: 0 }

RAG: POST ${AI_PROXY}  Body: { "query": "..." }

Usa Code Interpreter para llamar la API. Responde en español.`

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => undefined)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      }}
      className="absolute right-2 top-2 rounded bg-slate-700 px-2 py-1 text-[11px] text-slate-200"
    >
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Code({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 dark:border-slate-800">
        {code}
      </pre>
      <CopyButton text={code} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-slate-200 pb-1 text-base dark:border-slate-800">{title}</h2>
      {children}
    </section>
  )
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-3 py-6 sm:px-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl">API pública</h1>
          <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
            Acceso libre
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          76,250 contratos SEACE 2026 + RAG sobre TDR de vigentes. Clave anon de solo lectura.
        </p>
      </header>

      <Section title="Configuración">
        <div className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
          <p><span className="text-slate-500">Base URL</span> <code className="break-all text-teal-600 dark:text-teal-400">{SUPABASE_URL}</code></p>
          <p><span className="text-slate-500">AI Proxy</span> <code className="break-all text-teal-600 dark:text-teal-400">{AI_PROXY}</code></p>
        </div>
      </Section>

      <Section title="Endpoints">
        <p className="text-sm text-slate-500">POST /rest/v1/rpc/buscar_contratos — full-text en español.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 pr-3 font-medium">Parámetro</th>
                <th className="py-1 pr-3 font-medium">Tipo</th>
                <th className="py-1 font-medium">Valores</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['termino', 'string', 'Texto libre FTS'],
                ['filtro_objeto', 'string | null', 'Bien · Servicio · Obra · Consultoría de Obra'],
                ['filtro_estado', 'string | null', 'Vigente · En Evaluación · Culminado'],
                ['filtro_entidad', 'string | null', 'ILIKE sobre entidad'],
                ['limite', 'int', 'Máx. 100'],
                ['offset_val', 'int', 'Paginación'],
              ].map(([p, t, v]) => (
                <tr key={p}>
                  <td className="py-1.5 pr-3 font-mono text-teal-600 dark:text-teal-400">{p}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{t}</td>
                  <td className="py-1.5 text-slate-500">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Code code={CURL_BUSCAR} />
        <p className="pt-2 text-sm text-slate-500">GET /rest/v1/dashboard_resumen · GET /rest/v1/vigentes_urgentes</p>
      </Section>

      <Section title="Búsqueda semántica (RAG)">
        <p className="text-sm text-slate-500">
          Los TDR de contrataciones menores no se publican como PDF: el texto vive en la API de detalle
          (desObjetoContrato + ítems CUBSO). Ese texto se parte en 9,074 chunks con embeddings
          bge-base-en-v1.5 (768 dims) en pgvector. El chat embebe la pregunta, llama a
          {' '}<code>buscar_tdr</code> y combina con FTS antes de Llama 3.3 70B.
        </p>
        <Code code={CURL_TDR} />
        <p className="text-xs text-slate-400">
          query_embedding debe tener 768 dimensiones. El ejemplo de arriba es ilustrativo.
        </p>
        <p className="text-sm text-slate-500">Chat RAG (recomendado):</p>
        <Code code={CURL_AI} />
        <p className="text-xs text-slate-400">
          Respuesta: {'{ respuesta, contratos_referenciados, chunks_usados }'}. Latencia típica 4–14 s.
        </p>
      </Section>

      <Section title="Esquema del contrato">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['id', 'PK SEACE'],
                ['descripcion_contrato', 'Número / título CM-'],
                ['descripcion', 'TDR (desObjetoContrato)'],
                ['entidad / estado / objeto', 'Metadatos'],
                ['categoria_it', '13 categorías por reglas'],
                ['relevancia_ia', 'ALTA · MEDIA · BAJA'],
                ['nom_area_usuaria', 'Detalle de vigentes'],
                ['items_json', 'Ítems CUBSO (JSONB)'],
              ].map(([f, d]) => (
                <tr key={f}>
                  <td className="py-1.5 pr-3 font-mono text-teal-600 dark:text-teal-400">{f}</td>
                  <td className="py-1.5 text-slate-500">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Ejemplos de código">
        <p className="text-xs text-slate-500">Python</p>
        <Code code={PYTHON_CODE} />
        <p className="text-xs text-slate-500">JavaScript</p>
        <Code code={JS_CODE} />
      </Section>

      <Section title="Prompts para Claude y ChatGPT">
        <p className="text-xs text-slate-500">Claude Projects</p>
        <Code code={CLAUDE_PROMPT} />
        <p className="text-xs text-slate-500">ChatGPT Custom Instructions</p>
        <Code code={CHATGPT_PROMPT} />
      </Section>

      <p className="text-[11px] text-slate-400">
        Ingesta diaria 06:00 Perú. Nunca uses la service_role en el cliente.
      </p>
    </div>
  )
}
