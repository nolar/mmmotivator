import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import ImpressumPage from './pages/ImpressumPage.tsx'
import DatenschutzPage from './pages/DatenschutzPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpeedInsights />
    <Analytics />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/datenschutz" element={<DatenschutzPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
