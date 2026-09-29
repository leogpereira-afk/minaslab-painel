import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './design-system-phase2.css'
import './design-system-commercial-pages.css'
import './design-system-phase5.css'
import './design-system-phase6.css'
import './design-system-phase7.css'
import './design-system-phase8.css'
import './design-system-layout-polish.css'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { AppErrorBoundary } from './components/ui/AppErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'}>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
