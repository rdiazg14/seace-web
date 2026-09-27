import { crearHandler } from './handler.ts'

const ACTOR = '11111111-1111-4111-8111-111111111111'
const MASTER = 'S0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0s='
function setup(options: { status?: number; master?: string; error?: object; gateError?: boolean } = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: { registro: { tiene_clave: true, clave_mascara: 'sk-...1234' }, version_config: 18 }, error: options.error })
  const service = { rpc, from: vi.fn() }
  const gate = vi.fn(async () => {
    if (options.gateError) throw new Error('private-database-message')
    return options.status ? new Response('{}', { status: options.status }) : { admin: { id: ACTOR }, service }
  })
  const handler = crearHandler({ requireAdmin: gate as unknown as Parameters<typeof crearHandler>[0]['requireAdmin'], masterKey: () => options.master })
  return { handler, rpc, service }
}
function request(path: string, method = 'POST', body?: unknown) {
  return new Request(`https://example.test/functions/v1/config-ia${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  })
}
describe('config-ia HTTP', () => {
  it.each([401, 403])('rechaza %s antes de acceder a BD', async status => {
    const { handler, rpc, service } = setup({ status })
    expect((await handler(request('/endpoints/chat', 'PATCH', { activo: false }))).status).toBe(status)
    expect(rpc).not.toHaveBeenCalled(); expect(service.from).not.toHaveBeenCalled()
  })
  it('cifra la clave antes de RPC y responde solo máscara', async () => {
    const { handler, rpc } = setup({ master: MASTER })
    const response = await handler(request('/proveedores/qwen/clave', 'POST', { clave: 'sk-synthetic-1234' }))
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain('synthetic'); expect(text).not.toContain('v1.')
    expect(text).toContain('sk-...1234')
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe('ia_config_mutar'); expect(args.p_actor).toBe(ACTOR)
    expect(args.p_datos.clave_cifrada).toMatch(/^v1\./)
    expect(JSON.stringify(args)).not.toContain('synthetic')
  })
  it('sin master rechaza sin escribir', async () => {
    const { handler, rpc } = setup()
    expect((await handler(request('/proveedores/qwen/clave', 'POST', { clave: 'sk-synthetic-1234' }))).status).toBe(500)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('borrado explícito no necesita master y queda auditado por la misma RPC', async () => {
    const { handler, rpc } = setup()
    expect((await handler(request('/proveedores/qwen/clave', 'POST', { clave: null }))).status).toBe(200)
    expect(rpc.mock.calls[0][1].p_datos).toEqual({ clave_cifrada: null, clave_mascara: null })
  })
  it('rechaza JSON inválido, cuerpo excesivo y rutas con sufijos', async () => {
    const { handler, rpc } = setup()
    expect((await handler(new Request('https://x/config-ia/modelos', { method: 'POST', body: '{' }))).status).toBe(400)
    expect((await handler(request('/modelos', 'POST', { notas: 'x'.repeat(65536) }))).status).toBe(413)
    expect((await handler(request('/proveedores/qwen/clave/extra', 'POST', { clave: null }))).status).toBe(405)
    expect(rpc).not.toHaveBeenCalled()
  })
  it.each([['23505',409],['23503',409],['P0002',404],['42501',403],['23514',400],['XX000',500]])('error %s saneado', async (code,status) => {
    const { handler } = setup({ error: { code, message: 'v1.private-blob secret' } })
    const response = await handler(request('/endpoints/chat','PATCH',{ activo:false }))
    expect(response.status).toBe(status)
    expect(await response.text()).not.toContain('private')
  })
  it('no confirma éxito si falla auditoría transaccional o autorización arroja error', async () => {
    const { handler } = setup({ error: { code: 'XX000', message: 'audit failed' } })
    expect((await handler(request('/endpoints/chat','PATCH',{ activo:false }))).status).toBe(500)
    const broken = setup({ gateError: true })
    const response = await broken.handler(request('','GET'))
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('private')
  })
  it('snapshot saneado y auditoría no consultan ni exponen ciphertext', async () => {
    const { handler, service } = setup()
    service.from.mockImplementation((table: string) => {
      const data = table === 'ia_proveedores' ? [{ id: 'qwen', clave_mascara: '...test' }]
        : table === 'ia_config_cambios' ? [{ antes: { clave_cifrada: 'v1.synthetic.private' } }] : []
      const result = { data, error: null }
      const query = {
        select: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
      return query
    })
    const response = await handler(request('', 'GET'))
    const snapshot = await response.json()
    expect(snapshot.proveedores[0].tiene_clave).toBe(true)
    expect(JSON.stringify(snapshot)).not.toContain('clave_cifrada')
    const audit = await handler(request('/auditoria', 'GET'))
    expect(await audit.text()).not.toContain('v1.synthetic.private')
  })
})
