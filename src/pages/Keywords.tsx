import { ErrorBox } from '../components/ui'
import { useKeywords } from '../features/keywords/useKeywords'
import { ColaRevision } from '../features/keywords/components/ColaRevision'
import { FormKeyword } from '../features/keywords/components/FormKeyword'
import { TablaKeywords } from '../features/keywords/components/TablaKeywords'
import { TablaCandidatas } from '../features/keywords/components/TablaCandidatas'

export default function Keywords() {
  const {
    cands,
    cola,
    catElegida,
    setCatElegida,
    loading,
    error,
    ok,
    filtroCat,
    setFiltroCat,
    filtroTipo,
    setFiltroTipo,
    filtroActiva,
    setFiltroActiva,
    sort,
    sortAsc,
    busyId,
    kw,
    setKw,
    cat,
    setCat,
    tipo,
    setTipo,
    limite,
    setLimite,
    nota,
    setNota,
    simForm,
    setSimForm,
    saving,
    simulating,
    simCand,
    load,
    visibles,
    clickSort,
    onSimularForm,
    onCrear,
    toggleActiva,
    onSimularCand,
    onPromover,
    onAprobarCola,
    onRechazarCola,
  } = useKeywords()

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-5 sm:px-4">
      <div>
        <h1 className="text-lg font-medium">Keywords</h1>
        <p className="text-sm text-slate-500">
          Vocabulario de clasificación. Los cambios valen para altas nuevas.
          El backfill del corpus sigue siendo del pipeline. No se borra: solo se desactiva.
        </p>
      </div>

      {error && <ErrorBox retry={() => void load()}>{error}</ErrorBox>}
      {ok && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          {ok}
        </p>
      )}

      <ColaRevision
        cola={cola}
        loading={loading}
        busyId={busyId}
        catElegida={catElegida}
        setCatElegida={setCatElegida}
        onAprobarCola={onAprobarCola}
        onRechazarCola={onRechazarCola}
      />

      <FormKeyword
        kw={kw}
        setKw={setKw}
        cat={cat}
        setCat={setCat}
        tipo={tipo}
        setTipo={setTipo}
        limite={limite}
        setLimite={setLimite}
        nota={nota}
        setNota={setNota}
        simForm={simForm}
        setSimForm={setSimForm}
        saving={saving}
        simulating={simulating}
        onSimularForm={onSimularForm}
        onCrear={onCrear}
      />

      <TablaKeywords
        visibles={visibles}
        loading={loading}
        busyId={busyId}
        filtroCat={filtroCat}
        setFiltroCat={setFiltroCat}
        filtroTipo={filtroTipo}
        setFiltroTipo={setFiltroTipo}
        filtroActiva={filtroActiva}
        setFiltroActiva={setFiltroActiva}
        sort={sort}
        sortAsc={sortAsc}
        clickSort={clickSort}
        toggleActiva={toggleActiva}
      />

      <TablaCandidatas
        cands={cands}
        loading={loading}
        busyId={busyId}
        simCand={simCand}
        onSimularCand={onSimularCand}
        onPromover={onPromover}
      />
    </div>
  )
}
