import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Buscador from './pages/Buscador'
import Chat from './pages/Chat'
import Docs from './pages/Docs'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <Navbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/buscar" element={<Buscador />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/docs" element={<Docs />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  )
}
