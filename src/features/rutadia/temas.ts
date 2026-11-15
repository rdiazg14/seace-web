/**
 * Menú de temas del Diario: líneas y, dentro de cada una, subtemas.
 *
 * El menú se arma con lo que hay en curso: una línea o un subtema sin procesos
 * no aparece. La línea viene de la clasificación del proceso; el subtema se
 * deduce aquí por vocabulario sobre la descripción y los ítems. Un proceso
 * puede caer en varios subtemas (impresoras y laptops en la misma compra).
 */
import type { Contrato } from '../../types'
import { LINEA_CHIPS } from './model'

/** Procesos TI sin línea asignada (solo relevancia). */
export const SIN_LINEA = '_sin_linea'
/** Procesos de una línea que no entran en ningún subtema con nombre. */
export const OTROS = '_otros'

const ETIQUETA_SIN_LINEA = 'Otros TI'
const ETIQUETA_OTROS = 'Otros'

export interface SeleccionTema {
  linea: string | null
  subtema: string | null
}

export const SIN_TEMA: SeleccionTema = { linea: null, subtema: null }

/** Línea y subtemas de un proceso, ya calculados. */
export interface TemaContrato {
  linea: string
  subtemas: readonly string[]
}

/** [id, etiqueta, patrones separados por «|»]. Los patrones van sin tildes y en singular. */
type ReglaCompacta = [id: string, label: string, patrones: string]

const REGLAS: Record<string, ReglaCompacta[]> = {
  'Hardware': [
    ['impresoras', 'Impresoras y multifuncionales',
      'impresora|multifuncional|fotocopiadora|copiadora|plotter|toner|cartucho|ticketera'],
    ['computadoras', 'Computadoras y laptops',
      'computadora|laptop|notebook|pc|all in one|portatil|tablet|workstation|estacion de trabajo|equipo de computo|equipo informatico'],
    ['almacenamiento', 'Discos y almacenamiento',
      'disco duro|disco solido|disco externo|estado solido|ssd|hdd|memoria usb|almacenamiento|nas|storage'],
    ['monitores', 'Monitores y proyectores',
      'monitor|proyector|pantalla interactiva|pantalla led|televisor|ecran|video wall'],
    ['energia', 'UPS y energía',
      'ups|acumulador de energia|estabilizador|bateria|sistema de alimentacion ininterrumpida'],
    ['escaneres', 'Escáneres',
      'scanner|escaner|digitalizador'],
    ['servidores', 'Servidores',
      'servidor|server|rack|gabinete'],
    ['componentes', 'Componentes',
      'tarjeta de video|tarjeta grafica|memoria ram|procesador|placa madre|mainboard|fuente de poder'],
    ['asistencia', 'Relojes y biométricos',
      'reloj marcador|reloj biometrico|biometrico|control de asistencia|lector de huella'],
    ['perifericos', 'Periféricos y accesorios',
      'teclado|mouse|webcam|camara web|audifono|auricular|lector de codigo|cable hdmi|adaptador|docking'],
    ['mantenimiento', 'Mantenimiento y repuestos',
      'repuesto|mantenimiento|reparacion'],
  ],
  'Redes/cableado': [
    ['internet', 'Internet',
      'internet|enlace dedicado|banda ancha|enlace de datos'],
    ['telefonia', 'Telefonía',
      'telefonia|telefonica|central telefonica|telefono ip|linea movil|plan de datos|chip'],
    ['fibra', 'Fibra óptica',
      'fibra optica'],
    ['cableado', 'Cableado estructurado',
      'cableado estructurado|cableado|punto de red|punto de datos'],
    ['equipos', 'Switches y equipos de red',
      'switch|router|access point|punto de acceso|antena|radioenlace|transceiver|patch'],
    ['videovigilancia', 'Videovigilancia',
      'videovigilancia|video vigilancia|camara de seguridad|camara de vigilancia|cctv|camara ip|nvr|dvr'],
    ['videoconferencia', 'Videoconferencia',
      'videoconferencia|reunion virtual|sala de reunion|zoom|meet'],
  ],
  'Desarrollo software': [
    ['web', 'Web y portales',
      'web|portal|sitio web|landing'],
    ['sig', 'SIG y cartografía',
      'informacion geografica|sig|gis|cartografia|geoportal|arcgis|qgis|fotogrametrica'],
    ['movil', 'Aplicaciones móviles',
      'aplicativo movil|aplicacion movil|app movil|android|ios'],
    ['documental', 'Gestión documental',
      'gestion documental|sgd|tramite documentario|casilla electronica|mesa de partes'],
    ['sistemas', 'Sistemas y aplicativos',
      'desarrollo de software|desarrollo de sistema|sistema de informacion|sistema informatico|solucion informatica|aplicativo|modulo|programacion|programador|desarrollador|analista programador'],
    ['calidad', 'Pruebas y calidad',
      'calidad de software|control de software|pruebas de software|qa|testing'],
    ['mantenimiento', 'Soporte y mantenimiento',
      'mantenimiento de software|mantenimiento del software|soporte y mantenimiento|actualizacion de software'],
    ['paquetes', 'Compra de software',
      'adquisicion de software|adquisicion e implementacion de un software|adquisicion del software|implementacion de software|licencia de software'],
    ['plataformas', 'Plataformas y suscripciones',
      'suscripcion|plataforma virtual|plataforma|aula virtual'],
  ],
  'Licencias': [
    ['diseno', 'Diseño gráfico y edición',
      'adobe|creative cloud|acrobat|photoshop|diseno grafico|edicion|ilustracion|trabajo creativo|diseno y edicion'],
    ['cad', 'Diseño CAD / Autodesk',
      'autodesk|autocad|civil 3d|revit|diseno asistido|cad|diseno 3d'],
    ['sig', 'SIG y fotogrametría',
      'arcgis|informacion geografica|qgis|esri|metashape|fotogrametria'],
    ['ofimatica', 'Ofimática',
      'ofimatica|office|microsoft 365|m365|google workspace'],
    ['seguridad', 'Seguridad',
      'seguridad perimetral|antivirus|antimalware|firewall|firewal|vulnerabilidad|watchguard|antispam|seguridad en la nube'],
    ['colaboracion', 'Acceso remoto y colaboración',
      'acceso remoto|asistencia remota|herramienta colaborativa|zoom|reunion virtual|videoconferencia|teams|webex'],
    ['analitica', 'Inteligencia de negocios y estadística',
      'inteligencia de negocio|power bi|tableau|spss|stata|estadistico|matlab'],
    ['ingenieria', 'Ingeniería y costos',
      's10|costos y presupuestos|ms project|primavera|sap2000|etabs'],
    ['correo', 'Correo',
      'correo'],
  ],
  'Soporte tecnico': [
    ['informatico', 'Soporte informático',
      'soporte informatico|soporte tecnico informatico|soporte tecnico|mesa de ayuda|help desk|equipo de computo|equipo informatico'],
    ['gobierno_digital', 'Gobierno digital',
      'gobierno digital|transformacion digital'],
    ['administrativo', 'Soporte administrativo',
      'soporte administrativo|soporte legal|soporte contable|soporte logistico'],
    ['mantenimiento', 'Mantenimiento de equipos',
      'mantenimiento preventivo|mantenimiento correctivo|mantenimiento'],
  ],
  'Base de datos/ERP': [
    ['erp', 'ERP (SAP y otros)',
      'sap|erp|siga|siaf'],
    ['administracion', 'Desarrollo y administración',
      'desarrollo de base de datos|implementacion de base de datos|servidor de base de datos|migracion|optimizacion|hardening|afinamiento|oracle|sql server|postgresql|mysql|administrador de base de datos|dba'],
    ['analisis', 'Análisis de datos',
      'analisis de base de datos|analisis estadistico|analisis de bases de datos|tratamiento|estandarizacion'],
    ['registro', 'Registro y actualización de datos',
      'actualizacion|registro|empadronamiento|sistematizacion|levantamiento|elaboracion de base de datos'],
  ],
  'Ciberseguridad': [
    ['antivirus', 'Antivirus',
      'antivirus|endpoint|antimalware|edr'],
    ['firewall', 'Firewall y perímetro',
      'firewall|seguridad perimetral|utm|waf|antispam|dns'],
    ['gestion', 'Gestión de seguridad',
      'seguridad de la informacion|sgsi|iso 27001|oficial de seguridad|riesgo'],
    ['pruebas', 'Hacking ético y pruebas',
      'ethical hacking|hacking etico|pentest|vulnerabilidad|emulacion de ataque'],
    ['monitoreo', 'Monitoreo',
      'monitoreo|soc|siem'],
    ['capacitacion', 'Capacitación',
      'curso|capacitacion|taller|concientizacion'],
  ],
  'IA/analytics': [
    ['plataformas', 'Plataformas y suscripciones',
      'suscripcion|plataforma|licencia|token|chatgpt|copilot|gemini|claude'],
    ['capacitacion', 'Capacitación',
      'capacitacion|curso|taller|diplomado'],
    ['modelos', 'Modelos y machine learning',
      'machine learning|modelo|predecir|prediccion|aprendizaje automatico|ciencia de datos'],
    ['agentes', 'Agentes y chatbots',
      'agente|chatbot|asistente virtual'],
    ['analitica', 'Analítica y tableros',
      'power bi|dashboard|tablero|business intelligence|analitica|inteligencia de negocio'],
  ],
  'Cloud/hosting': [
    ['datacenter', 'Data center',
      'data center|centro de datos|datacenter'],
    ['hosting', 'Hosting y dominios',
      'hosting|dominio|alojamiento|certificado ssl'],
    ['nube', 'Nube',
      'cloud|nube|aws|azure|google cloud|iaas|saas'],
  ],
  'Telemetria/OT': [
    ['dataloggers', 'Dataloggers y telemetría',
      'datalogger|data logger|telemetria|scada'],
    ['automatizacion', 'PLC y automatización',
      'plc|controlador logico programable|automatizacion|variador de velocidad|variador|hmi'],
    ['medicion', 'Medición y sensores',
      'macromedidor|caudalimetro|caudal|sensor|medidor|electrovalvula|transmisor'],
  ],
  'Microsoft': [
    ['windows_server', 'Windows Server',
      'windows server|cal|rds|directorio activo|active directory'],
    ['m365', 'Microsoft 365 y Office',
      'microsoft 365|office 365|m365|office|exchange'],
    ['power', 'Power Platform',
      'power bi|power apps|power automate|power platform'],
  ],
  'Correo electronico': [
    ['nube', 'Correo en la nube',
      'nube|google workspace|microsoft 365'],
    ['masivo', 'Envío masivo',
      'masivo|sms|mailing'],
  ],
  'Firma digital': [
    ['certificados', 'Certificados digitales y SSL',
      'certificado digital|certificado ssl|ssl'],
    ['firma', 'Firma digital',
      'firma digital|firma electronica'],
  ],
}

interface Subtema {
  id: string
  label: string
  patron: RegExp
}

/** Minúsculas, sin tildes y solo letras y números separados por un espacio. */
export function normalizarTexto(texto: string): string {
  return (texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().match(/[a-z0-9]+/g) ?? []).join(' ')
}

/**
 * Coincide por palabras completas y tolera el plural de cada una:
 * «disco duro» encuentra «discos duros», pero «pc» no encuentra «pcm».
 */
function compilar(patrones: string): RegExp {
  const alternativas = patrones.split('|').map(p =>
    normalizarTexto(p).split(' ').map(palabra => `${palabra}(?:s|es)?`).join(' '))
  return new RegExp(`(?:^| )(?:${alternativas.join('|')})(?= |$)`)
}

const SUBTEMAS: ReadonlyMap<string, Subtema[]> = new Map(
  Object.entries(REGLAS).map(([linea, reglas]) => [
    linea,
    reglas.map(([id, label, patrones]) => ({ id, label, patron: compilar(patrones) })),
  ]),
)

const ETIQUETA_LINEA: ReadonlyMap<string, string> = new Map(LINEA_CHIPS.map(c => [c.id, c.label]))

export function lineaDe(contrato: Pick<Contrato, 'categoria_it'>): string {
  return contrato.categoria_it || SIN_LINEA
}

export function etiquetaLinea(linea: string): string {
  if (linea === SIN_LINEA) return ETIQUETA_SIN_LINEA
  return ETIQUETA_LINEA.get(linea) ?? linea
}

export function etiquetaSubtema(linea: string, subtema: string): string {
  if (subtema === OTROS) return ETIQUETA_OTROS
  return SUBTEMAS.get(linea)?.find(s => s.id === subtema)?.label ?? subtema
}

type ContratoTema = Pick<Contrato, 'categoria_it' | 'descripcion' | 'items_json'>

/** Subtemas del proceso dentro de su línea, en el orden de las reglas. */
export function subtemasDe(contrato: ContratoTema): string[] {
  const reglas = SUBTEMAS.get(lineaDe(contrato))
  if (!reglas) return []
  const partes = [contrato.descripcion ?? '']
  for (const item of contrato.items_json ?? []) {
    partes.push(item.nom_cubso ?? '', item.descripcion ?? '')
  }
  // El punto impide que un patrón de varias palabras se arme entre dos campos.
  const texto = partes.map(normalizarTexto).join(' . ')
  return reglas.filter(s => s.patron.test(texto)).map(s => s.id)
}

export function temaDe(contrato: ContratoTema): TemaContrato {
  return { linea: lineaDe(contrato), subtemas: subtemasDe(contrato) }
}

export function cumpleTema(tema: TemaContrato, seleccion: SeleccionTema): boolean {
  if (!seleccion.linea) return true
  if (tema.linea !== seleccion.linea) return false
  if (!seleccion.subtema) return true
  if (seleccion.subtema === OTROS) return tema.subtemas.length === 0
  return tema.subtemas.includes(seleccion.subtema)
}

export interface EntradaSubtema {
  id: string
  label: string
  n: number
}

export interface EntradaLinea {
  id: string
  label: string
  n: number
  /** Vacío si la línea no tiene subtemas con nombre entre sus procesos. */
  subtemas: EntradaSubtema[]
}

export interface MenuTemas {
  total: number
  lineas: EntradaLinea[]
}

/**
 * Menú para una lista de procesos: solo líneas y subtemas con al menos uno,
 * de mayor a menor. La selección vigente se conserva aunque quede en cero,
 * para que siempre se pueda quitar. Como un proceso puede estar en varios
 * subtemas, sus conteos no suman el de la línea.
 */
export function armarMenuTemas(temas: Iterable<TemaContrato>, seleccion: SeleccionTema = SIN_TEMA): MenuTemas {
  const porLinea = new Map<string, { n: number; porSubtema: Map<string, number>; sinSubtema: number }>()
  const grupoDe = (linea: string) => {
    let g = porLinea.get(linea)
    if (!g) {
      g = { n: 0, porSubtema: new Map(), sinSubtema: 0 }
      porLinea.set(linea, g)
    }
    return g
  }
  let total = 0
  for (const t of temas) {
    total += 1
    const g = grupoDe(t.linea)
    g.n += 1
    if (t.subtemas.length === 0) g.sinSubtema += 1
    for (const s of t.subtemas) g.porSubtema.set(s, (g.porSubtema.get(s) ?? 0) + 1)
  }
  if (seleccion.linea) {
    const g = grupoDe(seleccion.linea)
    if (seleccion.subtema && seleccion.subtema !== OTROS && !g.porSubtema.has(seleccion.subtema)) {
      g.porSubtema.set(seleccion.subtema, 0)
    }
  }

  const lineas: EntradaLinea[] = []
  for (const [linea, g] of porLinea) {
    const orden = SUBTEMAS.get(linea)?.map(s => s.id) ?? []
    const subtemas: EntradaSubtema[] = [...g.porSubtema]
      .map(([id, n]) => ({ id, label: etiquetaSubtema(linea, id), n }))
      .sort((a, b) => b.n - a.n || orden.indexOf(a.id) - orden.indexOf(b.id))
    const otrosElegido = seleccion.linea === linea && seleccion.subtema === OTROS
    // «Otros» solo tiene sentido junto a subtemas con nombre.
    if ((subtemas.length > 0 && g.sinSubtema > 0) || otrosElegido) {
      subtemas.push({ id: OTROS, label: ETIQUETA_OTROS, n: g.sinSubtema })
    }
    lineas.push({ id: linea, label: etiquetaLinea(linea), n: g.n, subtemas })
  }
  lineas.sort((a, b) =>
    Number(a.id === SIN_LINEA) - Number(b.id === SIN_LINEA)
    || b.n - a.n
    || a.label.localeCompare(b.label, 'es'))
  return { total, lineas }
}
