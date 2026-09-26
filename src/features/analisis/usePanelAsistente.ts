/** Panel lateral del asistente: viewport de escritorio, ancho persistido y redimensionado con el mouse. */

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { anchoGuardado, CHAT_PANEL_STORAGE_KEY, clampPanelWidth, DESKTOP_MQ } from './model'

function viewportWidth(): number | undefined {
  return typeof window === 'undefined' ? undefined : window.innerWidth
}

export function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches
}

function readSavedPanelWidth(): number {
  try {
    return anchoGuardado(localStorage.getItem(CHAT_PANEL_STORAGE_KEY), viewportWidth())
  } catch { /* quota / private mode */ }
  return anchoGuardado(null)
}

export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(isDesktopViewport)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const apply = () => setDesktop(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return desktop
}

export function usePanelAsistente(contratoId: number) {
  const desktop = useDesktop()
  const [chatOpen, setChatOpen] = useState(isDesktopViewport)
  const [panelWidth, setPanelWidth] = useState<number>(() => readSavedPanelWidth())
  const [panelResizing, setPanelResizing] = useState(false)

  useEffect(() => {
    const onResize = () => setPanelWidth(w => clampPanelWidth(w, viewportWidth()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setChatOpen(isDesktopViewport())
  }, [contratoId])

  function onResizeMouseDown(e: ReactMouseEvent) {
    if (!desktop) return
    e.preventDefault()
    let latestW = panelWidth
    setPanelResizing(true)
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      latestW = clampPanelWidth(window.innerWidth - ev.clientX, viewportWidth())
      setPanelWidth(latestW)
    }

    const onUp = () => {
      document.body.style.userSelect = ''
      setPanelResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem(CHAT_PANEL_STORAGE_KEY, String(latestW))
      } catch { /* quota */ }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return {
    desktop,
    chatOpen,
    abrir: () => setChatOpen(true),
    cerrar: () => setChatOpen(false),
    panelWidth,
    panelResizing,
    onResizeMouseDown,
  }
}
