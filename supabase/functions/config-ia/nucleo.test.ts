import {
  cifrarClave,
  descifrarClave,
  enmascararClave,
  patchEndpoint,
  patchMeta,
  patchModelo,
  patchProveedor,
  sanearParaAuditoria,
  sanearProveedor,
  validarClaveEntrada,
  validarModelo,
  validarProveedor,
} from './nucleo.ts'

// Mismos vectores canónicos que seace-ai-proxy/src/ia/crypto.test.ts y
// seace-monitor/tests/test_ia_crypto.py: prueban la interop IA-001.
const MASTER = 'S0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0s=' // base64 de 32×'K'
const CANONICAL_FIJO = 'v1.AQIDBAUGBwgJCgsM.Z+MXfpSdffmEWcWepYpW1xttrkwTvpSNWjLzKFzpbu4='
const CANONICAL_FIJO_PLANO = 'sk-test-ABCD1234'
const CANONICAL_ALEATORIO = 'v1.nNRStWpBbjW8IM3m.54MzJQD48Pe2LNtKiU08HfoA3Urfrfq4MkXQMGZUi+I45A=='
const CANONICAL_ALEATORIO_PLANO = 'sk-live-Q9w8e7r6t5'

describe('cifrado AES-256-GCM (contrato IA-001)', () => {
  it('roundtrip: lo que cifra la EF, lo descifra el mismo runtime', async () => {
    const blob = await cifrarClave('sk-cualquiera-123', MASTER)
    expect(blob.startsWith('v1.')).toBe(true)
    expect(await descifrarClave(blob, MASTER)).toBe('sk-cualquiera-123')
  })

  it('descifra los vectores canónicos producidos por Python', async () => {
    expect(await descifrarClave(CANONICAL_FIJO, MASTER)).toBe(CANONICAL_FIJO_PLANO)
    expect(await descifrarClave(CANONICAL_ALEATORIO, MASTER)).toBe(CANONICAL_ALEATORIO_PLANO)
  })

  it('produce iv aleatorio y formato v1.iv.ct', async () => {
    const a = await cifrarClave('k-misma', MASTER)
    const b = await cifrarClave('k-misma', MASTER)
    expect(a).not.toBe(b)
    expect(a.split('.')).toHaveLength(3)
  })

  it('master key inválida o clave vacía fallan', async () => {
    await expect(cifrarClave('k', 'Y29ydGE=')).rejects.toThrow(/32 bytes/)
    await expect(cifrarClave('', MASTER)).rejects.toThrow()
  })

  it('enmascarar nunca devuelve el valor completo', () => {
    const m = enmascararClave('sk-live-Q9w8e7r6t5')
    expect(m).toBe('sk-...r6t5')
    expect(m).not.toContain('Q9w8e7')
    expect(enmascararClave('abc')).toBe('...')
  })
})

describe('validarProveedor', () => {
  it('acepta un proveedor openai mínimo', () => {
    const v = validarProveedor({
      id: 'qwen', nombre: 'Qwen', tipo_api: 'openai',
      base_url: 'https://maas.qwencloudapi.com/compatible-mode/v1',
    })
    expect(v.ok).toBe(true)
  })

  it('rechaza id inválido, tipo_api desconocido y base_url no-https', () => {
    expect(validarProveedor({ id: 'QWEN', nombre: 'x', tipo_api: 'openai', base_url: 'https://a' }).ok).toBe(false)
    expect(validarProveedor({ id: 'x1', nombre: 'x', tipo_api: 'xml', base_url: 'https://a' }).ok).toBe(false)
    expect(validarProveedor({ id: 'x1', nombre: 'x', tipo_api: 'openai', base_url: 'http://a' }).ok).toBe(false)
  })

  it('nativo no exige base_url; el cuerpo no puede traer clave', () => {
    expect(validarProveedor({ id: 'cf', nombre: 'CF', tipo_api: 'nativo' }).ok).toBe(true)
    expect(validarProveedor({ id: 'cf', nombre: 'CF', tipo_api: 'nativo', clave: 'x' }).ok).toBe(false)
    expect(validarProveedor({ id: 'cf', nombre: 'CF', tipo_api: 'nativo', clave_cifrada: 'v1.a.b' }).ok).toBe(false)
  })
})

describe('patchProveedor', () => {
  it('solo campos administrables; clave prohibida', () => {
    const v = patchProveedor({ nombre: 'Nuevo', activo: false })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.datos).toEqual({ nombre: 'Nuevo', activo: false })
    expect(patchProveedor({ clave: 'sk-xx' }).ok).toBe(false)
    expect(patchProveedor({}).ok).toBe(false)
    expect(patchProveedor({ base_url: 'http://inseguro' }).ok).toBe(false)
  })
})

describe('validarClaveEntrada', () => {
  it('acepta clave, acepta null para borrar, rechaza cortas', () => {
    expect(validarClaveEntrada({ clave: 'sk-live-12345678' }).ok).toBe(true)
    expect(validarClaveEntrada({ clave: null }).ok).toBe(true)
    expect(validarClaveEntrada({}).ok).toBe(false)
    expect(validarClaveEntrada({ clave: 'abc' }).ok).toBe(false)
    expect(validarClaveEntrada({ clave: 42 }).ok).toBe(false)
  })
})

describe('validarModelo', () => {
  it('generación mínima; embedding exige dimensiones y espacio', () => {
    expect(validarModelo({ proveedor_id: 'qwen', modelo: 'm1', tipo: 'generacion' }).ok).toBe(true)
    expect(validarModelo({ proveedor_id: 'qwen', modelo: 'e1', tipo: 'embedding' }).ok).toBe(false)
    expect(validarModelo({
      proveedor_id: 'qwen', modelo: 'e1', tipo: 'embedding',
      dimensiones: 1536, espacio_vectorial: 'qwen-tev4-1536',
    }).ok).toBe(true)
  })

  it('rechaza tipo desconocido, modelo con espacios y jsonb no-objeto', () => {
    expect(validarModelo({ proveedor_id: 'q', modelo: 'm', tipo: 'chat' }).ok).toBe(false)
    expect(validarModelo({ proveedor_id: 'q', modelo: 'm 1', tipo: 'generacion' }).ok).toBe(false)
    expect(validarModelo({ proveedor_id: 'q', modelo: 'm', tipo: 'generacion', params: [1] }).ok).toBe(false)
    expect(validarModelo({ proveedor_id: 'q', modelo: 'm', tipo: 'generacion', timeout_ms: -1 }).ok).toBe(false)
  })
})

describe('patchModelo', () => {
  it('parcial, valida tipos y jsonb', () => {
    const v = patchModelo({ timeout_ms: 90000, capacidades: { vision: true } })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.datos.timeout_ms).toBe(90000)
    expect(patchModelo({ timeout_ms: 'x' }).ok).toBe(false)
    expect(patchModelo({ precio: 'x' }).ok).toBe(false)
    expect(patchModelo({ dimensiones: null }).ok).toBe(true)
    expect(patchModelo({}).ok).toBe(false)
  })
})

describe('patchEndpoint', () => {
  const UUID = '11111111-1111-4111-8111-111111111111'

  it('endpoint conocido + patch válido', () => {
    const v = patchEndpoint('chat', { modelo_id: UUID, activo: true })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.datos).toEqual({ modelo_id: UUID, activo: true })
  })

  it('endpoint desconocido, uuid inválido y hereda a sí mismo rechazados', () => {
    expect(patchEndpoint('nada', { activo: true }).ok).toBe(false)
    expect(patchEndpoint('chat', { modelo_id: 'no-uuid' }).ok).toBe(false)
    expect(patchEndpoint('chat', { hereda: 'chat' }).ok).toBe(false)
    expect(patchEndpoint('chat', { hereda: 'cotizar' }).ok).toBe(false)
    expect(patchEndpoint('query_rewrite', { hereda: 'chat' }).ok).toBe(true)
  })

  it('habilitados: array de uuid ≤8; activo booleano estricto', () => {
    expect(patchEndpoint('chat', { habilitados: [UUID] }).ok).toBe(true)
    expect(patchEndpoint('chat', { habilitados: ['x'] }).ok).toBe(false)
    expect(patchEndpoint('chat', { habilitados: Array(9).fill(UUID) }).ok).toBe(false)
    expect(patchEndpoint('chat', { activo: 'si' }).ok).toBe(false)
    expect(patchEndpoint('chat', {}).ok).toBe(false)
  })
})

describe('salida segura', () => {
  it('rechaza credenciales anidadas y URLs con credenciales o query', () => {
    expect(patchModelo({ params: { nested: { api_key: 'synthetic' } } }).ok).toBe(false)
    expect(patchEndpoint('chat', { config: { Authorization: 'Bearer synthetic' } }).ok).toBe(false)
    expect(patchProveedor({ base_url: 'https://user:pass@example.test/v1' }).ok).toBe(false)
    expect(patchProveedor({ base_url: 'https://example.test/v1?key=synthetic' }).ok).toBe(false)
    expect(patchProveedor({ base_url: 42 }).ok).toBe(false)
  })
  it('sanearProveedor nunca expone clave_cifrada', () => {
    const out = sanearProveedor({ id: 'qwen', clave_cifrada: 'v1.x.y', clave_mascara: 'sk-...wxyz' })
    expect(JSON.stringify(out)).not.toContain('v1.x.y')
    expect(out.tiene_clave).toBe(true)
    expect(out.clave_mascara).toBe('sk-...wxyz')
  })

  it('sanearParaAuditoria enmascara material de clave a cualquier profundidad', () => {
    const limpio = sanearParaAuditoria({
      clave_cifrada: 'v1.secreto.x',
      nested: { clave: 'plano' },
      lista: [{ clave_cifrada: 'v1.otro.z' }],
    }) as Record<string, unknown>
    const s = JSON.stringify(limpio)
    expect(s).not.toContain('v1.secreto.x')
    expect(s).not.toContain('plano')
    expect(s).toContain('<protegida>')
    expect(limpio.clave_cifrada).toBe('<protegida>')
  })
})

describe('GW-008: saldo y meta', () => {
  it('patchProveedor acepta saldo_inicial_usd ≥0 y fija saldo_fecha', () => {
    const v = patchProveedor({ saldo_inicial_usd: 25.5 })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.datos.saldo_inicial_usd).toBe(25.5)
      expect(typeof v.datos.saldo_fecha).toBe('string')
    }
  })
  it('patchProveedor limpia saldo con null (y saldo_fecha)', () => {
    const v = patchProveedor({ saldo_inicial_usd: null })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.datos.saldo_inicial_usd).toBeNull()
      expect(v.datos.saldo_fecha).toBeNull()
    }
  })
  it('patchProveedor rechaza saldo inválido', () => {
    expect(patchProveedor({ saldo_inicial_usd: -1 }).ok).toBe(false)
    expect(patchProveedor({ saldo_inicial_usd: 'x' }).ok).toBe(false)
  })
  it('patchMeta solo acepta modo_failover auto|manual', () => {
    expect(patchMeta('modo_failover', { valor: 'auto' }).ok).toBe(true)
    expect(patchMeta('modo_failover', { valor: 'manual' }).ok).toBe(true)
    expect(patchMeta('modo_failover', { valor: 'x' }).ok).toBe(false)
    expect(patchMeta('version_config', { valor: 'auto' }).ok).toBe(false)
    expect(patchMeta('corpus_embeddings', { valor: 'auto' }).ok).toBe(false)
  })
})
